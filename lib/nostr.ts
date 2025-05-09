import { getUserKeys } from './nostr-keys';
import { EVENT_KINDS, type PackageData, type ProfileData } from './nostr-types';
import {
  listEvents,
  createSignedEvent,
  publishEvent,
  getEventById,
} from './nostr-service';
import {
  saveLocalPackage,
  getLocalPackages,
  getMyLocalDeliveries,
  pickupLocalPackage,
  completeLocalDelivery,
  getLocalPackageById,
  deleteLocalPackage,
  getAllLocalDeliveries,
} from './local-package-service';

// Re-export types for backward compatibility
export type { PackageData, ProfileData };

// Helper function to get user's public key
export function getUserPubkey(): string {
  // Get from localStorage first
  const storedPubkey = localStorage.getItem('nostr_pubkey');
  if (storedPubkey) {
    return storedPubkey;
  }

  // Fall back to generated keys
  const { publicKey } = getUserKeys();
  return publicKey;
}

// Update the parsePackageFromEvent function to be more robust
function parsePackageFromEvent(event: any): PackageData | null {
  try {
    // Check if event has content
    if (
      !event.content ||
      typeof event.content !== 'string' ||
      event.content.trim() === ''
    ) {
      console.log('Skipping event with empty content:', event.id);
      return null;
    }

    // Log the raw content for debugging
    console.debug(
      'Raw event content:',
      event.content.substring(0, 100) +
        (event.content.length > 100 ? '...' : '')
    );

    // Try to parse the content
    let content;
    try {
      content = JSON.parse(event.content);
    } catch (parseError) {
      console.log(`Invalid JSON in event ${event.id}:`, parseError);
      return null;
    }

    // Validate required fields
    if (
      !content.title ||
      !content.pickupLocation ||
      !content.destination ||
      !content.cost
    ) {
      console.log(`Event ${event.id} is missing required fields:`, content);
      return null;
    }

    return {
      id: event.id,
      title: content.title,
      pickupLocation: content.pickupLocation,
      destination: content.destination,
      cost: content.cost,
      description: content.description || '',
      status: content.status || 'available',
      pubkey: event.pubkey,
      created_at: event.created_at,
      // Parse additional fields if present
      courier_pubkey: content.courier_pubkey,
      pickup_time: content.pickup_time,
      delivery_time: content.delivery_time,
    };
  } catch (error) {
    console.error('Failed to parse package from event:', error);
    return null;
  }
}

// Fix the createPackage function to avoid duplicates
export async function createPackage(
  packageData: Omit<PackageData, 'id' | 'status'>
): Promise<string> {
  try {
    // Create the content object
    const content = {
      ...packageData,
      status: 'available',
    };

    // Try to create and sign the event with Nostr first
    try {
      // Use simpler tags for better compatibility
      const event = await createSignedEvent(
        EVENT_KINDS.PACKAGE,
        JSON.stringify(content),
        [['t', 'package']]
      );

      // Try to publish the event
      await publishEvent(event);

      console.log('Package created with ID:', event.id);

      // Save to localStorage with the same ID as Nostr to avoid duplicates
      const localPackage = {
        ...packageData,
        id: event.id,
        status: 'available' as const,
        pubkey: getUserPubkey(),
        created_at: Math.floor(Date.now() / 1000),
      };

      // Get existing packages
      const packages = getLocalPackages();

      // Check if this package already exists (avoid duplicates)
      if (!packages.some((pkg) => pkg.id === event.id)) {
        packages.push(localPackage);
        localStorage.setItem('shared_packages_v1', JSON.stringify(packages));
        console.log('Package saved to localStorage with Nostr ID:', event.id);
      }

      return event.id;
    } catch (nostrError) {
      console.error(
        'Nostr error, falling back to localStorage only:',
        nostrError
      );
      // Fall back to localStorage only
      const localId = saveLocalPackage(packageData);
      console.log('Package saved to localStorage with ID:', localId);
      return localId;
    }
  } catch (error) {
    console.error('Failed to create package:', error);
    // Last resort fallback
    return saveLocalPackage(packageData);
  }
}

// Delete a package
export async function deletePackage(packageId: string): Promise<void> {
  try {
    console.log(`Deleting package with ID: ${packageId}`);

    // First, delete the package from localStorage
    deleteLocalPackage(packageId);
    console.log('Package deleted from localStorage');

    // Then try to update Nostr
    try {
      // Create a deletion event for the package
      const event = await createSignedEvent(
        5, // Kind 5 is for deletion
        '', // Empty content
        [['e', packageId]] // Reference to the event being deleted
      );

      // Publish the event
      await publishEvent(event);

      console.log('Package deletion event published to Nostr');
    } catch (nostrError) {
      console.error(
        "Failed to delete package in Nostr, but it's deleted in localStorage:",
        nostrError
      );
      // No need to throw here since we already updated localStorage
    }
  } catch (error) {
    console.error('Failed to delete package:', error);
    throw error;
  }
}

