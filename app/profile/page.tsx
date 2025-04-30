'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeft, User, Star, Package, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { getUserProfile, type ProfileData } from '@/lib/nostr';
import { toast } from 'sonner';
import Image from 'next/image';

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileData = await getUserProfile();
        setProfile(profileData);
      } catch (error) {
        toast.error('Error', {
          description: 'Failed to load profile data.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return (
    <div className='container mx-auto px-4 py-8'>
      <Link href='/' className='flex items-center text-sm mb-6 hover:underline'>
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Home
      </Link>

      <Card className='max-w-md mx-auto'>
        <CardHeader>
          <CardTitle className='flex items-center'>
            <User className='mr-2 h-5 w-5' />
            Profile
          </CardTitle>
          <CardDescription>Your Nostr profile and reputation</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {loading ? (
            <div className='flex justify-center py-8'>
              <div className='animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full'></div>
            </div>
          ) : profile ? (
            <>
              <div className='flex justify-center mb-4'>
                {profile.picture ? (
                  <Image
                    src='/placeholder.png'
                    alt={profile.displayName || profile.name || 'User'}
                    width={96}
                    height={96}
                    className='w-24 h-24 rounded-full object-cover centre'
                  />
                ) : (
                  <div className='w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center'>
                    <User className='h-12 w-12 text-gray-500' />
                  </div>
                )}
              </div>
              <div className='text-center'>
                <h2 className='text-xl font-bold'>
                  {profile.displayName || profile.name || 'Anonymous User'}
                </h2>
                <p className='text-sm text-gray-500 break-all'>
                  {profile.pubkey}
                </p>
              </div>

              <div className='grid grid-cols-3 gap-4 text-center pt-4'>
                <div>
                  <p className='text-2xl font-bold'>{profile.followers || 0}</p>
                  <p className='text-sm text-gray-500'>Followers</p>
                </div>
                <div>
                  <p className='text-2xl font-bold'>{profile.following || 0}</p>
                  <p className='text-sm text-gray-500'>Following</p>
                </div>
                <div>
                  <p className='text-2xl font-bold'>
                    {profile.deliveries || 0}
                  </p>
                  <p className='text-sm text-gray-500'>Deliveries</p>
                </div>
              </div>

              <div className='pt-4'>
                <div className='flex items-center justify-center'>
                  <Star
                    className='h-5 w-5 text-yellow-500 mr-1'
                    fill='currentColor'
                  />
                  <span className='text-lg font-bold'>
                    {profile.rating || 0}
                  </span>
                  <span className='text-sm text-gray-500 ml-1'>/5</span>
                </div>
                <p className='text-center text-sm text-gray-500 mt-1'>
                  Reputation Score
                </p>
              </div>

              <div className='border-t pt-4 mt-4'>
                <h3 className='font-medium text-center mb-3'>Activity</h3>
                <div className='space-y-2'>
                  <div className='flex items-center p-2 rounded-md bg-gray-50 dark:bg-gray-800'>
                    <Package className='h-4 w-4 mr-2 text-blue-500' />
                    <span className='text-sm'>
                      Posted a package for delivery
                    </span>
                    <span className='text-xs text-gray-500 ml-auto'>
                      2 days ago
                    </span>
                  </div>
                  <div className='flex items-center p-2 rounded-md bg-gray-50 dark:bg-gray-800'>
                    <CheckCircle className='h-4 w-4 mr-2 text-green-500' />
                    <span className='text-sm'>Completed a delivery</span>
                    <span className='text-xs text-gray-500 ml-auto'>
                      5 days ago
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className='text-center py-8 text-gray-500'>
              Failed to load profile data
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
