// Real Nostr integration
import { SimplePool, type Event } from 'nostr-tools';

// Define interfaces
export interface PackageData {
  id: string;
  title: string;
  pickupLocation: string;
  destination: string;
  cost: string;
  description?: string;
  status: 'available' | 'in_transit' | 'delivered';
  pubkey?: string;
}

export interface ProfileData {
  pubkey: string;
  name?: string;
  displayName?: string;
  picture?: string;
  followers?: number;
  following?: number;
  deliveries?: number;
  rating?: number;
}

// Initialize Nostr pool
const pool = new SimplePool();

// Use public test relays for development
const RELAY_URLS = ['wss://relay.damus.io', 'wss://relay.nostr.info'];

// Define event kinds for Bfleet
const EVENT_KINDS = {
  METADATA: 0,
  PACKAGE_LISTING: 30001,
  PACKAGE_PICKUP: 30002,
  PACKAGE_DELIVERY: 30003,
};

// Mock data for UI development (keep this for now)
const packages: PackageData[] = [
  {
    id: 'pkg-1',
    title: 'Small Box of Books',
    pickupLocation: '123 Main St, San Francisco',
    destination: '456 Market St, San Francisco',
    cost: '5000',
    description: 'Small box containing paperback books',
    status: 'available',
  },
  {
    id: 'pkg-2',
    title: 'Laptop Package',
    pickupLocation: '789 Mission St, San Francisco',
    destination: '101 California St, San Francisco',
    cost: '10000',
    status: 'available',
  },
  {
    id: 'pkg-3',
    title: 'Groceries',
    pickupLocation: '200 Van Ness Ave, San Francisco',
    destination: '300 Hayes St, San Francisco',
    cost: '3000',
    description: 'Bag of groceries from Whole Foods',
    status: 'available',
  },
];

const myDeliveries: PackageData[] = [
  {
    id: 'pkg-4',
    title: 'Office Supplies',
    pickupLocation: '350 Bush St, San Francisco',
    destination: '400 Montgomery St, San Francisco',
    cost: '7500',
    status: 'in_transit',
  },
  {
    id: 'pkg-5',
    title: 'Birthday Gift',
    pickupLocation: '500 Divisadero St, San Francisco',
    destination: '600 Haight St, San Francisco',
    cost: '4000',
    description: 'Wrapped birthday present, handle with care',
    status: 'in_transit',
  },
];

// Mock profile data
const mockProfile: ProfileData = {
  pubkey: 'npub1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  name: 'bfleet_user',
  displayName: 'Bfleet Courier',
  picture: 'https://placekitten.com/200/200',
  followers: 24,
  following: 36,
  deliveries: 15,
  rating: 4.8,
};

// Helper function to get user's public key
export function getUserPubkey(): string {
  // In a real app, this would come from the user's Nostr extension or local storage
  return '97c70a44366a6535c145b333f973ea86dfdc2d7a99da618c40c64705ad98e322'; // Mock pubkey in hex format
}

// Helper function to publish an event to relays
async function publishEvent(eventData: Partial<Event>): Promise<string> {
  try {
    // For development, we'll use a mock event ID instead of actually publishing
    // In a real app, this would be signed by the user's private key and published to relays

    // Generate a random ID for the mock event
    const mockId = Array.from(
      { length: 64 },
      () => '0123456789abcdef'[Math.floor(Math.random() * 16)]
    ).join('');

    console.log('Mock event created:', { ...eventData, id: mockId });

    return mockId;
  } catch (error) {
    console.error('Failed to publish event:', error);
    throw error;
  }
}

