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
import { ArrowLeft, CheckCircle, RefreshCw, Truck } from 'lucide-react';
import Link from 'next/link';
import { getMyDeliveries, completeDelivery } from '@/lib/nostr';
import { useNostr } from '@/components/nostr-provider';
import { QRCodeSVG } from 'qrcode.react';

interface PackageData {
  id: string;
  title: string;
  pickupLocation: string;
  destination: string;
  cost: string;
  description?: string;
  status: 'available' | 'in_transit' | 'delivered';
}

export default function MyDeliveries() {
  const { isReady } = useNostr();
  const [deliveries, setDeliveries] = useState<PackageData[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<PackageData | null>(
    null
  );
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeliveries = async () => {
    try {
      // Fetch deliveries from Nostr
      const pkgs = await getMyDeliveries();
      console.log('Fetched deliveries:', pkgs);
      setDeliveries(pkgs);
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to load deliveries. Please try again.',
      });
      console.error('Error fetching deliveries:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isReady) return;

    fetchDeliveries();
  }, [isReady]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDeliveries();
  };

  const handleComplete = async (packageId: string) => {
    try {
      // Complete delivery using Nostr
      await completeDelivery(packageId);

      // Update local state
      setDeliveries((prev) =>
        prev.map((pkg) =>
          pkg.id === packageId ? { ...pkg, status: 'delivered' } : pkg
        )
      );

      setSelectedDelivery(null);
      setShowQR(false);

      toast.success('Delivery Completed', {
        description: 'The delivery has been marked as completed.',
      });
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to complete delivery. Please try again.',
      });
      console.error('Error completing delivery:', error);
    }
  };

  const generateQRValue = (packageId: string) => {
    // Generate a URL to the confirmation page
    return `${window.location.origin}/confirm-delivery?id=${packageId}`;
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
            <CardHeader className='flex flex-row items-center justify-between'>
              <div>
                <CardTitle className='flex items-center'>
                  <Truck className='mr-2 h-5 w-5' />
                  My Active Deliveries
                </CardTitle>
                <CardDescription>
                  {loading
                    ? 'Loading deliveries...'
                    : `${
                        deliveries.filter((d) => d.status === 'in_transit')
                          .length
                      } active deliveries`}
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
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className='h-24 bg-gray-100 animate-pulse rounded-md'
                    ></div>
                  ))}
                </div>
              ) : deliveries.filter((d) => d.status === 'in_transit').length ===
                0 ? (
                <div className='text-center py-8 text-gray-500'>
                  <p>You have no active deliveries</p>
                  <p className='text-sm mt-2'>
                    Pick up a package from the View Packages page
                  </p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {deliveries
                    .filter((d) => d.status === 'in_transit')
                    .map((delivery) => (
                      <Card
                        key={delivery.id}
                        className={`cursor-pointer ${
                          selectedDelivery?.id === delivery.id
                            ? 'border-primary'
                            : ''
                        }`}
                        onClick={() => {
                          setSelectedDelivery(delivery);
                          setShowQR(false);
                        }}
                      >
                        <CardContent className='p-4'>
                          <div className='font-medium'>{delivery.title}</div>
                          <div className='text-sm text-gray-500 mt-1'>
                            From: {delivery.pickupLocation}
                          </div>
                          <div className='text-sm text-gray-500'>
                            To: {delivery.destination}
                          </div>
                          <div className='flex justify-between items-center mt-2'>
                            <div className='font-medium'>
                              {delivery.cost} sats
                            </div>
                            <div className='flex gap-2'>
                              <Button
                                size='sm'
                                variant='outline'
                                className='cursor-pointer'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDelivery(delivery);
                                  setShowQR(true);
                                }}
                              >
                                Show QR
                              </Button>
                              <Button
                                size='sm'
                                className='bg-gray-50 border border-gray-200 rounded-full font-medium text-gray-700 hover:border-gray-300 transform hover:-translate-y-1 transition-all duration-300 cursor-pointer'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleComplete(delivery.id);
                                }}
                              >
                                Complete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className='h-full'>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <CheckCircle className='mr-2 h-5 w-5' />
                Delivery Details
              </CardTitle>
              <CardDescription>
                {selectedDelivery
                  ? 'Show QR code to recipient'
                  : 'Select a delivery to see details'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedDelivery ? (
                <div className='text-center py-8 text-gray-500'>
                  Select a delivery from the list
                </div>
              ) : showQR ? (
                <div className='text-center py-4'>
                  <div className='mb-4'>
                    <p className='text-sm text-gray-500 mb-2'>
                      Show this QR code to the recipient to confirm delivery
                    </p>
                    <div className='bg-white p-4 inline-block rounded-md'>
                      <QRCodeSVG
                        value={generateQRValue(selectedDelivery.id)}
                        size={200}
                      />
                    </div>
                  </div>
                  <Button
                    variant='outline'
                    onClick={() => setShowQR(false)}
                    className='mt-2'
                  >
                    Hide QR Code
                  </Button>
                </div>
              ) : (
                <div className='space-y-4'>
                  <div>
                    <h3 className='font-medium'>Package Details</h3>
                    <p className='text-sm mt-1'>{selectedDelivery.title}</p>
                    {selectedDelivery.description && (
                      <p className='text-sm text-gray-500 mt-1'>
                        {selectedDelivery.description}
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className='font-medium'>Pickup Location</h3>
                    <p className='text-sm mt-1'>
                      {selectedDelivery.pickupLocation}
                    </p>
                  </div>

                  <div>
                    <h3 className='font-medium'>Destination</h3>
                    <p className='text-sm mt-1'>
                      {selectedDelivery.destination}
                    </p>
                  </div>

                  <div>
                    <h3 className='font-medium'>Payment</h3>
                    <p className='text-sm mt-1'>{selectedDelivery.cost} sats</p>
                  </div>

                  <div className='pt-4 flex gap-2'>
                    <Button onClick={() => setShowQR(true)} className='flex-1'>
                      Show QR Code
                    </Button>
                    <Button
                      onClick={() => handleComplete(selectedDelivery.id)}
                      variant='outline'
                      className='flex-1'
                    >
                      Mark Delivered
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
