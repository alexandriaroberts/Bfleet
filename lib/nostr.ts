import { type Event, finalizeEvent, getEventHash } from 'nostr-tools';
import {
  getUserKeys,
  signWithExtension,
  hasNostrExtension,
} from './nostr-keys';
import { EVENT_KINDS, type PackageData, type ProfileData } from './nostr-types';
import { publishEvent, listEvents, getEventById } from './nostr-service';

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

// Helper function to sign events (tries extension first, falls back to local keys)
async function signEventHelper(event: Event): Promise<Event> {
  if (hasNostrExtension()) {
    try {
      const signedEvent = await signWithExtension(event);
      if (signedEvent) return signedEvent;
    } catch (error) {
      console.error(
        'Failed to sign with extension, falling back to local keys:',
        error
      );
    }
  }

  // Fall back to local keys
  const privateKey = localStorage.getItem('nostr_privkey');
  if (!privateKey) {
    throw new Error('No private key available for signing');
  }

  // Create a complete event
  const eventWithId = {
    ...event,
    id: getEventHash(event),
  };

  return finalizeEvent(eventWithId, privateKey);
}

// Create a new package listing with better error handling
export async function createPackage(
  packageData: Omit<PackageData, 'id' | 'status'>
): Promise<string> {
  try {
    const publicKey = getUserPubkey();

    // Create event content
    const content = JSON.stringify({
      title: packageData.title,
      pickupLocation: packageData.pickupLocation,
      destination: packageData.destination,
      cost: packageData.cost,
      description: packageData.description || '',
    });

    // Create event with tags
    const event: Event = {
      kind: EVENT_KINDS.PACKAGE_LISTING,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'atob-package'],
        ['pickup', packageData.pickupLocation],
        ['destination', packageData.destination],
        ['cost', packageData.cost],
      ],
      content,
      pubkey: publicKey,
      id: '',
      sig: '',
    };

    // Sign event
    const signedEvent = await signEventHelper(event);
    console.log('Signed event:', signedEvent);

    // Publish to relays
    const pubs = await publishEvent(signedEvent);
    console.log('Published to relays:', pubs);

    // Store the package locally for development purposes
    const localPackages = JSON.parse(
      localStorage.getItem('local_packages') || '[]'
    );
    localPackages.push({
      id: signedEvent.id,
      title: packageData.title,
      pickupLocation: packageData.pickupLocation,
      destination: packageData.destination,
      cost: packageData.cost,
      description: packageData.description || '',
      status: 'available',
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
    });
    localStorage.setItem('local_packages', JSON.stringify(localPackages));

    return signedEvent.id;
  } catch (error) {
    console.error('Failed to create package:', error);
    throw error;
  }
}

// Get all available packages
export async function getPackages(): Promise<PackageData[]> {
  try {
    console.log('Fetching packages from relays...');

    // Try to fetch from relays first
    const events = await listEvents(
      [
        {
          kinds: [EVENT_KINDS.PACKAGE_LISTING],
          '#t': ['atob-package'],
        },
      ],
      5000
    ); // 5 second timeout

    console.log(`Fetched ${events.length} package events from relays`);

    // Get pickup events to filter out packages that have been picked up
    const pickupEvents = await listEvents(
      [
        {
          kinds: [EVENT_KINDS.PACKAGE_PICKUP],
        },
      ],
      3000
    ); // 3 second timeout

    console.log(`Fetched ${pickupEvents.length} pickup events from relays`);

    // Get IDs of packages that have been picked up
    const pickedUpIds = pickupEvents
      .map((event) => {
        const eTag = event.tags.find((tag) => tag[0] === 'e');
        return eTag ? eTag[1] : null;
      })
      .filter(Boolean);

    console.log(`Found ${pickedUpIds.length} picked up package IDs`);

    // Parse events into package data, filtering out picked up packages
    const packages = events
      .filter((event) => !pickedUpIds.includes(event.id))
      .map((event) => {
        try {
          const content = JSON.parse(event.content);
          return {
            id: event.id,
            title: content.title,
            pickupLocation: content.pickupLocation,
            destination: content.destination,
            cost: content.cost,
            description: content.description,
            status: 'available',
            pubkey: event.pubkey,
          };
        } catch (e) {
          console.error('Failed to parse package event:', e);
          return null;
        }
      })
      .filter(Boolean) as PackageData[];

    console.log(
      `Parsed ${packages.length} available packages from relay events`
    );

    // Get packages from local storage as fallback
    const localPackages = JSON.parse(
      localStorage.getItem('local_packages') || '[]'
    );
    console.log(`Found ${localPackages.length} packages in local storage`);

    // Filter out packages that have been picked up
    const myDeliveries = JSON.parse(
      localStorage.getItem('my_deliveries') || '[]'
    );
    const localPickedUpIds = myDeliveries.map((pkg: PackageData) => pkg.id);

    const availableLocalPackages = localPackages.filter(
      (pkg: PackageData) =>
        !localPickedUpIds.includes(pkg.id) && !pickedUpIds.includes(pkg.id)
    );

    // Combine packages from relays and local storage, removing duplicates
    const relayIds = packages.map((pkg) => pkg.id);
    const uniqueLocalPackages = availableLocalPackages.filter(
      (pkg: PackageData) => !relayIds.includes(pkg.id)
    );

    const allPackages = [...packages, ...uniqueLocalPackages];
    console.log(`Returning ${allPackages.length} total available packages`);

    return allPackages;
  } catch (error) {
    console.error('Failed to fetch packages:', error);

    // Fallback to local storage if relay fetch fails
    const localPackages = JSON.parse(
      localStorage.getItem('local_packages') || '[]'
    );
    const myDeliveries = JSON.parse(
      localStorage.getItem('my_deliveries') || '[]'
    );
    const pickedUpIds = myDeliveries.map((pkg: PackageData) => pkg.id);

    return localPackages.filter(
      (pkg: PackageData) => !pickedUpIds.includes(pkg.id)
    );
  }
}

