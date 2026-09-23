/**
 * Level 1 Service: Knowledge Retriever for Docker Vector Memory
 * Implements Circuit Breaker, Vector Search, and Offline Fallback
 */

import type { DockerMemoryStatus } from '@/types/admin-ai-manual';
import { AdminAiSanitizerService } from './admin-ai-sanitizer.service';
import { getRouteContextChunk, loadOfflineDecisions } from './knowledge-fallback';

export interface RetrievedChunk {
  title: string;
  content: string;
  category: string;
  score: number;
  filePath?: string;
  tags?: string[];
}

export class KnowledgeRetrieverService {
  private static getApiBaseUrl(): string {
    return process.env.VECTOR_MEMORY_URL || process.env.GRAPHRAG_API_URL || 'http://localhost:8100';
  }

  private static getAuthHeaders(): Record<string, string> {
    const token = process.env.KNOWLEDGE_API_TOKEN || process.env.VECTOR_MEMORY_AUTH_TOKEN;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['x-api-key'] = token;
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Checks the health and status of the Docker Vector Memory container
   */
  static async getMemoryStatus(): Promise<DockerMemoryStatus> {
    const baseUrl = this.getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(1500),
      });

      if (res.ok) {
        let pointsCount = 0;
        try {
          const statsRes = await fetch(`${baseUrl}/api/stats`, {
            headers: this.getAuthHeaders(),
            signal: AbortSignal.timeout(1500),
          });
          if (statsRes.ok) {
            const stats = await statsRes.json();
            for (const col of Object.values(stats as Record<string, { points_count?: number }>)) {
              pointsCount += col.points_count || 0;
            }
          }
        } catch {
          // stats error fallback
        }

        return {
          isAvailable: true,
          qdrantPointsCount: pointsCount,
          indexedFilesCount: Math.round(pointsCount / 5),
          mode: 'LIVE_DOCKER',
          vectorModel: 'paraphrase-multilingual-MiniLM-L12-v2',
        };
      }
    } catch {
      // Docker container offline
    }

    // Offline cache stats
    const offlineDecisions = loadOfflineDecisions();
    return {
      isAvailable: false,
      qdrantPointsCount: offlineDecisions.length,
      indexedFilesCount: offlineDecisions.length,
      mode: 'OFFLINE_CACHE',
      vectorModel: 'local-lexical-matcher',
    };
  }

  /**
   * Retrieves relevant code and documentation chunks for a query
   */
  static async retrieveContext(
    query: string,
    currentRoute = '/admin/dashboard',
    topK = 5
  ): Promise<RetrievedChunk[]> {
    const baseUrl = this.getApiBaseUrl();
    const sanitizedQuery = AdminAiSanitizerService.sanitizeInput(query);

    // 1. Try Docker Vector Memory API
    try {
      const res = await fetch(`${baseUrl}/api/search`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(1800), // Circuit breaker 1.8s
        body: JSON.stringify({
          query: sanitizedQuery,
          collections: ['codebase', 'admin_manuals', 'architecture_decisions', 'business_rules'],
          top_k: topK,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data) ? data : data.results || [];
        if (results.length > 0) {
          return results.map((item: any) => ({
            title: item.title || 'Code Snippet',
            content: AdminAiSanitizerService.sanitizeCodeSnippet(item.content || ''),
            category: item.category || 'codebase',
            score: typeof item.score === 'number' ? item.score : 0.85,
            filePath: item.file_path || item.filePath,
            tags: item.tags || [],
          }));
        }
      }
    } catch {
      // Circuit breaker tripped -> Fallback to Offline Cache
    }

    // 2. Offline Fallback from .planning/memory_cache.json + route heuristics
    return this.searchOfflineKnowledge(sanitizedQuery, currentRoute, topK);
  }

  /**
   * Offline Knowledge Matcher using memory_cache.json
   */
  private static searchOfflineKnowledge(
    query: string,
    currentRoute: string,
    topK: number
  ): RetrievedChunk[] {
    const decisions = loadOfflineDecisions();
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const results: RetrievedChunk[] = [];

    // Prioritize decisions
    for (const d of decisions) {
      const text = `${d.title} ${d.decision} ${d.rationale} ${(d.tags || []).join(' ')}`.toLowerCase();
      let matchCount = 0;
      for (const t of terms) {
        if (text.includes(t)) matchCount++;
      }

      if (matchCount > 0 || terms.length === 0) {
        results.push({
          title: d.title,
          content: `## Решение: ${d.decision}\n\nОбоснование: ${d.rationale}\n\nКонтекст: ${d.context}`,
          category: 'architecture_decisions',
          score: 0.5 + Math.min(0.4, matchCount * 0.1),
          tags: d.tags || [],
        });
      }
    }

    // Route-specific fallback chunk
    results.push(getRouteContextChunk(currentRoute));

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}

