import type { Event } from 'nostr-tools';

export const EVENT_KINDS = {
  METADATA: 0, // Standard profile metadata
  TEXT_NOTE: 1, // Standard text note
  PACKAGE_LISTING: 30001, // Custom: Available package listing
  PACKAGE_PICKUP: 30002, // Custom: Package pickup confirmation
  PACKAGE_DELIVERY: 30003, // Custom: Package delivery confirmation
};

export interface PackageData {
  id: string;
  title: string;
  pickupLocation: string;
  destination: string;
  cost: string;
  description?: string;
  status: 'available' | 'in_transit' | 'delivered';
  pubkey?: string;
}

export interface ProfileData {
  pubkey: string;
  name?: string;
  displayName?: string;
  picture?: string;
  about?: string;
  website?: string;
  nip05?: string;
  followers?: number;
  following?: number;
  deliveries?: number;
  rating?: number;
}

export interface NostrPackageEvent extends Event {
  content: string; // JSON stringified package data
  tags: string[][]; // Tags including location, destination, etc.
}

export interface NostrProfileEvent extends Event {
  content: string; // JSON stringified profile data
}

export interface RelayInfo {
  url: string;
  status: 'connected' | 'connecting' | 'error';
  read: boolean;
  write: boolean;
}