// Get user's active deliveries
export async function getMyDeliveries(): Promise<PackageData[]> {
  try {
    const pubkey = getUserPubkey();
    console.log('Fetching my deliveries with pubkey:', pubkey);

    // Fetch pickup events from relays
    const pickupEvents = await listEvents(
      [
        {
          kinds: [EVENT_KINDS.PACKAGE_PICKUP],
          authors: [pubkey],
        },
      ],
      5000
    );

    console.log(`Fetched ${pickupEvents.length} pickup events from relays`);

    // Get the package IDs from the events
    const packageIds = pickupEvents
      .map((event) => {
        const eTag = event.tags.find((tag) => tag[0] === 'e');
        return eTag ? eTag[1] : null;
      })
      .filter(Boolean);

    console.log(`Found ${packageIds.length} package IDs from pickup events`);

    // Fetch the original package events
    const packagePromises = packageIds.map((id) => getEventById(id as string));
    const packageEvents = await Promise.all(packagePromises);
    const validPackageEvents = packageEvents.filter(Boolean) as Event[];

    console.log(
      `Fetched ${validPackageEvents.length} package events from relays`
    );

    // Get delivery events to check which packages have been delivered
    const deliveryEvents = await listEvents(
      [
        {
          kinds: [EVENT_KINDS.PACKAGE_DELIVERY],
        },
      ],
      3000
    );

    console.log(`Fetched ${deliveryEvents.length} delivery events from relays`);

    // Get IDs of packages that have been delivered
    const deliveredIds = deliveryEvents
      .map((event) => {
        const eTag = event.tags.find((tag) => tag[0] === 'e');
        return eTag ? eTag[1] : null;
      })
      .filter(Boolean);

    // Parse events into package data
    const relayDeliveries = validPackageEvents
      .map((event) => {
        try {
          const content = JSON.parse(event.content);
          const isDelivered = deliveredIds.includes(event.id);

          return {
            id: event.id,
            title: content.title,
            pickupLocation: content.pickupLocation,
            destination: content.destination,
            cost: content.cost,
            description: content.description,
            status: isDelivered ? 'delivered' : 'in_transit',
            pubkey: event.pubkey,
          };
        } catch (e) {
          console.error('Failed to parse package event:', e);
          return null;
        }
      })
      .filter(Boolean) as PackageData[];

    console.log(
      `Parsed ${relayDeliveries.length} deliveries from relay events`
    );

    // Get deliveries from local storage
    const localDeliveries = JSON.parse(
      localStorage.getItem('my_deliveries') || '[]'
    );
    console.log(`Found ${localDeliveries.length} deliveries in local storage`);

    // Combine deliveries from relays and local storage, removing duplicates
    const relayIds = relayDeliveries.map((pkg) => pkg.id);
    const uniqueLocalDeliveries = localDeliveries.filter(
      (pkg: PackageData) => !relayIds.includes(pkg.id)
    );

    const allDeliveries = [...relayDeliveries, ...uniqueLocalDeliveries];
    console.log(`Returning ${allDeliveries.length} total deliveries`);

    return allDeliveries;
  } catch (error) {
    console.error('Failed to fetch deliveries:', error);

    // Fallback to local storage
    return JSON.parse(localStorage.getItem('my_deliveries') || '[]');
  }
}

