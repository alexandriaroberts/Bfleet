'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getNpub } from '@/lib/nostr-keys';
import { useNostr } from '@/components/nostr-provider';
import { Key, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function NostrConnectButton() {
  const { publicKey, isReady, isLoggedIn, logout } = useNostr();
  const [npub, setNpub] = useState<string>('');

  useEffect(() => {
    if (publicKey) {
      try {
        const fullNpub = getNpub(publicKey);
        setNpub(fullNpub.slice(0, 10) + '...' + fullNpub.slice(-4));
      } catch (error) {
        console.error('Error formatting npub:', error);
        setNpub(publicKey.slice(0, 8) + '...');
      }
    }
  }, [publicKey]);

  if (!isReady) {
    return (
      <Button disabled className='flex items-center gap-2'>
        <span className='animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full'></span>
        Loading...
      </Button>
    );
  }

  if (isLoggedIn) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className='flex items-center gap-2'>
            <User className='h-4 w-4' />
            {npub}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <Link href='/profile'>
            <DropdownMenuItem>
              <User className='mr-2 h-4 w-4' />
              <span>Profile</span>
            </DropdownMenuItem>
          </Link>
          <DropdownMenuItem onClick={logout}>
            <LogOut className='mr-2 h-4 w-4' />
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Link href='/login'>
      <Button className='flex items-center gap-2'>
        <Key className='h-4 w-4' />
        Login with Nostr
      </Button>
    </Link>
  );
}