// Create a new package listing
export async function createPackage(
  packageData: Omit<PackageData, 'id' | 'status'>
): Promise<string> {
  try {
    // Create a mock event ID
    const eventId = `pkg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Add to mock data for UI
    const newPackage: PackageData = {
      ...packageData,
      id: eventId,
      status: 'available',
    };
    packages.push(newPackage);

    return eventId;
  } catch (error) {
    console.error('Failed to create package:', error);
    throw error;
  }
}

// Get all available packages
export async function getPackages(): Promise<PackageData[]> {
  try {
    // In a real app, we would fetch events from relays
    // const events = await pool.list(RELAY_URLS, [
    //   {
    //     kinds: [EVENT_KINDS.PACKAGE_LISTING],
    //     '#t': ['bfleet-package']
    //   }
    // ])

    // For now, return mock data
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(packages);
      }, 500);
    });
  } catch (error) {
    console.error('Failed to fetch packages:', error);
    throw error;
  }
}

// Get user's active deliveries
export async function getMyDeliveries(): Promise<PackageData[]> {
  try {
    // In a real app, we would fetch events from relays
    // const events = await pool.list(RELAY_URLS, [
    //   {
    //     kinds: [EVENT_KINDS.PACKAGE_PICKUP],
    //     authors: [getUserPubkey()]
    //   }
    // ])

    // For now, return mock data
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(myDeliveries);
      }, 500);
    });
  } catch (error) {
    console.error('Failed to fetch deliveries:', error);
    throw error;
  }
}

// Get a specific package by ID
export async function getPackageById(id: string): Promise<PackageData | null> {
  try {
    // In a real app, we would fetch the event from relays
    // const events = await pool.list(RELAY_URLS, [
    //   {
    //     ids: [id]
    //   }
    // ])

    // For now, use mock data
    return new Promise((resolve) => {
      setTimeout(() => {
        const pkg =
          [...packages, ...myDeliveries].find((p) => p.id === id) || null;
        resolve(pkg);
      }, 500);
    });
  } catch (error) {
    console.error('Failed to fetch package:', error);
    throw error;
  }
}

// Pick up a package
export async function pickupPackage(packageId: string): Promise<void> {
  try {
    // Update mock data
    const packageIndex = packages.findIndex((p) => p.id === packageId);
    if (packageIndex !== -1) {
      const pkg = packages[packageIndex];
      pkg.status = 'in_transit';

      // Remove from available packages
      packages.splice(packageIndex, 1);

      // Add to my deliveries
      myDeliveries.push(pkg);
    }
  } catch (error) {
    console.error('Failed to pick up package:', error);
    throw error;
  }
}

// Complete a delivery
export async function completeDelivery(packageId: string): Promise<void> {
  try {
    // Update mock data
    const packageIndex = myDeliveries.findIndex((p) => p.id === packageId);
    if (packageIndex !== -1) {
      myDeliveries[packageIndex].status = 'delivered';
    }
  } catch (error) {
    console.error('Failed to complete delivery:', error);
    throw error;
  }
}

// Confirm delivery (by recipient)
export async function confirmDelivery(packageId: string): Promise<void> {
  try {
    // Update mock data
    const allPackages = [...packages, ...myDeliveries];
    const packageIndex = allPackages.findIndex((p) => p.id === packageId);
    if (packageIndex !== -1) {
      allPackages[packageIndex].status = 'delivered';
    }
  } catch (error) {
    console.error('Failed to confirm delivery:', error);
    throw error;
  }
}

// Get user profile
export async function getUserProfile(pubkey?: string): Promise<ProfileData> {
  try {
    // In a real app, we would fetch the profile from relays
    // const events = await pool.list(RELAY_URLS, [
    //   {
    //     kinds: [EVENT_KINDS.METADATA],
    //     authors: [pubkey || getUserPubkey()]
    //   }
    // ])

    // For now, return mock data
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockProfile);
      }, 500);
    });
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    throw error;
  }
}

// Calculate reputation score (simplified version)
export async function calculateReputationScore(
  pubkey?: string
): Promise<number> {
  // In a real app, this would analyze various factors:
  // - Successful deliveries
  // - Ratings from recipients
  // - Account age
  // - Follower/following ratio

  // For now, return a mock score
  return 4.8;
}
