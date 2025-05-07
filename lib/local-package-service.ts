import { getUserPubkey } from './nostr';
import type { PackageData } from './nostr-types';

// Local storage keys
const PACKAGES_STORAGE_KEY = 'local_packages_v2';
const MY_DELIVERIES_STORAGE_KEY = 'my_deliveries_v2';

// Get all available packages from local storage
export function getLocalPackages(): PackageData[] {
  try {
    const packagesJson = localStorage.getItem(PACKAGES_STORAGE_KEY);
    if (!packagesJson) return [];

    const packages = JSON.parse(packagesJson) as PackageData[];

    // Filter out packages that have been picked up
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
    return deliveriesJson ? JSON.parse(deliveriesJson) : [];
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
    myDeliveries.push({
      ...packageToPickup,
      status: 'in_transit',
      courier_pubkey: getUserPubkey(), // Add the courier's pubkey
    });
    localStorage.setItem(
      MY_DELIVERIES_STORAGE_KEY,
      JSON.stringify(myDeliveries)
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
    const myDeliveries = getMyLocalDeliveries();
    const updatedDeliveries = myDeliveries.map((pkg) =>
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

    // Check my deliveries
    const myDeliveries = getMyLocalDeliveries();
    const myDelivery = myDeliveries.find((pkg) => pkg.id === id);
    if (myDelivery) return myDelivery;

    return null;
  } catch (error) {
    console.error('Failed to get local package by ID:', error);
    return null;
  }
}

// Confirm delivery (by recipient)
export function confirmLocalDelivery(packageId: string): void {
  try {
    // Update status in my deliveries
    const myDeliveries = getMyLocalDeliveries();
    const updatedDeliveries = myDeliveries.map((pkg) =>
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

// Function to share packages with other users (this would be replaced with a relay later)
// For now, this could use localStorage, but in a real app would use a server or shared storage
export function sharePackagesWithOtherUsers(): void {
  // This is a placeholder for future implementation
  // In the MVP, packages would be shared through a centralized mechanism
  console.log(
    'Sharing packages with other users would happen here in the future'
  );
}
