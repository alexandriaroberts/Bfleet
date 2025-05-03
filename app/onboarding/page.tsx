'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { setRelays, getRelays } from '@/lib/nostr-service';

export default function Onboarding() {
  const router = useRouter();
  const [isConfiguring, setIsConfiguring] = useState(false);

  // Check if this is first launch
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('onboarding_completed');
    if (hasCompletedOnboarding) {
      router.replace('/');
    }
  }, [router]);

  const configureRelays = async () => {
    setIsConfiguring(true);

    try {
      // Set the project's relay
      const projectRelay = 'wss://your-private-relay-url.com'; // Replace with your relay
      setRelays([projectRelay, ...getRelays()]);

      // Mark onboarding as complete
      localStorage.setItem('onboarding_completed', 'true');

      toast.success('Relay configured successfully');
      router.push('/login');
    } catch (error) {
      console.error('Failed to configure relay:', error);
      toast.error('Failed to configure relay');
    } finally {
      setIsConfiguring(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>Welcome to A to ₿</CardTitle>
          <CardDescription>
            Let's get you connected to our delivery network
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-gray-500 mb-4'>
            A to ₿ uses Nostr to connect users. To ensure you can see all
            available packages, we need to connect you to our relay server.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            className='w-full'
            onClick={configureRelays}
            disabled={isConfiguring}
          >
            {isConfiguring ? 'Configuring...' : 'Connect to atob Network'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
