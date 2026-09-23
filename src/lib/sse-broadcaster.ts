/**
 * SSE Broadcaster — In-memory pub/sub for real-time live chat streams.
 *
 * Publishes TicketMessage events to all subscribed SSE connections
 * for a given ticketId. Lightweight, zero-dependency, process-local.
 *
 * ARCHITECTURE NOTE: This is intentionally in-memory (not Redis Pub/Sub)
 * because SMMplan runs as a single Node.js process. If horizontal scaling
 * is ever needed, replace with Redis Pub/Sub adapter.
 */

type Listener = (message: unknown) => void;

class SSEBroadcaster {
  private channels: Map<string, Set<Listener>> = new Map();

  /**
   * Subscribe a listener to a ticket's message stream.
   * Returns an unsubscribe function for cleanup.
   */
  subscribe(ticketId: string, listener: Listener): () => void {
    if (!this.channels.has(ticketId)) {
      this.channels.set(ticketId, new Set());
    }
    this.channels.get(ticketId)!.add(listener);

    return () => this.unsubscribe(ticketId, listener);
  }

  /**
   * Remove a listener from a ticket's message stream.
   * Automatically cleans up empty channels to prevent memory leaks.
   */
  unsubscribe(ticketId: string, listener: Listener): void {
    const channel = this.channels.get(ticketId);
    if (channel) {
      channel.delete(listener);
      if (channel.size === 0) {
        this.channels.delete(ticketId);
      }
    }
  }

  /**
   * Broadcast a message to all listeners subscribed to a ticket.
   */
  publish(ticketId: string, message: unknown): void {
    const channel = this.channels.get(ticketId);
    if (channel) {
      for (const listener of channel) {
        try {
          listener(message);
        } catch (err) {
          console.error('[SSEBroadcaster] Listener error:', err);
        }
      }
    }
  }

  /**
   * Get the number of active connections for a ticket (diagnostics).
   */
  getConnectionCount(ticketId: string): number {
    return this.channels.get(ticketId)?.size ?? 0;
  }

  /**
   * Get total active connections across all tickets (diagnostics).
   */
  getTotalConnections(): number {
    let total = 0;
    for (const channel of this.channels.values()) {
      total += channel.size;
    }
    return total;
  }
}

// Singleton — shared across all SSE route handlers in the same process (stored on globalThis for Next.js hot-reloading)
const globalForSSE = globalThis as unknown as {
  sseBroadcaster?: SSEBroadcaster;
};

export const sseBroadcaster = globalForSSE.sseBroadcaster ?? new SSEBroadcaster();

globalForSSE.sseBroadcaster = sseBroadcaster;

