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

// Delete a package from local storage
export function deleteLocalPackage(packageId: string): boolean {
  try {
    const packagesJson = localStorage.getItem(PACKAGES_STORAGE_KEY);
    if (!packagesJson) return false;

    const packages = JSON.parse(packagesJson) as PackageData[];

    // Find the package
    const packageIndex = packages.findIndex((pkg) => pkg.id === packageId);
    if (packageIndex === -1) return false;

    // Check if the package belongs to the current user
    const currentPubkey = getUserPubkey();
    if (packages[packageIndex].pubkey !== currentPubkey) {
      console.error('Cannot delete package: not owned by current user');
      return false;
    }

    // Remove the package
    packages.splice(packageIndex, 1);
    localStorage.setItem(PACKAGES_STORAGE_KEY, JSON.stringify(packages));

    console.log(`Package ${packageId} deleted from local storage`);
    return true;
  } catch (error) {
    console.error('Failed to delete local package:', error);
    return false;
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
      pickup_time: Math.floor(Date.now() / 1000),
    };

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
      pkg.id === packageId
        ? {
            ...pkg,
            status: 'delivered',
            delivery_time: Math.floor(Date.now() / 1000),
          }
        : pkg
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
      pkg.id === packageId
        ? {
            ...pkg,
            status: 'delivered',
            delivery_time: Math.floor(Date.now() / 1000),
          }
        : pkg
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

// Add a function to share packages between browsers
export function sharePackagesWithLocalStorage(): void {
  try {
    // Get all packages from localStorage
    const packagesJson = localStorage.getItem(PACKAGES_STORAGE_KEY);
    if (!packagesJson) return;

    // Parse packages
    const packages = JSON.parse(packagesJson) as PackageData[];

    // Store in sessionStorage for sharing
    sessionStorage.setItem('shared_packages_export', JSON.stringify(packages));

    console.log(
      `Exported ${packages.length} packages to sessionStorage for sharing`
    );
  } catch (error) {
    console.error('Failed to share packages:', error);
  }
}

// Import shared packages from another browser
export function importSharedPackages(): number {
  try {
    // Get shared packages from sessionStorage
    const sharedPackagesJson = sessionStorage.getItem('shared_packages_export');
    if (!sharedPackagesJson) return 0;

    // Parse shared packages
    const sharedPackages = JSON.parse(sharedPackagesJson) as PackageData[];

    // Get existing packages
    const existingPackagesJson = localStorage.getItem(PACKAGES_STORAGE_KEY);
    const existingPackages = existingPackagesJson
      ? (JSON.parse(existingPackagesJson) as PackageData[])
      : [];

    // Merge packages, avoiding duplicates
    let newPackagesCount = 0;
    for (const sharedPackage of sharedPackages) {
      if (!existingPackages.some((pkg) => pkg.id === sharedPackage.id)) {
        existingPackages.push(sharedPackage);
        newPackagesCount++;
      }
    }

    // Save merged packages
    localStorage.setItem(
      PACKAGES_STORAGE_KEY,
      JSON.stringify(existingPackages)
    );

    console.log(
      `Imported ${newPackagesCount} new packages from shared storage`
    );
    return newPackagesCount;
  } catch (error) {
    console.error('Failed to import shared packages:', error);
    return 0;
  }
}

// Debug function to log all packages and deliveries
export function debugStorage(): void {
  try {
    const packagesJson = localStorage.getItem(PACKAGES_STORAGE_KEY);
    const packages = packagesJson ? JSON.parse(packagesJson) : [];

    const deliveriesJson = localStorage.getItem(MY_DELIVERIES_STORAGE_KEY);
    const deliveries = deliveriesJson ? JSON.parse(deliveriesJson) : [];

    console.log('=== DEBUG STORAGE ===');
    console.log(`Current user pubkey: ${getUserPubkey()}`);
    console.log(`Available packages (${packages.length}):`, packages);
    console.log(`All deliveries (${deliveries.length}):`, deliveries);
    console.log(
      `My deliveries (${getMyLocalDeliveries().length}):`,
      getMyLocalDeliveries()
    );
    console.log('====================');
  } catch (error) {
    console.error('Error in debug storage:', error);
  }
}