// Update the getPackages function to include packages created by the current user
// regardless of their status (available, in_transit, delivered)
export async function getPackages(): Promise<PackageData[]> {
  try {
    console.log('Fetching packages from Nostr...');
    const currentPubkey = getUserPubkey();

    // Get local packages first
    const localPackages = getLocalPackages();
    console.log(`Found ${localPackages.length} local packages`);

    // Get all deliveries to track package status
    const allDeliveries = getAllLocalDeliveries();
    console.log(`Found ${allDeliveries.length} deliveries in localStorage`);

    // Create a map of package IDs to their delivery status
    const packageStatusMap = new Map<string, PackageData>();

    // Add all deliveries to the map
    allDeliveries.forEach((delivery) => {
      packageStatusMap.set(delivery.id, delivery);
    });

    try {
      // Use a simpler filter format for better compatibility
      const events = await listEvents(
        [
          {
            kinds: [EVENT_KINDS.PACKAGE],
            limit: 100,
          },
        ],
        10000
      );

      console.log(`Found ${events.length} package events from Nostr`);

      // Parse packages from events and filter out null values
      const nostrPackages = events
        .map(parsePackageFromEvent)
        .filter((pkg): pkg is PackageData => pkg !== null);

      console.log(
        `Successfully parsed ${nostrPackages.length} out of ${events.length} events`
      );

      // Combine local and Nostr packages, removing duplicates by ID
      const allPackages = [...localPackages];

      // Add Nostr packages that aren't already in local packages
      for (const nostrPkg of nostrPackages) {
        if (!allPackages.some((pkg) => pkg.id === nostrPkg.id)) {
          allPackages.push(nostrPkg);
        }
      }

      // Now fetch delivery events to update package status
      const deliveryEvents = await listEvents(
        [
          {
            kinds: [EVENT_KINDS.DELIVERY],
            limit: 100,
          },
        ],
        10000
      );

      console.log(`Found ${deliveryEvents.length} delivery events from Nostr`);

      // Process delivery events to update package status
      for (const event of deliveryEvents) {
        try {
          const content = JSON.parse(event.content);
          if (content.package_id) {
            // Find the package in our list
            const packageIndex = allPackages.findIndex(
              (pkg) => pkg.id === content.package_id
            );
            if (packageIndex >= 0) {
              // Update the package with delivery info
              allPackages[packageIndex] = {
                ...allPackages[packageIndex],
                status: content.status || allPackages[packageIndex].status,
                courier_pubkey:
                  content.courier_pubkey ||
                  allPackages[packageIndex].courier_pubkey,
                pickup_time:
                  content.pickup_time || allPackages[packageIndex].pickup_time,
                delivery_time:
                  content.delivery_time ||
                  allPackages[packageIndex].delivery_time,
              };
            }

            // Also update the status map
            if (packageStatusMap.has(content.package_id)) {
              const existingDelivery = packageStatusMap.get(
                content.package_id
              )!;
              packageStatusMap.set(content.package_id, {
                ...existingDelivery,
                status: content.status || existingDelivery.status,
                courier_pubkey:
                  content.courier_pubkey || existingDelivery.courier_pubkey,
                pickup_time:
                  content.pickup_time || existingDelivery.pickup_time,
                delivery_time:
                  content.delivery_time || existingDelivery.delivery_time,
              });
            } else {
              // If we don't have this delivery in our map yet, try to find the package
              const pkg = allPackages.find((p) => p.id === content.package_id);
              if (pkg) {
                packageStatusMap.set(content.package_id, {
                  ...pkg,
                  status: content.status || 'in_transit',
                  courier_pubkey: content.courier_pubkey,
                  pickup_time: content.pickup_time,
                  delivery_time: content.delivery_time,
                });
              }
            }
          }
        } catch (e) {
          console.error('Error processing delivery event:', e);
        }
      }

      // Update package status based on the status map
      for (let i = 0; i < allPackages.length; i++) {
        const pkg = allPackages[i];
        if (packageStatusMap.has(pkg.id)) {
          const delivery = packageStatusMap.get(pkg.id)!;
          allPackages[i] = {
            ...pkg,
            status: delivery.status,
            courier_pubkey: delivery.courier_pubkey,
            pickup_time: delivery.pickup_time,
            delivery_time: delivery.delivery_time,
          };
        }
      }

      // Filter packages:
      // 1. Include all packages with status "available"
      // 2. Include packages created by the current user regardless of status
      const filteredPackages = allPackages.filter(
        (pkg) => pkg.status === 'available' || pkg.pubkey === currentPubkey
      );

      console.log(
        `Returning ${filteredPackages.length} packages (available + user's own)`
      );
      return filteredPackages;
    } catch (nostrError) {
      console.error(
        'Error fetching from Nostr, returning only local packages:',
        nostrError
      );

      // Apply the same filtering logic to local packages
      const filteredLocalPackages = localPackages.filter(
        (pkg) => pkg.status === 'available' || pkg.pubkey === currentPubkey
      );

      // Update status based on deliveries
      for (let i = 0; i < filteredLocalPackages.length; i++) {
        const pkg = filteredLocalPackages[i];
        if (packageStatusMap.has(pkg.id)) {
          const delivery = packageStatusMap.get(pkg.id)!;
          filteredLocalPackages[i] = {
            ...pkg,
            status: delivery.status,
            courier_pubkey: delivery.courier_pubkey,
            pickup_time: delivery.pickup_time,
            delivery_time: delivery.delivery_time,
          };
        }
      }

      return filteredLocalPackages;
    }
  } catch (error) {
    console.error('Failed to fetch packages:', error);
    // Last resort fallback - just return available packages from localStorage
    return getLocalPackages().filter(
      (pkg) => pkg.status === 'available' || pkg.pubkey === getUserPubkey()
    );
  }
}

