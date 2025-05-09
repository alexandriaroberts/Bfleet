import { SimplePool, type Event, type Filter, nip19 } from 'nostr-tools';

// Initialize relay pool
const pool = new SimplePool();

// Define event kinds for our application
export const EVENT_KINDS = {
  METADATA: 0, // Standard Nostr metadata
  TEXT_NOTE: 1, // Standard Nostr text note
  PACKAGE: 30001, // Custom event kind for packages
  DELIVERY: 30002, // Custom event kind for deliveries
};

// Update the RELAYS array with more reliable relays
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.nostr.band',
];

// Get relays from localStorage or use defaults
export function getRelays(): string[] {
  try {
    const storedRelays = localStorage.getItem('relays');
    if (storedRelays) {
      const parsedRelays = JSON.parse(storedRelays);
      return Array.isArray(parsedRelays) && parsedRelays.length > 0
        ? parsedRelays
        : [...RELAYS];
    }
  } catch (error) {
    console.error('Failed to parse stored relays:', error);
  }
  return [...RELAYS];
}

// Set available relays
export function setRelays(relays: string[]): void {
  localStorage.setItem('relays', JSON.stringify(relays));
}

// Check if a relay is responsive
export async function checkRelay(
  relay: string,
  timeoutMs = 3000
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(relay);
      const timeoutId = setTimeout(() => {
        ws.close();
        resolve(false);
      }, timeoutMs);

      ws.onopen = () => {
        clearTimeout(timeoutId);
        ws.close();
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timeoutId);
        resolve(false);
      };
    } catch (error) {
      console.error(`Error checking relay ${relay}:`, error);
      resolve(false);
    }
  });
}

// Get working relays
export async function getWorkingRelays(): Promise<string[]> {
  const relays = getRelays();
  const workingRelays: string[] = [];

  // Check all relays in parallel
  const results = await Promise.all(relays.map((relay) => checkRelay(relay)));

  // Filter out non-working relays
  relays.forEach((relay, index) => {
    if (results[index]) {
      workingRelays.push(relay);
    } else {
      console.warn(`Relay ${relay} is not responding, skipping`);
    }
  });

  // If no relays are working, return all relays as a fallback
  if (workingRelays.length === 0) {
    console.warn('No working relays found, using all relays as fallback');
    return relays;
  }

  return workingRelays;
}

// Update the listEvents function to add more debugging
export async function listEvents(
  filters: Filter[],
  timeoutMs = 5000
): Promise<Event[]> {
  // Get only working relays
  const allRelays = getRelays();
  console.log(`Checking relays: ${allRelays.join(', ')}`);

  // Use all relays for now, but log which ones are working
  const relays = allRelays;

  console.log(`Using relays: ${relays.join(', ')}`);

  // Fix: Ensure filter is properly formatted
  let fixedFilter: Filter = { kinds: [EVENT_KINDS.PACKAGE] };

  if (filters.length > 0 && filters[0].kinds && filters[0].kinds.length > 0) {
    fixedFilter = filters[0];
    console.log('Using filter:', fixedFilter);
  } else {
    console.log('Using default filter:', fixedFilter);
  }

  return new Promise((resolve) => {
    const events: Event[] = [];
    let timeoutId: NodeJS.Timeout;

    try {
      // Set up a timeout to resolve after a certain time
      timeoutId = setTimeout(() => {
        console.log(
          `Timeout reached after ${timeoutMs}ms, returning ${events.length} events`
        );
        resolve(events);
      }, timeoutMs);

      // Try different methods based on what's available in the nostr-tools version
      try {
        console.log('Fetching events with pool.get...');
        // Method 1: Try using get (most compatible)
        pool
          .get(relays, fixedFilter)
          .then((foundEvents) => {
            console.log('pool.get returned:', foundEvents ? 'data' : 'null');
            if (foundEvents) {
              if (Array.isArray(foundEvents)) {
                console.log(`Found ${foundEvents.length} events`);
                events.push(...foundEvents);
              } else {
                console.log('Found a single event');
                events.push(foundEvents);
              }
            }
            clearTimeout(timeoutId);
            resolve(events);
          })
          .catch((error) => {
            console.error('Error using pool.get:', error);
            // Don't resolve here, let the timeout handle it or try other methods
          });
      } catch (error) {
        console.error('Error in listEvents:', error);
        // Don't resolve here, let the timeout handle it
      }
    } catch (error) {
      console.error('Error in listEvents:', error);
      clearTimeout(timeoutId!);
      resolve(events);
    }
  });
}

// Get a specific event by ID
export async function getEventById(id: string): Promise<Event | null> {
  try {
    const relays = getRelays();
    const event = await pool.get(relays, { ids: [id] });
    return event || null;
  } catch (error) {
    console.error('Failed to get event:', error);
    return null;
  }
}

// Create and sign an event with the Nostr extension
export async function createSignedEvent(
  kind: number,
  content: string,
  tags: string[][] = []
): Promise<Event> {
  if (!window.nostr) {
    throw new Error('Nostr extension not available');
  }

  const pubkey = await window.nostr.getPublicKey();

  // Create the event without id and sig
  const event = {
    kind,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
    id: '', // Will be set by the extension
    sig: '', // Will be set by the extension
  };

  try {
    // Use the extension to sign the event
    const signedEvent = await window.nostr.signEvent(event);
    return signedEvent;
  } catch (error) {
    console.error('Failed to sign event with extension:', error);
    throw error;
  }
}

// Publish an event to relays with better error handling and retry logic
export async function publishEvent(event: Event): Promise<string[]> {
  try {
    const relays = getRelays();
    console.log(`Publishing event to relays: ${relays.join(', ')}`);
    console.log('Event:', event);

    // Validate the event before publishing
    if (!event.sig || typeof event.sig !== 'string') {
      throw new Error('Event signature is missing or invalid');
    }

    // Try to publish to all relays
    const pubs = pool.publish(relays, event);

    // Add timeout to each publish promise
    const pubsWithTimeout = pubs.map((pub, index) => {
      const relay = relays[index];
      return Promise.race([
        pub.then(() => {
          console.log(`✅ Successfully published to ${relay}`);
          return relay;
        }),
        new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error(`Relay timeout: ${relay}`)), 5000);
        }),
      ]).catch((err) => {
        console.log(`❌ Failed to publish to ${relay}:`, err);
        return `failed:${relay}`; // Return a string to keep the promise resolved
      });
    });

    const results = await Promise.all(pubsWithTimeout);

    // Count successful publishes
    const successCount = results.filter((r) => !r.startsWith('failed:')).length;
    console.log(`Published to ${successCount}/${relays.length} relays`);

    if (successCount === 0) {
      console.error('Failed to publish to any relay');
    }

    return results;
  } catch (error) {
    console.error('Failed to publish event:', error);
    throw error;
  }
}

// Close all connections
export function closePool(): void {
  try {
    pool.close(getRelays());
  } catch (error) {
    console.error('Failed to close pool:', error);
  }
}

// Helper function to convert npub to hex pubkey
export function npubToHex(npub: string): string {
  try {
    const { data } = nip19.decode(npub);
    return data as string;
  } catch (error) {
    console.error('Failed to convert npub to hex:', error);
    return '';
  }
}

// Helper function to convert hex pubkey to npub
export function hexToNpub(hex: string): string {
  try {
    return nip19.npubEncode(hex);
  } catch (error) {
    console.error('Failed to convert hex to npub:', error);
    return '';
  }
}
