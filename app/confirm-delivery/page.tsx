'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, QrCode } from 'lucide-react';
import Link from 'next/link';
import { confirmDelivery, getPackageById } from '@/lib/nostr';
import { QrScanner } from '@/components/qr-scanner';

interface PackageData {
  id: string;
  title: string;
  pickupLocation: string;
  destination: string;
  cost: string;
  description?: string;
  status: 'available' | 'in_transit' | 'delivered';
}

export default function ConfirmDelivery() {
  const searchParams = useSearchParams();
  const [packageData, setPackageData] = useState<PackageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Check if we have a package ID in the URL
  const packageId = searchParams.get('id');

  useEffect(() => {
    const fetchPackage = async (id: string) => {
      setLoading(true);
      try {
        // In a real implementation, this would fetch from your Nostr relay
        const pkg = await getPackageById(id);
        setPackageData(pkg);
      } catch (error) {
        toast.error('Error', {
          description:
            'Failed to load package details. Invalid or expired QR code.',
        });
      } finally {
        setLoading(false);
      }
    };

    if (packageId) {
      fetchPackage(packageId);
    }
  }, [packageId]);

  const handleConfirm = async () => {
    if (!packageData) return;

    try {
      // In a real implementation, this would publish to your Nostr relay
      await confirmDelivery(packageData.id);
      setConfirmed(true);

      toast.success('Delivery Confirmed', {
        description: 'You have successfully confirmed the delivery.',
      });
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to confirm delivery. Please try again.',
      });
    }
  };

  const handleScanResult = (result: string) => {
    // Extract the package ID from the scanned URL
    const url = new URL(result);
    const id = url.searchParams.get('id');

    if (id) {
      // Redirect to the same page with the ID parameter
      window.location.href = `/confirm-delivery?id=${id}`;
    } else {
      toast.error('Invalid QR Code', {
        description: 'The scanned QR code is not valid for package delivery.',
      });
    }

    setShowScanner(false);
  };

  return (
    <div className='container mx-auto px-4 py-8'>
      <Link href='/' className='flex items-center text-sm mb-6 hover:underline'>
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Home
      </Link>

      <Card className='max-w-md mx-auto'>
        <CardHeader>
          <CardTitle className='flex items-center'>
            <CheckCircle className='mr-2 h-5 w-5' />
            Confirm Delivery
          </CardTitle>
          <CardDescription>
            {packageId
              ? "Confirm that you've received the package"
              : 'Scan a QR code to confirm package delivery'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showScanner ? (
            <div className='space-y-4'>
              <QrScanner
                onResult={handleScanResult}
                onCancel={() => setShowScanner(false)}
              />
            </div>
          ) : packageId && loading ? (
            <div className='py-8 text-center'>
              <div className='animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto'></div>
              <p className='mt-4 text-gray-500'>Loading package details...</p>
            </div>
          ) : packageId && !packageData ? (
            <div className='py-8 text-center text-gray-500'>
              Package not found or already delivered
            </div>
          ) : packageId && packageData ? (
            confirmed ? (
              <div className='py-8 text-center'>
                <CheckCircle className='h-16 w-16 text-green-500 mx-auto mb-4' />
                <h3 className='text-xl font-medium mb-2'>
                  Delivery Confirmed!
                </h3>
                <p className='text-gray-500'>
                  You have successfully confirmed the delivery of this package.
                </p>
                <p className='text-gray-500 mt-4'>
                  Payment of {packageData.cost} sats has been simulated.
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                <div>
                  <h3 className='font-medium'>Package</h3>
                  <p className='text-sm mt-1'>{packageData.title}</p>
                  {packageData.description && (
                    <p className='text-sm text-gray-500 mt-1'>
                      {packageData.description}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className='font-medium'>Pickup Location</h3>
                  <p className='text-sm mt-1'>{packageData.pickupLocation}</p>
                </div>

                <div>
                  <h3 className='font-medium'>Destination</h3>
                  <p className='text-sm mt-1'>{packageData.destination}</p>
                </div>

                <div>
                  <h3 className='font-medium'>Payment</h3>
                  <p className='text-sm mt-1'>{packageData.cost} sats</p>
                </div>
              </div>
            )
          ) : (
            <div className='py-8 text-center'>
              <QrCode className='h-16 w-16 text-gray-400 mx-auto mb-4' />
              <p className='text-gray-500'>
                Scan a QR code from a courier to confirm package delivery
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          {showScanner ? (
            <Button
              variant='outline'
              className='w-full'
              onClick={() => setShowScanner(false)}
            >
              Cancel Scanning
            </Button>
          ) : packageId && packageData && !confirmed ? (
            <Button className='w-full' onClick={handleConfirm}>
              Confirm Delivery
            </Button>
          ) : !packageId ? (
            <Button className='w-full' onClick={() => setShowScanner(true)}>
              Scan QR Code
            </Button>
          ) : (
            <Link href='/' className='w-full'>
              <Button className='w-full'>Return Home</Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
