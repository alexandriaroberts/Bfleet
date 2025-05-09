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

// Update the createPackage function to ensure packages are saved to localStorage
export async function createPackage(
  packageData: Omit<PackageData, 'id' | 'status'>
): Promise<string> {
  try {
    // Create the content object
    const content = {
      ...packageData,
      status: 'available',
    };

    // First save to localStorage to ensure we have a backup
    const localId = saveLocalPackage(packageData);
    console.log('Package saved to localStorage with ID:', localId);

    // Try to create and sign the event with Nostr
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
      return event.id;
    } catch (nostrError) {
      console.error('Nostr error, using localStorage ID instead:', nostrError);
      return localId;
    }
  } catch (error) {
    console.error('Failed to create package:', error);
    // Last resort fallback
    return saveLocalPackage(packageData);
  }
}

// Update the getPackages function to handle null values from parsePackageFromEvent
export async function getPackages(): Promise<PackageData[]> {
  try {
    console.log('Fetching packages from Nostr...');

    // Get local packages first
    const localPackages = getLocalPackages();
    console.log(`Found ${localPackages.length} local packages`);

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

      if (events.length === 0) {
        // If no Nostr packages, just return local packages
        return localPackages;
      }

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

      console.log(
        `Returning ${allPackages.length} total packages (local + Nostr)`
      );
      return allPackages;
    } catch (nostrError) {
      console.error(
        'Error fetching from Nostr, returning only local packages:',
        nostrError
      );
      return localPackages;
    }
  } catch (error) {
    console.error('Failed to fetch packages:', error);
    return getLocalPackages();
  }
}

// Get user's active deliveries
export async function getMyDeliveries(): Promise<PackageData[]> {
  try {
    console.log('Fetching my deliveries from Nostr...');

    // Get delivery events for the current user
    const events = await listEvents(
      [
        {
          kinds: [EVENT_KINDS.DELIVERY],
          authors: [getUserPubkey()],
          limit: 100,
        },
      ],
      10000
    );

    console.log(`Found ${events.length} delivery events`);

    // Filter and parse deliveries
    const currentPubkey = getUserPubkey();
    const myDeliveries = [];

    for (const event of events) {
      try {
        const content = JSON.parse(event.content);

        // Only include deliveries for the current user
        if (content.courier_pubkey === currentPubkey) {
          // Get the original package event
          const packageEvent = await getEventById(content.package_id);

          if (packageEvent) {
            // Combine package and delivery data
            const packageData = parsePackageFromEvent(packageEvent);

            myDeliveries.push({
              ...packageData,
              status: content.status || 'in_transit',
              courier_pubkey: content.courier_pubkey,
              pickup_time: content.pickup_time,
              delivery_time: content.delivery_time,
            });
          }
        }
      } catch (e) {
        console.error('Error parsing delivery event:', e);
      }
    }

    console.log(`Returning ${myDeliveries.length} deliveries`);

    // If no deliveries found in Nostr, try localStorage
    if (myDeliveries.length === 0) {
      return getMyLocalDeliveries();
    }

    return myDeliveries;
  } catch (error) {
    console.error('Failed to fetch deliveries:', error);
    // Fallback to localStorage if Nostr fails
    return getMyLocalDeliveries();
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

// Pick up a package
export async function pickupPackage(packageId: string): Promise<void> {
  try {
    console.log(`Picking up package with ID: ${packageId}`);

    // First, pick up the package locally to ensure it's always updated
    pickupLocalPackage(packageId);
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

// Complete a delivery
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
        console.log('No delivery events found in Nostr, skipping Nostr update');
        return;
      }

      // Get the most recent delivery event
      const deliveryEvent = deliveryEvents[0];
      const content = JSON.parse(deliveryEvent.content);

      // Update the content
      const updatedContent = {
        ...content,
        status: 'delivered',
        delivery_time: Math.floor(Date.now() / 1000),
      };

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
