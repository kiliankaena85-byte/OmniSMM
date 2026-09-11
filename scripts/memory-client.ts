/**
 * SMMplan Memory Client SDK v3.0 (Temporal GraphRAG & Evidence Pack Edition)
 * Унифицированный клиент многоуровневой памяти автономных AI-агентов (4-Tier Memory):
 * 1. Working Memory (Active task context)
 * 2. Episodic Memory (Action -> Result -> Reflection log)
 * 3. Semantic Memory (ADR, Business Invariants, Temporal GraphRAG Decay)
 * 4. Procedural Memory (HELP scripts, AST validators, Evidence Packs)
 */

import fs from 'fs';
import path from 'path';

export interface MemorySearchResult {
  title: string;
  content: string;
  collection: string;
  score: number;
  metadata?: Record<string, unknown>;
  graph_relations?: Array<{ from: string; rel: string; to: string }>;
}

export interface EpisodicEntry {
  sessionId: string;
  agentRole: 'Curator' | 'Generator' | 'Reflector' | 'Auditor' | 'ScrumMaster' | 'LegalSpecialist';
  task: string;
  action: string;
  observation: string;
  reflection: string;
  success: boolean;
  affectedFiles?: string[];
  tags?: string[];
}

export interface ArchitecturalDecisionEntry {
  title: string;
  context: string;
  decision: string;
  rationale: string;
  tags: string[];
  supersedesId?: string;
  importance?: number;
  decayRate?: number;
}

export interface TemporalDecayEntry {
  title: string;
  deprecatedNorm: string;
  activeReplacement: string;
  decayFactor: number; // 0.0 - 1.0 (1.0 = fully obsolete)
  reason: string;
  tags: string[];
}

export interface EvidencePackEntry {
  orderId?: string;
  incidentId: string;
  clientIdentifier: string;
  termsVersion: string;
  termsAcceptedAt: string;
  ipAddress: string;
  userAgent: string;
  apiDispatchedAtUtc: string;
  apiProviderResponseHash: string;
  fiscalReceiptFpd: string;
  fiscalReceiptFn: string;
  totalPaidRub: number;
  fprCalculatedRub: number;
  refundRub: number;
  statutoryNorms: string[];
  courtPrecedents: string[];
  winProbabilityScore: number;
}