// Update the getMyDeliveries function to ensure it only returns in_transit packages
// and handle Nostr extension errors gracefully
export async function getMyDeliveries(): Promise<PackageData[]> {
  let localDeliveries = getMyLocalDeliveries().filter(
    (pkg) => pkg.status === 'in_transit'
  );
  try {
    console.log('Fetching my deliveries from Nostr and localStorage...');

    // Get local deliveries first - ONLY in_transit ones
    localDeliveries = getMyLocalDeliveries().filter(
      (pkg) => pkg.status === 'in_transit'
    );
    console.log(`Found ${localDeliveries.length} local in_transit deliveries`);

    // If we have local deliveries, return them immediately to avoid getting stuck
    if (localDeliveries.length > 0) {
      console.log('Returning local deliveries immediately');

      // Try to fetch from Nostr in the background
      setTimeout(async () => {
        try {
          await fetchNostrDeliveries();
        } catch (error) {
          console.error('Background Nostr fetch failed:', error);
        }
      }, 100);

      return localDeliveries;
    }

    // If no local deliveries, try Nostr with a timeout
    const timeoutPromise = new Promise<PackageData[]>((resolve) => {
      setTimeout(() => {
        console.log('Nostr fetch timed out, returning local deliveries only');
        resolve(localDeliveries);
      }, 3000); // 3 second timeout
    });

    // Race between Nostr fetch and timeout
    return Promise.race([fetchNostrDeliveries(), timeoutPromise]);
  } catch (error) {
    console.error('Failed to fetch deliveries:', error);
    // Fallback to localStorage if Nostr fails, but only return in_transit deliveries
    return getMyLocalDeliveries().filter((pkg) => pkg.status === 'in_transit');
  }

  // Helper function to fetch from Nostr
  async function fetchNostrDeliveries(): Promise<PackageData[]> {
    try {
      // Get delivery events for the current user
      const events = await listEvents(
        [
          {
            kinds: [EVENT_KINDS.DELIVERY],
            authors: [getUserPubkey()],
            limit: 100,
          },
        ],
        5000 // Shorter timeout
      );

      console.log(`Found ${events.length} delivery events from Nostr`);

      // Filter and parse deliveries
      const currentPubkey = getUserPubkey();
      const myDeliveries = [];

      for (const event of events) {
        try {
          const content = JSON.parse(event.content);

          // Only include deliveries for the current user that are in_transit
          if (
            content.courier_pubkey === currentPubkey &&
            content.status === 'in_transit'
          ) {
            // Get the original package event
            const packageEvent = await getEventById(content.package_id);

            if (packageEvent) {
              // Combine package and delivery data
              const packageData = parsePackageFromEvent(packageEvent);
              if (packageData) {
                myDeliveries.push({
                  ...packageData,
                  status: 'in_transit', // Force status to in_transit
                  courier_pubkey: content.courier_pubkey,
                  pickup_time: content.pickup_time,
                  delivery_time: content.delivery_time,
                });
              }
            }
          }
        } catch (e) {
          console.error('Error parsing delivery event:', e);
        }
      }

      console.log(
        `Found ${myDeliveries.length} in_transit deliveries from Nostr`
      );

      // Combine local and Nostr deliveries, removing duplicates
      const allDeliveries = [...localDeliveries];

      // Add Nostr deliveries that aren't already in local deliveries
      for (const nostrDelivery of myDeliveries) {
        if (!allDeliveries.some((pkg) => pkg.id === nostrDelivery.id)) {
          allDeliveries.push(nostrDelivery);
        }
      }

      console.log(
        `Returning ${allDeliveries.length} total in_transit deliveries`
      );
      return allDeliveries;
    } catch (error) {
      console.error('Error fetching from Nostr:', error);
      return localDeliveries;
    }
  }
}

