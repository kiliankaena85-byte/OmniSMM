/**
 * Level 1 Service: In-Memory LRU Cache with TTL for Admin AI Assistant Responses
 * Eliminates LLM token consumption & latency for duplicate or standard admin queries.
 * Complies with Clean Architecture Level 1 and <= 200 lines limit.
 */

import crypto from 'crypto';
import type { RetrievedChunk } from './knowledge-retriever.service';

export interface CachedAssistantResponse {
  key: string;
  route: string;
  normalizedQuery: string;
  fullText: string;
  chunksUsed: RetrievedChunk[];
  createdAt: number;
  expiresAt: number;
  hitCount: number;
}

export interface AssistantCacheStats {
  size: number;
  maxCapacity: number;
  hits: number;
  misses: number;
  estimatedTokensSaved: number;
}

export class AssistantResponseCache {
  private static readonly MAX_CAPACITY = 200;
  private static readonly DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

  // Internal LRU map (oldest keys first)
  private static cache = new Map<string, CachedAssistantResponse>();
  private static hits = 0;
  private static misses = 0;
  private static tokensSaved = 0;

  /**
   * Normalizes tenant, route and query to generate a deterministic cache key
   */
  static generateKey(route: string, query: string, tenantId: string = 'smmplan'): string {
    const normTenant = (tenantId || 'smmplan').trim().toLowerCase();
    const normRoute = (route || '/admin/dashboard').trim().toLowerCase().replace(/\/+$/, '');
    const normQuery = query
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '') // Keep letters and digits in Russian and English
      .replace(/\s+/g, ' ');

    const raw = `${normTenant}::${normRoute}::${normQuery}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }

  /**
   * Retrieves an item from LRU cache if valid and not expired
   */
  static get(route: string, query: string, tenantId: string = 'smmplan'): CachedAssistantResponse | null {
    const key = this.generateKey(route, query, tenantId);
    const item = this.cache.get(key);

    if (!item) {
      this.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update LRU position: re-insert at end
    this.cache.delete(key);
    item.hitCount++;
    this.cache.set(key, item);

    this.hits++;
    // Approximate saved tokens: query tokens (~words*1.3) + answer tokens (~words*1.3)
    const estWords = (item.fullText.length + query.length) / 4;
    this.tokensSaved += Math.round(estWords * 1.3);

    return item;
  }

  /**
   * Stores a response in the LRU cache with TTL
   */
  static set(
    route: string,
    query: string,
    data: { fullText: string; chunksUsed: RetrievedChunk[] },
    ttlMs: number = this.DEFAULT_TTL_MS,
    tenantId: string = 'smmplan'
  ): void {
    if (!data.fullText || data.fullText.length < 5) return;

    const key = this.generateKey(route, query, tenantId);
    const now = Date.now();

    // Evict oldest if capacity exceeded
    if (this.cache.size >= this.MAX_CAPACITY && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      key,
      route,
      normalizedQuery: query.trim().toLowerCase(),
      fullText: data.fullText,
      chunksUsed: data.chunksUsed || [],
      createdAt: now,
      expiresAt: now + ttlMs,
      hitCount: 0,
    });
  }

  /**
   * Checks if a query is cached and active
   */
  static has(route: string, query: string, tenantId: string = 'smmplan'): boolean {
    const key = this.generateKey(route, query, tenantId);
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Clears the entire cache
   */
  static clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.tokensSaved = 0;
  }

  /**
   * Returns cache runtime statistics
   */
  static getStats(): AssistantCacheStats {
    return {
      size: this.cache.size,
      maxCapacity: this.MAX_CAPACITY,
      hits: this.hits,
      misses: this.misses,
      estimatedTokensSaved: this.tokensSaved,
    };
  }
}
