'use client';

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
import { ArrowLeft, Package } from 'lucide-react';
import Link from 'next/link';
import { getPackages, pickupPackage } from '@/lib/nostr';
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
}

export default function ViewPackages() {
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageData | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        // In a real implementation, this would fetch from your Nostr relay
        const pkgs = await getPackages();
        setPackages(pkgs);
      } catch (error) {
        toast.error('Error', {
          description: 'Failed to load packages. Please try again.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handlePickup = async (packageId: string) => {
    try {
      // In a real implementation, this would publish to your Nostr relay
      await pickupPackage(packageId);

      // Update local state
      setPackages((prev) =>
        prev.map((pkg) =>
          pkg.id === packageId ? { ...pkg, status: 'in_transit' } : pkg
        )
      );

      toast.success('Package Picked Up', {
        description: 'You have successfully picked up the package.',
      });
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to pick up package. Please try again.',
      });
    }
  };

  return (
    <div className='container mx-auto px-4 py-8'>
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
            <CardHeader>
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
                  No packages available at the moment
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