// Get a specific package by ID
export async function getPackageById(id: string): Promise<PackageData | null> {
  try {
    console.log(`Fetching package with ID: ${id} from Nostr`);

    // Get the package event
    const event = await getEventById(id);

    if (event) {
      console.log('Package found in Nostr');
      return parsePackageFromEvent(event);
    }

    // If not found as a package, check deliveries
    const deliveryEvents = await listEvents(
      [
        {
          kinds: [EVENT_KINDS.DELIVERY],
          '#package_id': [id],
          limit: 10,
        },
      ],
      5000
    );

    if (deliveryEvents.length > 0) {
      const deliveryEvent = deliveryEvents[0];
      const content = JSON.parse(deliveryEvent.content);

      // Get the original package event
      const packageEvent = await getEventById(content.package_id);

      if (packageEvent) {
        const packageData = parsePackageFromEvent(packageEvent);

        return {
          ...packageData,
          status: content.status || 'in_transit',
          courier_pubkey: content.courier_pubkey,
          pickup_time: content.pickup_time,
          delivery_time: content.delivery_time,
        };
      }
    }

    console.log('Package not found in Nostr, checking localStorage');
    return getLocalPackageById(id);
  } catch (error) {
    console.error('Failed to fetch package:', error);
    // Fallback to localStorage if Nostr fails
    return getLocalPackageById(id);
  }
}

// Update the pickupPackage function to pass the package data to pickupLocalPackage
export async function pickupPackage(packageId: string): Promise<void> {
  try {
    console.log(`Picking up package with ID: ${packageId}`);

    // First, get the package data
    const packageData = await getPackageById(packageId);

    if (!packageData) {
      throw new Error('Package not found in Nostr or local storage');
    }

    console.log('Found package data:', packageData);

    // Pick up the package locally with the package data
    pickupLocalPackage(packageId, packageData);
    console.log('Package picked up in localStorage');

    // Then try to update Nostr
    try {
      // Create delivery content
      const content = {
        package_id: packageId,
        status: 'in_transit',
        courier_pubkey: getUserPubkey(),
        pickup_time: Math.floor(Date.now() / 1000),
      };

      // Create and sign the delivery event
      const event = await createSignedEvent(
        EVENT_KINDS.DELIVERY,
        JSON.stringify(content),
        [
          ['t', 'delivery'],
          ['package_id', packageId],
        ]
      );

      // Publish the event
      await publishEvent(event);

      console.log('Package picked up successfully in Nostr');
    } catch (nostrError) {
      console.error(
        "Failed to pick up package in Nostr, but it's picked up in localStorage:",
        nostrError
      );
      // No need to throw here since we already updated localStorage
    }
  } catch (error) {
    console.error('Failed to pick up package:', error);
    throw error;
  }
}

