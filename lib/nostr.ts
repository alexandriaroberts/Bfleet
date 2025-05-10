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
import { getRelays } from './nostr-service';
// Define storage keys directly (matching the ones in local-package-service.ts)
const PACKAGES_STORAGE_KEY = 'shared_packages_v1';
const MY_DELIVERIES_STORAGE_KEY = 'my_deliveries_v2';

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

// Update the parsePackageFromEvent function to be more robust against non-JSON content
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

    // Try to parse the content
    let content;
    try {
      // First check if the content starts with a { character to avoid obvious non-JSON
      if (!event.content.trim().startsWith('{')) {
        console.log(`Skipping non-JSON content in event ${event.id}`);
        return null;
      }

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

// Add this helper function to safely parse JSON with a fallback
function safeParseJSON(jsonString: string, fallback: any = null): any {
  try {
    // First check if the string starts with a { character to avoid obvious non-JSON
    if (!jsonString.trim().startsWith('{')) {
      return fallback;
    }
    return JSON.parse(jsonString);
  } catch (e) {
    console.log('Failed to parse JSON:', e);
    return fallback;
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
          const content = safeParseJSON(event.content);
          if (!content || !content.package_id) continue;

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
            const existingDelivery = packageStatusMap.get(content.package_id)!;
            packageStatusMap.set(content.package_id, {
              ...existingDelivery,
              status: content.status || existingDelivery.status,
              courier_pubkey:
                content.courier_pubkey || existingDelivery.courier_pubkey,
              pickup_time: content.pickup_time || existingDelivery.pickup_time,
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
          const content = safeParseJSON(event.content);
          if (!content) continue;

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

    // First, complete locally
    completeLocalDelivery(packageId);
    console.log('Delivery completed in localStorage');

    // Try multiple relays with retry logic
    const relays = getRelays();
    let successCount = 0;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1} to update Nostr relays`);

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

        // Create updated content
        let content;

        if (deliveryEvents.length === 0) {
          console.log('No delivery events found in Nostr, creating a new one');
          content = {
            package_id: packageId,
            status: 'delivered',
            courier_pubkey: getUserPubkey(),
            pickup_time: Math.floor(Date.now() / 1000) - 3600, // Assume picked up an hour ago
            delivery_time: Math.floor(Date.now() / 1000),
            update_id: `${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 9)}`,
          };
        } else {
          // Get the most recent delivery event
          const deliveryEvent = deliveryEvents[0];

          try {
            content = safeParseJSON(deliveryEvent.content, {
              package_id: packageId,
              status: 'in_transit',
              courier_pubkey: getUserPubkey(),
            });
          } catch (error) {
            console.error('Failed to parse delivery event content:', error);
            content = {
              package_id: packageId,
              status: 'in_transit',
              courier_pubkey: getUserPubkey(),
            };
          }

          // Update the content
          content = {
            ...content,
            status: 'delivered',
            delivery_time: Math.floor(Date.now() / 1000),
            update_id: `${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 9)}`,
          };
        }

        console.log('Updating delivery event with new content:', content);

        // Create and sign the updated delivery event
        const event = await createSignedEvent(
          EVENT_KINDS.DELIVERY,
          JSON.stringify(content),
          [
            ['t', 'delivery'],
            ['package_id', packageId],
            ['status', 'delivered'], // Add explicit tag for better filtering
          ]
        );

        // Try to publish to all relays
        const results = await publishEvent(event);
        successCount = results.filter((r) => !r.startsWith('failed:')).length;

        if (successCount > 0) {
          console.log(
            `Successfully published to ${successCount}/${relays.length} relays`
          );
          break; // At least some relays got the update
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Attempt ${attempt + 1} failed:`, error);
      }
    }

    if (successCount === 0) {
      console.warn('Could not update any relays, but local storage is updated');
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

// Status verification system
export async function verifyPackageStatuses(): Promise<void> {
  try {
    console.log('Starting package status verification...');

    // Get all local packages and deliveries
    const localPackages = getLocalPackages();
    const localDeliveries = getAllLocalDeliveries();

    console.log(
      `Verifying ${localPackages.length} packages and ${localDeliveries.length} deliveries`
    );

    // Check Nostr for updates on these packages
    const packageIds = [
      ...localPackages.map((p) => p.id),
      ...localDeliveries.map((d) => d.id),
    ];

    // Remove duplicates
    const uniquePackageIds = [...new Set(packageIds)];
    console.log(`Checking ${uniquePackageIds.length} unique package IDs`);

    // Batch into groups of 10 to avoid overloading
    for (let i = 0; i < uniquePackageIds.length; i += 10) {
      const batch = uniquePackageIds.slice(i, i + 10);
      console.log(`Processing batch ${i / 10 + 1}: ${batch.join(', ')}`);

      // Query for delivery events for these packages
      const events = await listEvents(
        [
          {
            kinds: [EVENT_KINDS.DELIVERY],
            '#package_id': batch,
            limit: 50,
          },
        ],
        5000
      );

      console.log(`Found ${events.length} delivery events for this batch`);

      // Process events to update local status
      for (const event of events) {
        try {
          const content = JSON.parse(event.content);
          if (content.package_id && content.status) {
            console.log(
              `Found status update for package ${content.package_id}: ${content.status}`
            );
            // Update local storage with the latest status
            updateLocalPackageStatus(
              content.package_id,
              content.status,
              content
            );
          }
        } catch (e) {
          console.error('Error processing event:', e);
        }
      }
    }

    console.log('Package status verification complete');
  } catch (error) {
    console.error('Failed to verify package statuses:', error);
  }
}

// Helper function to update local storage
function updateLocalPackageStatus(
  packageId: string,
  status: string,
  data: any
): void {
  try {
    // Update in available packages
    const packages = JSON.parse(
      localStorage.getItem(PACKAGES_STORAGE_KEY) || '[]'
    );
    let updated = false;

    for (let i = 0; i < packages.length; i++) {
      if (packages[i].id === packageId) {
        console.log(
          `Updating package ${packageId} in shared_packages_v1: ${packages[i].status} -> ${status}`
        );
        packages[i].status = status;
        if (data.courier_pubkey)
          packages[i].courier_pubkey = data.courier_pubkey;
        if (data.pickup_time) packages[i].pickup_time = data.pickup_time;
        if (data.delivery_time) packages[i].delivery_time = data.delivery_time;
        updated = true;
      }
    }

    if (updated) {
      localStorage.setItem(PACKAGES_STORAGE_KEY, JSON.stringify(packages));
    }

    // Update in deliveries
    const deliveries = JSON.parse(
      localStorage.getItem(MY_DELIVERIES_STORAGE_KEY) || '[]'
    );
    updated = false;

    for (let i = 0; i < deliveries.length; i++) {
      if (deliveries[i].id === packageId) {
        console.log(
          `Updating package ${packageId} in my_deliveries_v2: ${deliveries[i].status} -> ${status}`
        );
        deliveries[i].status = status;
        if (data.courier_pubkey)
          deliveries[i].courier_pubkey = data.courier_pubkey;
        if (data.pickup_time) deliveries[i].pickup_time = data.pickup_time;
        if (data.delivery_time)
          deliveries[i].delivery_time = data.delivery_time;
        updated = true;
      }
    }

    if (updated) {
      localStorage.setItem(
        MY_DELIVERIES_STORAGE_KEY,
        JSON.stringify(deliveries)
      );
    }
  } catch (error) {
    console.error('Failed to update local package status:', error);
  }
}

// Helper function to get the most accurate status of a package
export function getEffectiveStatus(
  pkg: PackageData
): 'available' | 'in_transit' | 'delivered' {
  // If it has a delivery_time, it should be considered delivered regardless of status field
  if (pkg.delivery_time && pkg.delivery_time > 0) {
    return 'delivered';
  }

  // If it has a pickup_time but no delivery_time, it should be in_transit
  if (
    pkg.pickup_time &&
    pkg.pickup_time > 0 &&
    (!pkg.delivery_time || pkg.delivery_time === 0)
  ) {
    return 'in_transit';
  }

  // Otherwise use the status field
  return pkg.status;
}

// Force a complete refresh of package status
export async function forceStatusRefresh(): Promise<void> {
  try {
    console.log('Starting forced status refresh...');

    // Get all packages and deliveries from localStorage
    const packagesJson = localStorage.getItem('shared_packages_v1') || '[]';
    const deliveriesJson = localStorage.getItem('my_deliveries_v2') || '[]';

    const packages = JSON.parse(packagesJson);
    const deliveries = JSON.parse(deliveriesJson);

    console.log(
      `Found ${packages.length} packages and ${deliveries.length} deliveries in localStorage`
    );

    // Get all package IDs
    const packageIds = [
      ...packages.map((pkg: any) => pkg.id),
      ...deliveries.map((del: any) => del.id),
    ];

    // Remove duplicates
    const uniqueIds = [...new Set(packageIds)];
    console.log(`Processing ${uniqueIds.length} unique package IDs`);

    // Import required functions
    const { listEvents, EVENT_KINDS } = await import('./nostr-service');

    // Fetch all delivery events for these packages
    const events = await listEvents(
      [
        {
          kinds: [EVENT_KINDS.DELIVERY],
          limit: 200,
        },
      ],
      10000
    );

    console.log(`Found ${events.length} delivery events`);

    // Process each event to find the latest status for each package
    const latestStatusMap = new Map();

    for (const event of events) {
      try {
        const content = safeParseJSON(event.content);
        if (!content || !content.package_id) continue;

        // If we don't have this package ID in our map yet, or this event is newer
        if (
          !latestStatusMap.has(content.package_id) ||
          latestStatusMap.get(content.package_id).created_at < event.created_at
        ) {
          latestStatusMap.set(content.package_id, {
            status: content.status,
            courier_pubkey: content.courier_pubkey,
            pickup_time: content.pickup_time,
            delivery_time: content.delivery_time,
            created_at: event.created_at,
          });
        }
      } catch (e) {
        console.error('Error processing event:', e);
      }
    }

    // Update packages in localStorage
    let packagesUpdated = 0;
    let deliveriesUpdated = 0;

    // Update packages
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      if (latestStatusMap.has(pkg.id)) {
        const latestStatus = latestStatusMap.get(pkg.id);

        // Only update if the status is different
        if (pkg.status !== latestStatus.status) {
          console.log(
            `Updating package ${pkg.id}: ${pkg.status} -> ${latestStatus.status}`
          );
          packages[i] = {
            ...pkg,
            status: latestStatus.status,
            courier_pubkey: latestStatus.courier_pubkey || pkg.courier_pubkey,
            pickup_time: latestStatus.pickup_time || pkg.pickup_time,
            delivery_time: latestStatus.delivery_time || pkg.delivery_time,
          };
          packagesUpdated++;
        }
      }
    }

    // Update deliveries
    for (let i = 0; i < deliveries.length; i++) {
      const delivery = deliveries[i];
      if (latestStatusMap.has(delivery.id)) {
        const latestStatus = latestStatusMap.get(delivery.id);

        // Only update if the status is different
        if (delivery.status !== latestStatus.status) {
          console.log(
            `Updating delivery ${delivery.id}: ${delivery.status} -> ${latestStatus.status}`
          );
          deliveries[i] = {
            ...delivery,
            status: latestStatus.status,
            courier_pubkey:
              latestStatus.courier_pubkey || delivery.courier_pubkey,
            pickup_time: latestStatus.pickup_time || delivery.pickup_time,
            delivery_time: latestStatus.delivery_time || delivery.delivery_time,
          };
          deliveriesUpdated++;
        }
      }
    }

    // Save updated data back to localStorage
    if (packagesUpdated > 0) {
      localStorage.setItem('shared_packages_v1', JSON.stringify(packages));
    }

    if (deliveriesUpdated > 0) {
      localStorage.setItem('my_deliveries_v2', JSON.stringify(deliveries));
    }

    console.log(
      `Status refresh complete. Updated ${packagesUpdated} packages and ${deliveriesUpdated} deliveries.`
    );
    return Promise.resolve();
  } catch (error) {
    console.error('Error in forceStatusRefresh:', error);
    return Promise.reject(error);
  }
}
