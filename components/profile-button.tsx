'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { User } from 'lucide-react';
import { useNostr } from '@/components/nostr-provider';
import { getNpub } from '@/lib/nostr-keys';

export function ProfileButton() {
  const { publicKey, isReady } = useNostr();
  const [npub, setNpub] = useState<string>('');

  useEffect(() => {
    if (publicKey) {
      setNpub(getNpub(publicKey).slice(0, 10) + '...');
    }
  }, [publicKey]);

  return (
    <Link
      href='/profile'
      className='bg-gradient-to-r from-[#FF7170] to-[#FFE57F] text-white px-4 py-2 rounded-full font-medium hover:shadow-glow-orange transition-all flex items-center gap-2'
    >
      <User className='h-4 w-4' />
      {isReady ? npub || 'Profile' : 'Loading...'}
    </Link>
  );
}