// Update the completeDelivery function to ensure proper status updates
export async function completeDelivery(packageId: string): Promise<void> {
  try {
    console.log(`Completing delivery for package with ID: ${packageId}`);

    // First, complete the delivery locally
    completeLocalDelivery(packageId);
    console.log('Delivery completed in localStorage');

    // Then try to update Nostr
    try {
      // Get existing delivery events for this package
      const deliveryEvents = await listEvents(
        [
          {
            kinds: [EVENT_KINDS.DELIVERY],
            '#package_id': [packageId],
            limit: 10,
          },
        ],
        5000
      );

      if (deliveryEvents.length === 0) {
        console.log('No delivery events found in Nostr, creating a new one');

        // Create a new delivery event with status=delivered
        const content = {
          package_id: packageId,
          status: 'delivered',
          courier_pubkey: getUserPubkey(),
          pickup_time: Math.floor(Date.now() / 1000) - 3600, // Assume picked up an hour ago
          delivery_time: Math.floor(Date.now() / 1000),
        };

        // Create and sign the delivery event
        const event = await createSignedEvent(
          EVENT_KINDS.DELIVERY,
          JSON.stringify(content),
          [
            ['t', 'delivery'],
            ['package_id', packageId],
          ]
        );

        // Publish the event
        await publishEvent(event);
        console.log('Created new delivery event with status=delivered');
        return;
      }

      // Get the most recent delivery event
      const deliveryEvent = deliveryEvents[0];
      let content;

      try {
        content = JSON.parse(deliveryEvent.content);
      } catch (error) {
        console.error('Failed to parse delivery event content:', error);
        content = {
          package_id: packageId,
          status: 'in_transit',
          courier_pubkey: getUserPubkey(),
        };
      }

      // Update the content
      const updatedContent = {
        ...content,
        status: 'delivered',
        delivery_time: Math.floor(Date.now() / 1000),
      };

      console.log('Updating delivery event with new content:', updatedContent);

      // Create and sign the updated delivery event
      const event = await createSignedEvent(
        EVENT_KINDS.DELIVERY,
        JSON.stringify(updatedContent),
        [
          ['t', 'delivery'],
          ['package_id', packageId],
        ]
      );

      // Publish the event
      await publishEvent(event);

      console.log('Delivery completed successfully in Nostr');
    } catch (nostrError) {
      console.error(
        "Failed to complete delivery in Nostr, but it's completed in localStorage:",
        nostrError
      );
      // No need to throw here since we already updated localStorage
    }
  } catch (error) {
    console.error('Failed to complete delivery:', error);
    throw error;
  }
}

// Confirm delivery (by recipient)
export async function confirmDelivery(packageId: string): Promise<void> {
  // For now, this is the same as completeDelivery
  await completeDelivery(packageId);
}

// Get user profile
export async function getUserProfile(pubkey?: string): Promise<ProfileData> {
  try {
    const userPubkey = pubkey || getUserPubkey();

    // Get user's delivery events to count completed deliveries
    const deliveryEvents = await listEvents(
      [
        {
          kinds: [EVENT_KINDS.DELIVERY],
          authors: [userPubkey],
          limit: 50,
        },
      ],
      5000
    );

    // Count completed deliveries
    const completedDeliveries = deliveryEvents.filter((event) => {
      try {
        const content = JSON.parse(event.content);
        return content.status === 'delivered';
      } catch (e) {
        return false;
      }
    }).length;

    // Try to get user metadata from kind 0 events
    const metadataEvents = await listEvents(
      [
        {
          kinds: [0],
          authors: [userPubkey],
          limit: 1,
        },
      ],
      3000
    );

    let name = 'bfleet_user';
    let displayName = 'Bfleet User';
    let picture = '';

    if (metadataEvents.length > 0) {
      try {
        const metadata = JSON.parse(metadataEvents[0].content);
        name = metadata.name || name;
        displayName = metadata.display_name || metadata.displayName || name;
        picture = metadata.picture || '';
      } catch (e) {
        console.error('Error parsing user metadata:', e);
      }
    }

    return {
      pubkey: userPubkey,
      name,
      displayName,
      picture,
      followers: 0, // Not implemented in MVP
      following: 0, // Not implemented in MVP
      deliveries: completedDeliveries,
      rating: completedDeliveries > 0 ? 4.5 : 0, // Simplified rating for MVP
    };
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return {
      pubkey: pubkey || getUserPubkey(),
      name: 'bfleet_user',
      displayName: 'Bfleet User',
      followers: 0,
      following: 0,
      deliveries: 0,
      rating: 0,
    };
  }
}

// Update profile
export async function updateProfile(profileData: {
  name?: string;
  displayName?: string;
  picture?: string;
  about?: string;
  website?: string;
  nip05?: string;
}): Promise<void> {
  try {
    // Create metadata content according to NIP-01
    const content = {
      name: profileData.name,
      display_name: profileData.displayName,
      picture: profileData.picture,
      about: profileData.about,
      website: profileData.website,
      nip05: profileData.nip05,
    };

    // Create and sign the metadata event (kind 0)
    const event = await createSignedEvent(
      0, // Kind 0 is for metadata
      JSON.stringify(content),
      []
    );

    // Publish the event
    await publishEvent(event);

    console.log('Profile updated successfully');
  } catch (error) {
    console.error('Failed to update profile:', error);
    throw error;
  }
}
