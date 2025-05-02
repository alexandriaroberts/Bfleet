'use client';

import { Badge } from '@/components/ui/badge';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Package, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { getPackages, pickupPackage } from '@/lib/nostr';
import { useNostr } from '@/components/nostr-provider';
import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid SSR issues
const PackageMap = dynamic(() => import('@/components/package-map'), {
  ssr: false,
  loading: () => (
    <div className='h-[400px] bg-gray-100 animate-pulse rounded-md'></div>
  ),
});

interface PackageData {
  id: string;
  title: string;
  pickupLocation: string;
  destination: string;
  cost: string;
  description?: string;
  status: 'available' | 'in_transit' | 'delivered';
  pubkey?: string;
}

export default function ViewPackages() {
  const { isReady, publicKey } = useNostr();
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPackages = async () => {
    try {
      // Fetch packages from Nostr
      const pkgs = await getPackages();
      console.log('Fetched packages:', pkgs);
      setPackages(pkgs);
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to load packages. Please try again.',
      });
      console.error('Error fetching packages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isReady) return;

    fetchPackages();

    // Set up a refresh interval to periodically check for new packages
    const refreshInterval = setInterval(() => {
      fetchPackages();
    }, 60000); // Refresh every 60 seconds

    return () => clearInterval(refreshInterval);
  }, [isReady]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPackages();
  };

  const handlePickup = async (packageId: string) => {
    try {
      // Pick up package using Nostr
      await pickupPackage(packageId);

      // Update local state
      setPackages((prev) => prev.filter((pkg) => pkg.id !== packageId));

      if (selectedPackage?.id === packageId) {
        setSelectedPackage(null);
      }

      toast.success('Package Picked Up', {
        description: 'You have successfully picked up the package.',
      });
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to pick up package. Please try again.',
      });
      console.error('Error picking up package:', error);
    }
  };

  const isOwnPackage = (pkg: PackageData) => {
    return pkg.pubkey === publicKey;
  };

  if (!isReady) {
    return (
      <div className='container mx-auto px-4 pt-24 pb-8'>
        <div className='flex justify-center items-center h-64'>
          <div className='animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full'></div>
          <p className='ml-2'>Loading Nostr...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 pt-24 pb-8'>
      <Link href='/' className='flex items-center text-sm mb-6 hover:underline'>
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Home
      </Link>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <div className='lg:col-span-2'>
          <Card className='h-full'>
            <CardHeader>
              <CardTitle>Package Map</CardTitle>
              <CardDescription>
                View available packages on the map
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PackageMap
                packages={packages}
                onSelectPackage={setSelectedPackage}
                selectedPackage={selectedPackage}
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className='h-full'>
            <CardHeader className='flex flex-row items-center justify-between'>
              <div>
                <CardTitle className='flex items-center'>
                  <Package className='mr-2 h-5 w-5' />
                  Available Packages
                </CardTitle>
                <CardDescription>
                  {loading
                    ? 'Loading packages...'
                    : `${
                        packages.filter((p) => p.status === 'available').length
                      } packages available`}
                </CardDescription>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className='flex items-center gap-2'
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className='space-y-2'>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className='h-24 bg-gray-100 animate-pulse rounded-md'
                    ></div>
                  ))}
                </div>
              ) : packages.filter((p) => p.status === 'available').length ===
                0 ? (
                <div className='text-center py-8 text-gray-500'>
                  <p>No packages available at the moment</p>
                  <p className='text-sm mt-2'>
                    Try posting a package or refreshing the list
                  </p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {packages
                    .filter((p) => p.status === 'available')
                    .map((pkg) => (
                      <Card
                        key={pkg.id}
                        className={`cursor-pointer ${
                          selectedPackage?.id === pkg.id ? 'border-primary' : ''
                        }`}
                        onClick={() => setSelectedPackage(pkg)}
                      >
                        <CardContent className='p-4'>
                          <div className='font-medium'>{pkg.title}</div>
                          <div className='text-sm text-gray-500 mt-1'>
                            From: {pkg.pickupLocation}
                          </div>
                          <div className='text-sm text-gray-500'>
                            To: {pkg.destination}
                          </div>
                          <div className='flex justify-between items-center mt-2'>
                            <div className='font-medium'>{pkg.cost} sats</div>
                            {isOwnPackage(pkg) ? (
                              <Badge variant='outline' className='text-xs'>
                                Your Package
                              </Badge>
                            ) : (
                              <Button
                                size='sm'
                                className='bg-gray-50 border border-gray-200 rounded-full font-medium text-gray-700 hover:border-gray-300 transform hover:-translate-y-1 transition-all duration-300 cursor-pointer'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePickup(pkg.id);
                                }}
                              >
                                Pick Up
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