export class SmmplanMemoryClient {
  private baseUrl: string;
  private offlineCacheFile: string;
  private offlineDecayFile: string;
  private offlineEvidenceDir: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.GRAPHRAG_API_URL || 'http://localhost:8100';
    this.offlineCacheFile = path.resolve(process.cwd(), '.planning/memory_cache.json');
    this.offlineDecayFile = path.resolve(process.cwd(), '.planning/decay_registry.json');
    this.offlineEvidenceDir = path.resolve(process.cwd(), '.planning/evidence_packs');
  }

  /**
   * Curator: Семантический поиск по долговременной памяти перед генерацией
   */
  async searchContext(
    query: string,
    collections: string[] = ['architecture_decisions', 'business_rules', 'coding_conventions', 'tech_debt', 'legal_precedents'],
    topK = 5
  ): Promise<MemorySearchResult[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify({
          query,
          collections,
          top_k: topK,
        }),
      });

      if (!res.ok) {
        throw new Error(`GraphRAG HTTP error ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as {
        results?: MemorySearchResult[];
        assembled_context?: string;
      };

      if (data.results && Array.isArray(data.results)) {
        return data.results;
      }

      if (data.assembled_context) {
        return [
          {
            title: 'GraphRAG Assembled Context',
            content: data.assembled_context,
            collection: 'assembled',
            score: 1.0,
          },
        ];
      }

      return [];
    } catch {
      return this.searchOfflineCache(query);
    }
  }

  /**
   * Reflector: Логирование эпизода действий, ошибки или успешного шага
   */
  async logEpisode(entry: EpisodicEntry): Promise<void> {
    const payload = {
      session_id: entry.sessionId,
      agent_role: entry.agentRole,
      task: entry.task,
      action: entry.action,
      observation: entry.observation,
      reflection: entry.reflection,
      success: entry.success,
      affected_files: entry.affectedFiles || [],
      tags: entry.tags || [],
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${this.baseUrl}/api/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify({
          title: `[Episodic:${entry.agentRole}] ${entry.task.slice(0, 60)}`,
          content: JSON.stringify(payload, null, 2),
          category: entry.success ? 'decisions_log' : 'incidents',
        }),
      });
      if (res.ok) {
        console.log(`🧠 [MemoryClient] Episodic memory logged successfully to GraphRAG.`);
      }
    } catch {
      // Игнорируем сетевые сбои
    }

    this.appendLocalEpisode(payload);
  }

  /**
   * Сохранение архитектурного или правового решения (ADR / Legal Decision)
   */
  async recordDecision(entry: ArchitecturalDecisionEntry): Promise<void> {
    const payload = {
      title: entry.title,
      context: entry.context,
      decision: entry.decision,
      rationale: entry.rationale,
      tags: entry.tags,
      supersedes_id: entry.supersedesId || null,
      importance: entry.importance ?? 1.0,
      decay_rate: entry.decayRate ?? 0.0,
    };

    try {
      const res = await fetch(`${this.baseUrl}/api/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        console.log(`✅ [MemoryClient] Architectural Decision recorded: "${entry.title}"`);
      }
    } catch {
      console.warn(`⚠️ [MemoryClient] Could not send decision to remote API. Saving locally.`);
    }

    this.saveOfflineDecision(entry);
  }

  /**
   * Temporal Decay: Пометка устаревших законов и архитектурных норм с фактором затухания
   */
  async recordDecayedKnowledge(entry: TemporalDecayEntry): Promise<void> {
    const payload = {
      title: `[DEPRECATED_NORM] ${entry.title}`,
      content: `Устаревшая норма: ${entry.deprecatedNorm}\nАктуальная норма 2026: ${entry.activeReplacement}\nПричина: ${entry.reason}\nDecay Factor: ${entry.decayFactor}`,
      category: 'decayed_knowledge',
      decay_factor: entry.decayFactor,
      is_deprecated: true,
      tags: [...entry.tags, 'temporal_decay', 'deprecated'],
    };

    try {
      const res = await fetch(`${this.baseUrl}/api/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        console.log(`⏳ [MemoryClient] Temporal Decay registered in GraphRAG: "${entry.title}" (decay: ${entry.decayFactor})`);
      }
    } catch {
      console.warn(`⚠️ [MemoryClient] GraphRAG offline — saved decay to local registry.`);
    }

    this.saveOfflineDecay(entry);
  }

  /**
   * Evidence Pack Storage: Сохранение судебного досье и доказательного пакета
   */
  async recordEvidencePack(pack: EvidencePackEntry): Promise<string> {
    const packJson = JSON.stringify(pack, null, 2);
    const fileName = `evidence-pack-${pack.incidentId || Date.now()}.json`;

    try {
      const res = await fetch(`${this.baseUrl}/api/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `[EVIDENCE_PACK] Incident ${pack.incidentId} (Win Rate: ${pack.winProbabilityScore}%)`,
          content: packJson,
          category: 'legal_evidence_packs',
          tags: ['evidence_pack', 'court_dossier', '54_fz', 'zozpp'],
        }),
      });
      if (res.ok) {
        console.log(`📦 [MemoryClient] Evidence Pack stored in GraphRAG for incident ${pack.incidentId}`);
      }
    } catch {
      console.warn(`⚠️ [MemoryClient] GraphRAG offline — saving evidence pack locally.`);
    }

    if (!fs.existsSync(this.offlineEvidenceDir)) {
      fs.mkdirSync(this.offlineEvidenceDir, { recursive: true });
    }
    const filePath = path.join(this.offlineEvidenceDir, fileName);
    fs.writeFileSync(filePath, packJson, 'utf-8');
    return filePath;
  }

  private appendLocalEpisode(data: Record<string, unknown>): void {
    const logDir = path.resolve(process.cwd(), '.planning/episodes');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `episodes-${today}.jsonl`);
    fs.appendFileSync(logFile, JSON.stringify(data) + '\n', 'utf-8');
  }

  private saveOfflineDecision(decision: ArchitecturalDecisionEntry): void {
    try {
      let cache: { decisions: ArchitecturalDecisionEntry[] } = { decisions: [] };
      if (fs.existsSync(this.offlineCacheFile)) {
        const raw = fs.readFileSync(this.offlineCacheFile, 'utf-8').trim();
        if (raw) {
          cache = JSON.parse(raw);
        }
      }
      cache.decisions = cache.decisions || [];
      cache.decisions.push(decision);
      fs.writeFileSync(this.offlineCacheFile, JSON.stringify(cache, null, 2), 'utf-8');
      console.log(`💾 [MemoryClient] Decision saved to offline cache: "${decision.title}"`);
    } catch (e) {
      console.error('Failed to save offline decision:', e);
    }
  }

  private saveOfflineDecay(decay: TemporalDecayEntry): void {
    try {
      let registry: { decays: TemporalDecayEntry[] } = { decays: [] };
      if (fs.existsSync(this.offlineDecayFile)) {
        const raw = fs.readFileSync(this.offlineDecayFile, 'utf-8').trim();
        if (raw) {
          registry = JSON.parse(raw);
        }
      }
      registry.decays = registry.decays || [];
      registry.decays.push(decay);
      fs.writeFileSync(this.offlineDecayFile, JSON.stringify(registry, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save offline decay:', e);
    }
  }

  private searchOfflineCache(query: string): MemorySearchResult[] {
    if (!fs.existsSync(this.offlineCacheFile)) return [];
    try {
      const cache = JSON.parse(fs.readFileSync(this.offlineCacheFile, 'utf-8'));
      const q = query.toLowerCase().trim();
      const words = q.split(/\s+/).filter((w) => w.length >= 3);

      const scored: Array<{ entry: ArchitecturalDecisionEntry; score: number }> = [];

      for (const d of cache.decisions || []) {
        if (!d || typeof d !== 'object' || !d.title) continue;

        const title = (d.title || '').toLowerCase();
        const decision = (d.decision || '').toLowerCase();
        const context = (d.context || '').toLowerCase();
        const tags = (Array.isArray(d.tags) ? d.tags.join(' ') : '').toLowerCase();
        const fullText = `${title} ${decision} ${context} ${tags}`;

        let score = 0;

        // Точное совпадение всей фразы
        if (fullText.includes(q)) {
          score += 1.0;
        }

        // Совпадение отдельных ключевых слов
        for (const word of words) {
          if (title.includes(word)) score += 0.4;
          if (tags.includes(word)) score += 0.3;
          if (decision.includes(word)) score += 0.2;
          if (context.includes(word)) score += 0.1;
        }

        if (score > 0) {
          scored.push({ entry: d, score: Math.min(score, 1.0) });
        }
      }

      scored.sort((a, b) => b.score - a.score);

      return scored.slice(0, 5).map(({ entry: m, score }) => ({
        title: m.title,
        content: `${m.context}\n\nDecision: ${m.decision}\nRationale: ${m.rationale || ''}`,
        collection: 'offline_cache',
        score: Math.round(score * 100) / 100,
        metadata: { tags: m.tags },
      }));
    } catch (e) {
      console.error('[MemoryClient] Error searching offline cache:', e);
      return [];
    }
  }
}

// CLI Interface
if (process.argv[1]?.includes('memory-client.ts')) {
  async function cli() {
    const client = new SmmplanMemoryClient();
    const command = process.argv[2];
    const arg = process.argv[3];

    if (command === 'searchContext' || command === 'search') {
      const query = arg || 'баланс пользователя WalletOps';
      console.log(`🔍 [MemoryClient] Searching context for: "${query}"...`);
      const results = await client.searchContext(query);
      console.log(`Found ${results.length} results:`);
      results.forEach((r, i) => {
        console.log(`\n[${i + 1}] ${r.title} (score: ${r.score})`);
        console.log(`    ${r.content.replace(/\n/g, '\n    ')}`);
      });
      return;
    }

    console.log('🧪 Testing Memory Client v3.0...');
    const results = await client.searchContext(arg || 'баланс пользователя WalletOps');
    console.log(`Found ${results.length} results.`);
    results.forEach((r, i) => {
      console.log(`[${i + 1}] ${r.title} (score: ${r.score})`);
    });
  }
  cli().catch(console.error);
}

