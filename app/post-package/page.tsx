'use client';

import type React from 'react';

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Package } from 'lucide-react';
import Link from 'next/link';
import { createPackage } from '@/lib/nostr';

export default function PostPackage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    pickupLocation: '',
    destination: '',
    cost: '',
    description: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // This is a placeholder for the actual Nostr event creation
      // In a real implementation, this would publish to your Nostr relay
      await createPackage(formData);

      toast.success('Package Posted', {
        description: 'Your package has been successfully posted for delivery.',
      });

      router.push('/view-packages');
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to post package. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='container mx-auto px-4 py-8'>
      <Link href='/' className='flex items-center text-sm mb-6 hover:underline'>
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Home
      </Link>

      <Card className='max-w-2xl mx-auto'>
        <CardHeader>
          <CardTitle className='flex items-center'>
            <Package className='mr-2 h-5 w-5' />
            Post a Package
          </CardTitle>
          <CardDescription>
            Create a new delivery request with all the necessary details
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='title'>Package Title</Label>
              <Input
                id='title'
                name='title'
                placeholder='Small box of books'
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='pickupLocation'>Pickup Location</Label>
              <Input
                id='pickupLocation'
                name='pickupLocation'
                placeholder='123 Main St, City'
                value={formData.pickupLocation}
                onChange={handleChange}
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='destination'>Destination</Label>
              <Input
                id='destination'
                name='destination'
                placeholder='456 Oak Ave, City'
                value={formData.destination}
                onChange={handleChange}
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='cost'>Cost (sats)</Label>
              <Input
                id='cost'
                name='cost'
                type='number'
                placeholder='10000'
                value={formData.cost}
                onChange={handleChange}
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='description'>Description (optional)</Label>
              <Textarea
                id='description'
                name='description'
                placeholder='Additional details about the package...'
                value={formData.description}
                onChange={handleChange}
                rows={3}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type='submit' className='w-full' disabled={isSubmitting}>
              {isSubmitting ? 'Posting...' : 'Post Package'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
