'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Key, AlertCircle, Lock, ExternalLink } from 'lucide-react';
import { nip19, getPublicKey } from 'nostr-tools';

interface NostrLoginProps {
  onLogin: (publicKey: string, privateKey?: string) => void;
  onCancel?: () => void;
}

export function NostrLogin({ onLogin, onCancel }: NostrLoginProps) {
  const [nsecInput, setNsecInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNsecInput, setShowNsecInput] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Check if browser extension is available - only on client side
  useEffect(() => {
    setHasExtension(
      typeof window !== 'undefined' && window.nostr !== undefined
    );
    setMounted(true);
  }, []);

  const handleExtensionLogin = async () => {
    setLoading(true);
    try {
      if (!window.nostr) {
        throw new Error('No Nostr extension found');
      }

      const publicKey = await window.nostr.getPublicKey();
      if (!publicKey) {
        throw new Error('Failed to get public key from extension');
      }

      // Store the public key in localStorage
      localStorage.setItem('nostr_pubkey', publicKey);

      toast.success('Successfully connected to Nostr', {
        description: 'You are now logged in with your Nostr extension',
      });

      onLogin(publicKey);
    } catch (error) {
      console.error('Extension login error:', error);
      toast.error('Login Failed', {
        description:
          'Could not connect to your Nostr extension. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNsecLogin = () => {
    try {
      let privateKey = nsecInput;
      let publicKey = '';

      // Check if input is a nsec (NIP-19 encoded private key)
      if (privateKey.startsWith('nsec')) {
        try {
          const decoded = nip19.decode(privateKey);
          if (decoded.type === 'nsec') {
            privateKey = decoded.data as string;
          }
        } catch (e) {
          throw new Error('Invalid nsec format');
        }
      }

      // Validate private key format (should be 64 hex characters)
      if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
        throw new Error('Invalid private key format');
      }

      // Derive public key
      publicKey = getPublicKey(privateKey);

      // Store keys (in a real app, consider more secure storage options)
      localStorage.setItem('nostr_pubkey', publicKey);
      localStorage.setItem('nostr_privkey', privateKey);

      toast.success('Successfully logged in', {
        description: 'You are now connected with your Nostr account',
      });

      onLogin(publicKey, privateKey);
    } catch (error) {
      console.error('Nsec login error:', error);
      toast.error('Login Failed', {
        description: 'Invalid private key or nsec. Please check and try again.',
      });
    }

    // Clear the input for security
    setNsecInput('');
  };

  // Don't render extension-specific content until after client-side mount
  if (!mounted) {
    return (
      <Card className='w-full max-w-md mx-auto'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Key className='h-5 w-5' />
            Connect to Nostr
          </CardTitle>
          <CardDescription>
            Use your existing Nostr account to connect to Bfleet
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex justify-center py-4'>
            <div className='animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full'></div>
          </div>
        </CardContent>
        <CardFooter className='flex flex-col gap-4'>
          <p className='text-xs text-center text-gray-500'>
            Already have a Nostr account on apps like Iris, Damus, or Snort? You
            can use the same account here!
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className='w-full max-w-md mx-auto'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Key className='h-5 w-5' />
          Connect to Nostr
        </CardTitle>
        <CardDescription>
          Use your existing Nostr account to connect to Bfleet
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {hasExtension && (
          <Button
            onClick={handleExtensionLogin}
            className='w-full flex items-center justify-center gap-2'
            disabled={loading}
          >
            {loading ? (
              <span className='animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full'></span>
            ) : (
              <Key className='h-4 w-4' />
            )}
            Connect with Extension
          </Button>
        )}

        {!hasExtension && (
          <div className='bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-800 text-sm'>
            <div className='flex items-start gap-2'>
              <AlertCircle className='h-5 w-5 mt-0.5 flex-shrink-0' />
              <div>
                <p className='font-medium'>No Nostr extension detected</p>
                <p className='mt-1'>
                  For the best experience, we recommend installing a Nostr
                  extension like Alby or nos2x.
                </p>
                <div className='mt-3 flex gap-2'>
                  <a
                    href='https://getalby.com'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-amber-900 underline flex items-center gap-1 text-xs'
                  >
                    Get Alby <ExternalLink className='h-3 w-3' />
                  </a>
                  <a
                    href='https://github.com/fiatjaf/nos2x'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-amber-900 underline flex items-center gap-1 text-xs'
                  >
                    Get nos2x <ExternalLink className='h-3 w-3' />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className='relative'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t'></span>
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='bg-white px-2 text-gray-500'>or</span>
          </div>
        </div>

        {showNsecInput ? (
          <div className='space-y-3'>
            <Label htmlFor='nsec'>Enter your private key or nsec</Label>
            <div className='relative'>
              <Input
                id='nsec'
                type='password'
                placeholder='nsec1... or hex private key'
                value={nsecInput}
                onChange={(e) => setNsecInput(e.target.value)}
                className='pr-10'
              />
              <Lock className='absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
            </div>
            <p className='text-xs text-gray-500'>
              Your private key is only stored locally and never sent to our
              servers.
            </p>
            <div className='flex gap-2 mt-2'>
              <Button onClick={handleNsecLogin} className='flex-1'>
                Login
              </Button>
              <Button
                variant='outline'
                onClick={() => setShowNsecInput(false)}
                className='flex-1'
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant='outline'
            onClick={() => setShowNsecInput(true)}
            className='w-full flex items-center justify-center gap-2'
          >
            <Lock className='h-4 w-4' />
            Login with Private Key
          </Button>
        )}
      </CardContent>
      <CardFooter className='flex flex-col gap-4'>
        <p className='text-xs text-center text-gray-500'>
          Already have a Nostr account on apps like Iris, Damus, or Snort? You
          can use the same account here!
        </p>
        {onCancel && (
          <Button variant='ghost' onClick={onCancel} className='w-full'>
            Cancel
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
