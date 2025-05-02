'use client';

import { useState, useEffect } from 'react';
import { getRelays } from '@/lib/nostr-service';
import { Wifi, WifiOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function RelayStatusIndicator() {
  const [status, setStatus] = useState<
    'connected' | 'partial' | 'disconnected'
  >('disconnected');
  const [connectedCount, setConnectedCount] = useState(0);
  const [totalRelays, setTotalRelays] = useState(0);

  useEffect(() => {
    // Get all configured relays
    const relays = getRelays();
    setTotalRelays(relays.length);

    // Simulate checking relay connections
    const checkRelays = () => {
      // For demo purposes, randomly set some relays as connected
      const connected = relays.filter(() => Math.random() > 0.3).length;
      setConnectedCount(connected);

      if (connected === 0) {
        setStatus('disconnected');
      } else if (connected === relays.length) {
        setStatus('connected');
      } else {
        setStatus('partial');
      }
    };

    // Initial check
    checkRelays();

    // Periodic check every 30 seconds
    const interval = setInterval(checkRelays, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusDisplay = () => {
    switch (status) {
      case 'connected':
        return (
          <>
            <Wifi className='h-4 w-4 text-green-500' />
            <span className='ml-1 text-xs'>All relays connected</span>
          </>
        );
      case 'partial':
        return (
          <>
            <Wifi className='h-4 w-4 text-yellow-500' />
            <span className='ml-1 text-xs'>
              {connectedCount}/{totalRelays} relays
            </span>
          </>
        );
      case 'disconnected':
        return (
          <>
            <WifiOff className='h-4 w-4 text-red-500' />
            <span className='ml-1 text-xs'>No relays connected</span>
          </>
        );
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='flex items-center cursor-help'>
            {getStatusDisplay()}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {status === 'connected'
              ? 'All relays are connected'
              : status === 'partial'
              ? `${connectedCount} out of ${totalRelays} relays connected`
              : 'No relays connected. Check your network or relay settings'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
