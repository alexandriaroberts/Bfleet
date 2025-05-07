import { getUserKeys } from './nostr-keys';
import type { PackageData, ProfileData } from './nostr-types';
import {
  getLocalPackages,
  saveLocalPackage,
  getMyLocalDeliveries,
  pickupLocalPackage,
  completeLocalDelivery,
  getLocalPackageById,
  confirmLocalDelivery,
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

// Create a new package listing using local storage
export async function createPackage(
  packageData: Omit<PackageData, 'id' | 'status'>
): Promise<string> {
  try {
    // Save package to local storage
    const packageId = saveLocalPackage(packageData);
    console.log('Package created with ID:', packageId);
    return packageId;
  } catch (error) {
    console.error('Failed to create package:', error);
    throw error;
  }
}

// Get all available packages
export async function getPackages(): Promise<PackageData[]> {
  try {
    console.log('Fetching packages from local storage...');
    // Get packages from local storage
    const packages = getLocalPackages();
    console.log(`Found ${packages.length} packages in local storage`);
    return packages;
  } catch (error) {
    console.error('Failed to fetch packages:', error);
    return [];
  }
}

// Get user's active deliveries
export async function getMyDeliveries(): Promise<PackageData[]> {
  try {
    console.log('Fetching my deliveries from local storage...');
    // Get deliveries from local storage
    const deliveries = getMyLocalDeliveries();
    console.log(`Found ${deliveries.length} deliveries in local storage`);
    return deliveries;
  } catch (error) {
    console.error('Failed to fetch deliveries:', error);
    return [];
  }
}

// Get a specific package by ID
export async function getPackageById(id: string): Promise<PackageData | null> {
  try {
    console.log(`Fetching package with ID: ${id} from local storage`);
    // Get package from local storage
    const packageData = getLocalPackageById(id);
    if (packageData) {
      console.log('Package found in local storage');
    } else {
      console.log('Package not found in local storage');
    }
    return packageData;
  } catch (error) {
    console.error('Failed to fetch package:', error);
    return null;
  }
}

// Pick up a package
export async function pickupPackage(packageId: string): Promise<void> {
  try {
    console.log(`Picking up package with ID: ${packageId}`);
    // Pick up package in local storage
    pickupLocalPackage(packageId);
    console.log('Package picked up successfully');
  } catch (error) {
    console.error('Failed to pick up package:', error);
    throw error;
  }
}

// Complete a delivery
export async function completeDelivery(packageId: string): Promise<void> {
  try {
    console.log(`Completing delivery for package with ID: ${packageId}`);
    // Complete delivery in local storage
    completeLocalDelivery(packageId);
    console.log('Delivery completed successfully');
  } catch (error) {
    console.error('Failed to complete delivery:', error);
    throw error;
  }
}

// Confirm delivery (by recipient)
export async function confirmDelivery(packageId: string): Promise<void> {
  try {
    console.log(`Confirming delivery for package with ID: ${packageId}`);
    // Confirm delivery in local storage
    confirmLocalDelivery(packageId);
    console.log('Delivery confirmed successfully');
  } catch (error) {
    console.error('Failed to confirm delivery:', error);
    throw error;
  }
}

// Get user profile - simplified for local storage
export async function getUserProfile(pubkey?: string): Promise<ProfileData> {
  try {
    const userPubkey = pubkey || getUserPubkey();

    // Get deliveries to count them
    const myDeliveries = getMyLocalDeliveries();
    const deliveryCount = myDeliveries.filter(
      (d) => d.status === 'delivered'
    ).length;

    // Return a simple profile
    return {
      pubkey: userPubkey,
      name: 'bfleet_user',
      displayName: 'Bfleet User',
      followers: 0,
      following: 0,
      deliveries: deliveryCount,
      rating: deliveryCount > 0 ? 4.5 : 0,
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

// Update profile - simplified for local storage
export async function updateProfile(profileData: {
  name?: string;
  displayName?: string;
  picture?: string;
  about?: string;
  website?: string;
  nip05?: string;
}): Promise<void> {
  // In the MVP, we don't actually store profile data
  console.log('Profile update would happen here in the future');
}