// Get a specific package by ID
export async function getPackageById(id: string): Promise<PackageData | null> {
  try {
    console.log(`Fetching package with ID: ${id}`);

    // Fetch event from relays
    const event = await getEventById(id);

    if (!event) {
      console.log('Package not found in relays, checking local storage');

      // Check local storage as fallback
      const localPackages = JSON.parse(
        localStorage.getItem('local_packages') || '[]'
      );
      const localPackage = localPackages.find((pkg: any) => pkg.id === id);
      if (localPackage) {
        console.log('Package found in local storage');
        return localPackage;
      }

      // Also check my deliveries
      const myDeliveries = JSON.parse(
        localStorage.getItem('my_deliveries') || '[]'
      );
      const myDelivery = myDeliveries.find((pkg: any) => pkg.id === id);
      if (myDelivery) {
        console.log('Package found in my deliveries');
        return myDelivery;
      }

      console.log('Package not found anywhere');
      return null;
    }

    console.log('Package found in relays');

    // Parse event into package data
    try {
      const content = JSON.parse(event.content);

      // Check if this package has been picked up
      const pickupEvents = await listEvents(
        [
          {
            kinds: [EVENT_KINDS.PACKAGE_PICKUP],
            '#e': [event.id],
          },
        ],
        3000
      );

      // Check if this package has been delivered
      const deliveryEvents = await listEvents(
        [
          {
            kinds: [EVENT_KINDS.PACKAGE_DELIVERY],
            '#e': [event.id],
          },
        ],
        3000
      );

      let status: 'available' | 'in_transit' | 'delivered' = 'available';

      if (deliveryEvents.length > 0) {
        status = 'delivered';
      } else if (pickupEvents.length > 0) {
        status = 'in_transit';
      }

      return {
        id: event.id,
        title: content.title,
        pickupLocation: content.pickupLocation,
        destination: content.destination,
        cost: content.cost,
        description: content.description,
        status,
        pubkey: event.pubkey,
      };
    } catch (e) {
      console.error('Failed to parse package event:', e);
      return null;
    }
  } catch (error) {
    console.error('Failed to fetch package:', error);

    // Check local storage as fallback
    const localPackages = JSON.parse(
      localStorage.getItem('local_packages') || '[]'
    );
    const localPackage = localPackages.find((pkg: any) => pkg.id === id);
    if (localPackage) return localPackage;

    // Also check my deliveries
    const myDeliveries = JSON.parse(
      localStorage.getItem('my_deliveries') || '[]'
    );
    const myDelivery = myDeliveries.find((pkg: any) => pkg.id === id);
    if (myDelivery) return myDelivery;

    return null;
  }
}

// Pick up a package
export async function pickupPackage(packageId: string): Promise<void> {
  try {
    const publicKey = getUserPubkey();

    // Create event with tags
    const event: Event = {
      kind: EVENT_KINDS.PACKAGE_PICKUP,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', packageId], // Reference to the package event
        ['t', 'atob-pickup'],
      ],
      content: JSON.stringify({ action: 'pickup' }),
      pubkey: publicKey,
      id: '',
      sig: '',
    };

    // Sign event
    const signedEvent = await signEventHelper(event);

    // Publish to relays
    await publishEvent(signedEvent);

    // Update local storage - remove from available packages
    const localPackages = JSON.parse(
      localStorage.getItem('local_packages') || '[]'
    );
    const packageToPickup = localPackages.find(
      (pkg: any) => pkg.id === packageId
    );
    const updatedPackages = localPackages.filter(
      (pkg: any) => pkg.id !== packageId
    );
    localStorage.setItem('local_packages', JSON.stringify(updatedPackages));

    // Add to my deliveries
    if (packageToPickup) {
      const myDeliveries = JSON.parse(
        localStorage.getItem('my_deliveries') || '[]'
      );
      myDeliveries.push({
        ...packageToPickup,
        status: 'in_transit',
      });
      localStorage.setItem('my_deliveries', JSON.stringify(myDeliveries));
    } else {
      // If not in local storage, try to get from relay
      const packageData = await getPackageById(packageId);
      if (packageData) {
        const myDeliveries = JSON.parse(
          localStorage.getItem('my_deliveries') || '[]'
        );
        myDeliveries.push({
          ...packageData,
          status: 'in_transit',
        });
        localStorage.setItem('my_deliveries', JSON.stringify(myDeliveries));
      }
    }
  } catch (error) {
    console.error('Failed to pick up package:', error);
    throw error;
  }
}

