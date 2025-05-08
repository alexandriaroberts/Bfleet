import { getUserPubkey } from './nostr';
import type { PackageData } from './nostr-types';

// Local storage keys
const PACKAGES_STORAGE_KEY = 'shared_packages_v1'; // Changed to shared key
const MY_DELIVERIES_STORAGE_KEY = 'my_deliveries_v2';

// Get all available packages from local storage
export function getLocalPackages(): PackageData[] {
  try {
    const packagesJson = localStorage.getItem(PACKAGES_STORAGE_KEY);
    if (!packagesJson) return [];

    const packages = JSON.parse(packagesJson) as PackageData[];

    // Filter out packages that have been picked up by the current user
    const myDeliveries = getMyLocalDeliveries();
    const pickedUpIds = myDeliveries.map((pkg) => pkg.id);

    return packages.filter((pkg) => !pickedUpIds.includes(pkg.id));
  } catch (error) {
    console.error('Failed to get local packages:', error);
    return [];
  }
}

// Save a new package to local storage
export function saveLocalPackage(
  packageData: Omit<PackageData, 'id' | 'status' | 'pubkey'>
): string {
  try {
    const packages = getLocalPackages();

    // Generate a unique ID
    const id = `local-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    // Create the new package with the current user's pubkey
    const newPackage: PackageData = {
      ...packageData,
      id,
      status: 'available',
      pubkey: getUserPubkey(),
      created_at: Math.floor(Date.now() / 1000),
    };

    // Add to local storage
    packages.push(newPackage);
    localStorage.setItem(PACKAGES_STORAGE_KEY, JSON.stringify(packages));

    return id;
  } catch (error) {
    console.error('Failed to save local package:', error);
    throw error;
  }
}

// Get my deliveries from local storage
export function getMyLocalDeliveries(): PackageData[] {
  try {
    const deliveriesJson = localStorage.getItem(MY_DELIVERIES_STORAGE_KEY);
    if (!deliveriesJson) return [];

    const deliveries = JSON.parse(deliveriesJson) as PackageData[];

    // Only return deliveries for the current user
    const currentPubkey = getUserPubkey();
    return deliveries.filter((pkg) => pkg.courier_pubkey === currentPubkey);
  } catch (error) {
    console.error('Failed to get local deliveries:', error);
    return [];
  }
}

// Pick up a package locally
export function pickupLocalPackage(packageId: string): void {
  try {
    // Get the package from available packages
    const packages = getLocalPackages();
    const packageToPickup = packages.find((pkg) => pkg.id === packageId);

    if (!packageToPickup) {
      throw new Error('Package not found');
    }

    // Remove from available packages
    const updatedPackages = packages.filter((pkg) => pkg.id !== packageId);
    localStorage.setItem(PACKAGES_STORAGE_KEY, JSON.stringify(updatedPackages));

    // Add to my deliveries
    const myDeliveries = getMyLocalDeliveries();
    const allDeliveries = JSON.parse(
      localStorage.getItem(MY_DELIVERIES_STORAGE_KEY) || '[]'
    );

    const updatedPackage = {
      ...packageToPickup,
      status: 'in_transit',
      courier_pubkey: getUserPubkey(), // Add the courier's pubkey
    };

    myDeliveries.push(updatedPackage);
    allDeliveries.push(updatedPackage);

    localStorage.setItem(
      MY_DELIVERIES_STORAGE_KEY,
      JSON.stringify(allDeliveries)
    );
  } catch (error) {
    console.error('Failed to pick up local package:', error);
    throw error;
  }
}

// Complete a delivery locally
export function completeLocalDelivery(packageId: string): void {
  try {
    // Update status in my deliveries
    const allDeliveries = JSON.parse(
      localStorage.getItem(MY_DELIVERIES_STORAGE_KEY) || '[]'
    );
    const updatedDeliveries = allDeliveries.map((pkg: PackageData) =>
      pkg.id === packageId ? { ...pkg, status: 'delivered' } : pkg
    );
    localStorage.setItem(
      MY_DELIVERIES_STORAGE_KEY,
      JSON.stringify(updatedDeliveries)
    );
  } catch (error) {
    console.error('Failed to complete local delivery:', error);
    throw error;
  }
}

// Get a specific package by ID (from either available packages or my deliveries)
export function getLocalPackageById(id: string): PackageData | null {
  try {
    // Check available packages
    const packages = getLocalPackages();
    const availablePackage = packages.find((pkg) => pkg.id === id);
    if (availablePackage) return availablePackage;

    // Check all deliveries
    const allDeliveries = JSON.parse(
      localStorage.getItem(MY_DELIVERIES_STORAGE_KEY) || '[]'
    );
    const delivery = allDeliveries.find((pkg: PackageData) => pkg.id === id);
    if (delivery) return delivery;

    return null;
  } catch (error) {
    console.error('Failed to get local package by ID:', error);
    return null;
  }
}

// Confirm delivery (by recipient)
export function confirmLocalDelivery(packageId: string): void {
  try {
    // Update status in deliveries
    const allDeliveries = JSON.parse(
      localStorage.getItem(MY_DELIVERIES_STORAGE_KEY) || '[]'
    );
    const updatedDeliveries = allDeliveries.map((pkg: PackageData) =>
      pkg.id === packageId ? { ...pkg, status: 'delivered' } : pkg
    );
    localStorage.setItem(
      MY_DELIVERIES_STORAGE_KEY,
      JSON.stringify(updatedDeliveries)
    );
  } catch (error) {
    console.error('Failed to confirm local delivery:', error);
    throw error;
  }
}
