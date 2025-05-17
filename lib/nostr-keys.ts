import { nip19, getPublicKey } from 'nostr-tools';

// Helper function to convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// Get or generate user keys
export function getUserKeys(): { privateKey: string; publicKey: string } {
  if (typeof window === 'undefined') {
    // Server-side rendering, return placeholder
    return { privateKey: '', publicKey: '' };
  }

  // For MVP, store in localStorage. For production, use more secure methods
  let privateKey = localStorage.getItem('nostr_private_key');
  if (!privateKey) {
    // Generate a random private key (32 bytes, hex encoded)
    const randomBytes = new Uint8Array(32);
    window.crypto.getRandomValues(randomBytes);
    privateKey = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    localStorage.setItem('nostr_private_key', privateKey);
  }

  const publicKey = getPublicKey(hexToUint8Array(privateKey));
  return { privateKey, publicKey };
}

// Get npub (public key in bech32 format)
export function getNpub(publicKey: string): string {
  return nip19.npubEncode(publicKey);
}

// Get nsec (private key in bech32 format)
export function getNsec(privateKey: string): string {
  return nip19.nsecEncode(hexToUint8Array(privateKey));
}

// Get public key from private key (nsec)
export function getPublicKeyFromPrivateKey(nsec: string): string {
  try {
    // If it's a bech32 encoded nsec, decode it first
    if (nsec.startsWith('nsec1')) {
      const { data } = nip19.decode(nsec);
      if (typeof data === 'string') {
        return getPublicKey(hexToUint8Array(data));
      }
      throw new Error('Invalid nsec format');
    }
    // Otherwise assume it's a hex private key
    return getPublicKey(hexToUint8Array(nsec));
  } catch (error) {
    console.error('Failed to get public key from private key:', error);
    throw new Error('Invalid private key');
  }
}

// Check if we have browser extension (NIP-07) support
export function hasNostrExtension(): boolean {
  return typeof window !== 'undefined' && window.nostr !== undefined;
}

// Try to get public key from extension
export async function getExtensionPublicKey(): Promise<string | null> {
  if (!hasNostrExtension() || !window.nostr) return null;

  try {
    return await window.nostr.getPublicKey();
  } catch (error) {
    console.error('Failed to get public key from extension:', error);
    return null;
  }
}

// Sign event with extension
export async function signWithExtension(event: any): Promise<any> {
  if (!hasNostrExtension() || !window.nostr) return null;

  try {
    return await window.nostr.signEvent(event);
  } catch (error) {
    console.error('Failed to sign event with extension:', error);
    return null;
  }
}

// Add window.nostr type definition
declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: any): Promise<any>;
    };
  }
}
