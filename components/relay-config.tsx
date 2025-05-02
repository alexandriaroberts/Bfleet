'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getRelays, setRelays } from '@/lib/nostr-service';
import { X, Plus, Wifi, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RelayConfigProps {
  onClose?: () => void;
}

export function RelayConfig({ onClose }: RelayConfigProps) {
  const [relays, setRelaysList] = useState<string[]>([]);
  const [newRelay, setNewRelay] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [relayStatus, setRelayStatus] = useState<
    Record<string, 'connected' | 'connecting' | 'error'>
  >({});

  useEffect(() => {
    // Load current relays
    setRelaysList(getRelays());

    // Initialize relay status
    const initialStatus: Record<string, 'connected' | 'connecting' | 'error'> =
      {};
    getRelays().forEach((relay) => {
      initialStatus[relay] = 'connecting';
    });
    setRelayStatus(initialStatus);

    // Test relay connections
    testRelayConnections(getRelays());
  }, []);

  const testRelayConnections = async (relaysToTest: string[]) => {
    setIsTesting(true);

    const updatedStatus: Record<string, 'connected' | 'connecting' | 'error'> =
      {};

    for (const relay of relaysToTest) {
      updatedStatus[relay] = 'connecting';
      setRelayStatus((prev) => ({ ...prev, [relay]: 'connecting' }));

      try {
        // Try to connect to the relay
        const socket = new WebSocket(relay);

        // Set a timeout for connection
        const connectionPromise = new Promise<void>((resolve, reject) => {
          socket.onopen = () => {
            socket.close();
            resolve();
          };
          socket.onerror = () => {
            reject(new Error(`Failed to connect to ${relay}`));
          };
          // Timeout after 5 seconds
          setTimeout(
            () => reject(new Error(`Connection to ${relay} timed out`)),
            5000
          );
        });

        await connectionPromise;
        updatedStatus[relay] = 'connected';
      } catch (error) {
        console.error(`Error connecting to relay ${relay}:`, error);
        updatedStatus[relay] = 'error';
      }

      setRelayStatus((prev) => ({ ...prev, [relay]: updatedStatus[relay] }));
    }

    setIsTesting(false);
  };

  const handleAddRelay = () => {
    if (!newRelay) return;

    // Basic validation
    if (!newRelay.startsWith('wss://')) {
      toast.error('Invalid relay URL', {
        description: 'Relay URL must start with wss://',
      });
      return;
    }

    // Check for duplicates
    if (relays.includes(newRelay)) {
      toast.error('Duplicate relay', {
        description: 'This relay is already in your list',
      });
      return;
    }

    // Add the new relay
    const updatedRelays = [...relays, newRelay];
    setRelaysList(updatedRelays);

    // Set status to connecting
    setRelayStatus((prev) => ({
      ...prev,
      [newRelay]: 'connecting',
    }));

    // Test the new relay connection
    testRelayConnections([newRelay]);

    setNewRelay('');
  };

  const handleRemoveRelay = (relay: string) => {
    setRelaysList(relays.filter((r) => r !== relay));

    // Remove from status tracking
    setRelayStatus((prev) => {
      const updated = { ...prev };
      delete updated[relay];
      return updated;
    });
  };

  const handleSave = () => {
    setIsLoading(true);

    try {
      // Ensure we have at least one relay
      if (relays.length === 0) {
        toast.error('No relays', {
          description: 'You must have at least one relay',
        });
        setIsLoading(false);
        return;
      }

      // Save relays
      setRelays(relays);

      toast.success('Relays updated', {
        description: 'Your relay configuration has been saved',
      });

      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to save relays:', error);
      toast.error('Failed to save', {
        description: 'An error occurred while saving your relay configuration',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestRelays = () => {
    testRelayConnections(relays);
  };

  const getStatusBadge = (status: 'connected' | 'connecting' | 'error') => {
    switch (status) {
      case 'connected':
        return (
          <Badge variant='success' className='ml-2'>
            Connected
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant='warning' className='ml-2'>
            Connecting...
          </Badge>
        );
      case 'error':
        return (
          <Badge variant='destructive' className='ml-2'>
            Error
          </Badge>
        );
    }
  };

  return (
    <div className='space-y-6'>
      <div className='space-y-4'>
        <div className='flex items-center'>
          <Wifi className='h-5 w-5 mr-2 text-primary' />
          <h3 className='text-lg font-medium'>Relay Configuration</h3>
        </div>
        <p className='text-sm text-gray-500'>
          Configure which Nostr relays to connect to. Relays are servers that
          store and distribute Nostr events.
        </p>
      </div>

      <div className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='new-relay'>Add Relay</Label>
          <div className='flex gap-2'>
            <Input
              id='new-relay'
              placeholder='wss://relay.example.com'
              value={newRelay}
              onChange={(e) => setNewRelay(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddRelay();
                }
              }}
            />
            <Button onClick={handleAddRelay} size='icon'>
              <Plus className='h-4 w-4' />
            </Button>
          </div>
          <p className='text-xs text-gray-500'>
            Enter the WebSocket URL of the relay (starts with wss://)
          </p>
        </div>

        <div className='space-y-2'>
          <div className='flex justify-between items-center'>
            <Label>Current Relays</Label>
            <Button
              variant='outline'
              size='sm'
              onClick={handleTestRelays}
              disabled={isTesting || relays.length === 0}
              className='text-xs'
            >
              {isTesting ? 'Testing...' : 'Test Connections'}
            </Button>
          </div>

          {relays.length === 0 ? (
            <div className='bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-800 text-sm'>
              <div className='flex items-start gap-2'>
                <AlertCircle className='h-5 w-5 mt-0.5 flex-shrink-0' />
                <div>
                  <p className='font-medium'>No relays configured</p>
                  <p className='mt-1'>
                    You need at least one relay to connect to the Nostr network.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className='space-y-2 max-h-60 overflow-y-auto'>
              {relays.map((relay, index) => (
                <div
                  key={index}
                  className='flex items-center justify-between bg-gray-50 p-3 rounded-md'
                >
                  <div className='flex items-center truncate flex-1'>
                    <span className='text-sm truncate'>{relay}</span>
                    {relayStatus[relay] && getStatusBadge(relayStatus[relay])}
                  </div>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    onClick={() => handleRemoveRelay(relay)}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? (
            <>
              <span className='animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2'></span>
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}
