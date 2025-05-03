import { SimplePool, type Event, type Filter } from 'nostr-tools';

// Initialize relay pool
const pool = new SimplePool();

// First, update the RELAYS array to include more public relays
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://nostr-pub.wellorder.net',
  'wss://relay.current.fyi',
  'wss://your-private-relay-url.com', // Keep this as fallback
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

// Update the listEvents function to work with nostr-tools v2.12.0
export async function listEvents(
  filters: Filter[],
  timeoutMs = 5000
): Promise<Event[]> {
  const relays = getRelays();
  console.log(`Fetching events from relays: ${relays.join(', ')}`);
  console.log('With filters:', filters);

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

      // Use the query method which is available in nostr-tools v2.12.0
      pool.querySync(relays, filters, {
        onEvent: (event: Event) => {
          // Check if this event is already in our list (by ID)
          if (!events.some((e) => e.id === event.id)) {
            events.push(event);
          }
        },
        oneose: () => {
          console.log(`End of stored events, found ${events.length} events`);
          clearTimeout(timeoutId);
          resolve(events);
        },
      });
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

// Publish an event to relays with better error handling
export async function publishEvent(event: Event): Promise<string[]> {
  try {
    const relays = getRelays();
    console.log(`Publishing event to relays: ${relays.join(', ')}`);
    console.log('Event:', event);

    const pubs = pool.publish(relays, event);

    // Add timeout to each publish promise
    const pubsWithTimeout = pubs.map((pub) => {
      return Promise.race([
        pub,
        new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error('Relay timeout')), 5000);
        }),
      ]).catch((err) => {
        console.log('Relay publish error or timeout:', err);
        return 'timeout'; // Return a string to keep the promise resolved
      });
    });

    return await Promise.all(pubsWithTimeout);
  } catch (error) {
    console.error('Failed to publish event:', error);
    throw error;
  }
}

// Close all connections
export function closePool(): void {
  try {
    const relays = getRelays();
    pool.close(relays);
  } catch (error) {
    console.error('Failed to close pool:', error);
  }
}