// Complete a delivery
export async function completeDelivery(packageId: string): Promise<void> {
  try {
    const publicKey = getUserPubkey();

    // Create event with tags
    const event: Event = {
      kind: EVENT_KINDS.PACKAGE_DELIVERY,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', packageId], // Reference to the package event
        ['t', 'atob-delivery'],
        ['status', 'completed'],
      ],
      content: JSON.stringify({ action: 'delivery_completed' }),
      pubkey: publicKey,
      id: '',
      sig: '',
    };

    // Sign event
    const signedEvent = await signEventHelper(event);

    // Publish to relays
    await publishEvent(signedEvent);

    // Update local storage - update status in my deliveries
    const myDeliveries = JSON.parse(
      localStorage.getItem('my_deliveries') || '[]'
    );
    const updatedDeliveries = myDeliveries.map((pkg: any) =>
      pkg.id === packageId ? { ...pkg, status: 'delivered' } : pkg
    );
    localStorage.setItem('my_deliveries', JSON.stringify(updatedDeliveries));
  } catch (error) {
    console.error('Failed to complete delivery:', error);
    throw error;
  }
}

// Confirm delivery (by recipient)
export async function confirmDelivery(packageId: string): Promise<void> {
  try {
    const publicKey = getUserPubkey();

    // Create event with tags
    const event: Event = {
      kind: EVENT_KINDS.PACKAGE_DELIVERY,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', packageId], // Reference to the package event
        ['t', 'atob-delivery'],
        ['status', 'confirmed'],
      ],
      content: JSON.stringify({ action: 'delivery_confirmed' }),
      pubkey: publicKey,
      id: '',
      sig: '',
    };

    // Sign event
    const signedEvent = await signEventHelper(event);

    // Publish to relays
    await publishEvent(signedEvent);

    // Update local storage if needed
    const myDeliveries = JSON.parse(
      localStorage.getItem('my_deliveries') || '[]'
    );
    const updatedDeliveries = myDeliveries.map((pkg: any) =>
      pkg.id === packageId ? { ...pkg, status: 'delivered' } : pkg
    );
    localStorage.setItem('my_deliveries', JSON.stringify(updatedDeliveries));
  } catch (error) {
    console.error('Failed to confirm delivery:', error);
    throw error;
  }
}

// Get user profile - improved to fetch from relays
export async function getUserProfile(pubkey?: string): Promise<ProfileData> {
  try {
    const userPubkey = pubkey || getUserPubkey();

    // Fetch profile events from relays
    const events = await listEvents(
      [
        {
          kinds: [EVENT_KINDS.METADATA],
          authors: [userPubkey],
        },
      ],
      3000
    );

    if (events.length > 0) {
      // Use the most recent profile event
      const profileEvent = events.sort(
        (a, b) => b.created_at - a.created_at
      )[0];

      try {
        const profileData = JSON.parse(profileEvent.content);

        // Count deliveries
        const deliveryEvents = await listEvents(
          [
            {
              kinds: [EVENT_KINDS.PACKAGE_DELIVERY],
              authors: [userPubkey],
            },
          ],
          2000
        );

        // Simple reputation calculation
        const rating = deliveryEvents.length > 0 ? 4.5 : 0;

        return {
          pubkey: userPubkey,
          name: profileData.name,
          displayName: profileData.display_name || profileData.displayName,
          picture: profileData.picture,
          about: profileData.about,
          website: profileData.website,
          nip05: profileData.nip05,
          followers: 0,
          following: 0,
          deliveries: deliveryEvents.length,
          rating,
        };
      } catch (e) {
        console.error('Failed to parse profile event:', e);
      }
    }

    // Return default profile if no events found
    return {
      pubkey: userPubkey,
      name: 'atob_user',
      displayName: 'A to ₿ User',
      followers: 0,
      following: 0,
      deliveries: 0,
      rating: 0,
    };
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return {
      pubkey: pubkey || getUserPubkey(),
      name: 'atob_user',
      displayName: 'A to ₿ User',
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
    const publicKey = getUserPubkey();

    // Create profile content
    const content = JSON.stringify({
      name: profileData.name || '',
      display_name: profileData.displayName || '',
      picture: profileData.picture || '',
      about: profileData.about || '',
      website: profileData.website || '',
      nip05: profileData.nip05 || '',
    });

    // Create event
    const event: Event = {
      kind: EVENT_KINDS.METADATA,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content,
      pubkey: publicKey,
      id: '',
      sig: '',
    };

    // Sign event
    const signedEvent = await signEventHelper(event);

    // Publish to relays
    await publishEvent(signedEvent);
  } catch (error) {
    console.error('Failed to update profile:', error);
    throw error;
  }
}
