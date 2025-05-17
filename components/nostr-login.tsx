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
import { Key, AlertCircle, ExternalLink, Lock } from 'lucide-react';
import { getPublicKeyFromPrivateKey } from '@/lib/nostr-keys';

interface NostrLoginProps {
  onLogin: (publicKey: string) => void;
  onCancel?: () => void;
}

export function NostrLogin({ onLogin, onCancel }: NostrLoginProps) {
  const [loading, setLoading] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [nsec, setNsec] = useState('');

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

  const handleNsecLogin = async () => {
    setLoading(true);
    try {
      if (!nsec) {
        throw new Error('Please enter your nsec');
      }

      // Get public key from private key
      const publicKey = getPublicKeyFromPrivateKey(nsec);
      
      if (!publicKey) {
        throw new Error('Invalid nsec');
      }

      // Store both keys in localStorage
      localStorage.setItem('nostr_pubkey', publicKey);
      localStorage.setItem('nostr_privkey', nsec);

      toast.success('Successfully logged in with nsec', {
        description: 'You are now logged in with your nsec',
      });

      onLogin(publicKey);
    } catch (error) {
      console.error('Nsec login error:', error);
      toast.error('Login Failed', {
        description: 'Invalid nsec. Please check and try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Don't render extension-specific content until after client-side mount
  if (!mounted) {
    return (
      <Card className='w-full max-w-md mx-auto'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 '>
            <Key className='h-5 w-5' />
            Connect to Nostr
          </CardTitle>
          <CardDescription>
            Use your existing Nostr account to connect to A to ₿
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
          Use your existing Nostr account to connect to A to ₿
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {hasExtension && (
          <Button
            onClick={handleExtensionLogin}
            className='w-full flex items-center justify-center gap-2 bg-gray-50'
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

        <div className='relative'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t border-gray-200' />
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='bg-white px-2 text-gray-500'>Or</span>
          </div>
        </div>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='nsec'>Enter your nsec</Label>
            <Input
              id='nsec'
              type='password'
              placeholder='nsec1...'
              value={nsec}
              onChange={(e) => setNsec(e.target.value)}
              className='font-mono'
            />
          </div>
          <Button
            onClick={handleNsecLogin}
            className='w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#FF7170] to-[#FFE57F] text-white'
            disabled={loading || !nsec}
          >
            {loading ? (
              <span className='animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full'></span>
            ) : (
              <Lock className='h-4 w-4' />
            )}
            Login with nsec
          </Button>
        </div>

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
