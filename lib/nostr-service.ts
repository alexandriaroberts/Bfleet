import { SimplePool, type Event, type Filter } from 'nostr-tools';

// Initialize relay pool
const pool = new SimplePool();

// Set your private relay as the default
const RELAYS = [
  'wss://your-private-relay-url.com', // Replace with your relay URL
  'wss://relay.damus.io', // Keep some public relays as backup
  'wss://nos.lol',
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

// Connect to relays and get events
export async function listEvents(
  filters: Filter[],
  timeoutMs = 3000
): Promise<Event[]> {
  const relays = getRelays();
  console.log(`Fetching events from relays: ${relays.join(', ')}`);
  console.log('With filters:', filters);

  return new Promise((resolve) => {
    const events: Event[] = [];
    let timeoutId: NodeJS.Timeout;

    try {
      // Create a new pool for this request to avoid issues with existing connections
      const requestPool = new SimplePool();

      // Use a timeout to resolve after a certain time
      timeoutId = setTimeout(() => {
        console.log(
          `Timeout reached after ${timeoutMs}ms, returning ${events.length} events`
        );
        resolve(events);
      }, timeoutMs);

      // Try to use get method first (for compatibility)
      requestPool
        .get(relays, filters)
        .then((foundEvents) => {
          if (foundEvents) {
            console.log(`Found ${foundEvents.length} events using pool.get`);
            events.push(...foundEvents);
          }
          clearTimeout(timeoutId);
          resolve(events);
        })
        .catch((error) => {
          console.error('Error using pool.get:', error);

          // If get fails, try using list as fallback
          try {
            const sub = requestPool.sub(relays, filters);

            sub.on('event', (event: Event) => {
              events.push(event);
            });

            sub.on('eose', () => {
              console.log(
                `End of stored events, found ${events.length} events`
              );
              clearTimeout(timeoutId);
              sub.unsub();
              resolve(events);
            });
          } catch (subError) {
            console.error('Error using pool.sub:', subError);
            clearTimeout(timeoutId);
            resolve(events);
          }
        });
    } catch (error) {
      console.error('Error in listEvents:', error);
      clearTimeout(timeoutId);
      resolve(events);
    }
  });
}

// Get a specific event by ID
export async function getEventById(id: string): Promise<Event | null> {
  try {
    const relays = getRelays();
    const events = await pool.get(relays, { ids: [id] });
    return events || null;
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
