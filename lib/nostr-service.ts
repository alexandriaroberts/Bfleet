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
  'wss://relay.current.fyi',
  'wss://nostr-pub.wellorder.net',
  'wss://relay.nostr.bg',
  'wss://nostr.bitcoiner.social',
  'wss://relay.nostr.info',
];

// Get relays from localStorage or use defaults
export function getRelays(): string[] {
  try {
    const storedRelays = localStorage.getItem('relays');
    if (storedRelays) {
      const parsedRelays = JSON.parse(storedRelays);
      // Ensure we have at least 3 relays
      return Array.isArray(parsedRelays) && parsedRelays.length >= 3
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
  // Ensure we have at least 3 relays
  const validRelays = relays.length >= 3 ? relays : [...RELAYS];
  localStorage.setItem('relays', JSON.stringify(validRelays));
}

// Check if a relay is responsive with improved timeout handling
export async function checkRelay(
  relay: string,
  timeoutMs = 5000
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Detect browser for appropriate timeout
      const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');
      const isChrome = typeof navigator !== 'undefined' && navigator.userAgent.includes('Chrome');
      const adjustedTimeout = isFirefox ? timeoutMs * 2 : isChrome ? timeoutMs * 1.5 : timeoutMs;

      const ws = new WebSocket(relay);
      const timeoutId = setTimeout(() => {
        ws.close();
        resolve(false);
      }, adjustedTimeout);

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

// Update the listEvents function to filter out non-package/delivery events
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

  // Add retry logic with increased timeout
  let retries = 0;
  const maxRetries = 5; // Increased from 3 to 5
  const retryDelay = 1000; // Increased from 500 to 1000

  while (retries < maxRetries) {
    try {
      console.log(`Attempt ${retries + 1} to fetch events`);
      
      // Try to fetch from each relay individually
      const relayPromises = relays.map(async (relay) => {
        try {
          const events = await fetchEventsWithTimeout(
            [relay],
            fixedFilter,
            timeoutMs * (retries + 1)
          );
          console.log(`Fetched ${events.length} events from ${relay}`);
          return events;
        } catch (error) {
          console.error(`Error fetching from ${relay}:`, error);
          return [];
        }
      });

      const allEvents = await Promise.all(relayPromises);
      const events = allEvents.flat();

      // Less strict filtering - only check if content is a string
      const filteredEvents = events.filter((event) => {
        if (typeof event.content !== 'string') {
          console.log(`Skipping event ${event.id} with non-string content`);
          return false;
        }
        return true;
      });

      // Remove duplicates based on event ID
      const uniqueEvents = Array.from(
        new Map(filteredEvents.map(event => [event.id, event])).values()
      );

      console.log(
        `Filtered ${events.length - uniqueEvents.length} invalid/duplicate events`
      );

      if (uniqueEvents.length > 0) {
        console.log(
          `Successfully fetched ${uniqueEvents.length} unique events on attempt ${
            retries + 1
          }`
        );
        return uniqueEvents;
      }
      retries++;
      // Wait longer before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    } catch (error) {
      console.error(`Error on attempt ${retries + 1}:`, error);
      retries++;
      if (retries >= maxRetries) {
        console.log('Max retries reached, returning empty array');
        return [];
      }
      // Wait longer before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  console.log('No events found after all retries');
  return [];
}

// Helper function to fetch events with a timeout
async function fetchEventsWithTimeout(
  relays: string[],
  filter: Filter,
  timeoutMs: number
): Promise<Event[]> {
  return new Promise((resolve, reject) => {
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
          .get(relays, filter)
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
            clearTimeout(timeoutId);
            reject(error);
          });
      } catch (error) {
        console.error('Error in fetchEventsWithTimeout:', error);
        clearTimeout(timeoutId);
        reject(error);
      }
    } catch (error) {
      console.error('Error in fetchEventsWithTimeout:', error);
      clearTimeout(timeoutId!);
      reject(error);
    }
  });
}

// Get a specific event by ID with retry logic
export async function getEventById(id: string): Promise<Event | null> {
  try {
    const relays = getRelays();

    // Add retry logic
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        console.log(`Attempt ${retries + 1} to get event ${id}`);
        const event = await pool.get(relays, { ids: [id] });
        if (event) {
          console.log(
            `Successfully fetched event ${id} on attempt ${retries + 1}`
          );
          return event;
        }
        retries++;
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error on attempt ${retries + 1}:`, error);
        retries++;
        if (retries >= maxRetries) {
          console.log('Max retries reached, returning null');
          return null;
        }
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`Event ${id} not found after all retries`);
    return null;
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

// Add retry mechanism for failed operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Operation failed (attempt ${i + 1}/${maxRetries}):`, error);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

// Update publishEvent to use retry mechanism
export async function publishEvent(event: any): Promise<boolean[]> {
  const relays = getRelays();
  console.log(`Publishing event ${event.id} to ${relays.length} relays`);
  
  const results = await Promise.all(
    relays.map(async (relay): Promise<boolean> => {
      try {
        return await retryOperation(async () => {
          const ws = new WebSocket(relay);
          
          return new Promise<boolean>((resolve, reject) => {
            const timeout = setTimeout(() => {
              ws.close();
              reject(new Error(`Timeout publishing to ${relay}`));
            }, 5000);
            
            ws.onopen = () => {
              ws.send(JSON.stringify(['EVENT', event]));
              console.log(`Event ${event.id} sent to ${relay}`);
            };
            
            ws.onmessage = (e) => {
              const response = JSON.parse(e.data);
              if (response[0] === 'OK' && response[1] === event.id) {
                clearTimeout(timeout);
                ws.close();
                console.log(`Event ${event.id} confirmed by ${relay}`);
                resolve(true);
              }
            };
            
            ws.onerror = (error) => {
              clearTimeout(timeout);
              ws.close();
              console.error(`Error publishing to ${relay}:`, error);
              reject(error);
            };
          });
        });
      } catch (error) {
        console.error(`Failed to publish to ${relay}:`, error);
        return false;
      }
    })
  );
  
  const successCount = results.filter(Boolean).length;
  console.log(`Event ${event.id} published to ${successCount}/${relays.length} relays`);
  
  return results;
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
