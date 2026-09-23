import { db } from '@/lib/db';
import * as net from 'node:net';

interface ProxyCandidate {
  host: string;
  port: number;
  protocol: 'socks5' | 'http';
  source: string;
}

export class FreeProxyHarvesterService {
  private static readonly MAX_TEST_TIMEOUT_MS = 2000;
  private static readonly TARGET_HARVEST_COUNT = 30;

  /**
   * Fast TCP latency probe to test if proxy port is listening and responsive.
   */
  public static async probeCandidateLatency(host: string, port: number): Promise<number | null> {
    return new Promise<number | null>((resolve) => {
      const startTime = Date.now();
      const socket = new net.Socket();

      socket.setTimeout(this.MAX_TEST_TIMEOUT_MS);

      socket.connect(port, host, () => {
        const latency = Date.now() - startTime;
        socket.destroy();
        resolve(latency);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(null);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(null);
      });
    });
  }

  /**
   * Fetches proxy candidates from monosans/proxy-list (SOCKS5).
   */
  private static async fetchMonosansCandidates(): Promise<ProxyCandidate[]> {
    try {
      const res = await fetch(
        'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) return [];
      const text = await res.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      const candidates: ProxyCandidate[] = [];
      for (const line of lines.slice(0, 100)) {
        const [host, portStr] = line.split(':');
        const port = parseInt(portStr, 10);
        if (host && !isNaN(port) && port > 0 && port <= 65535) {
          candidates.push({ host, port, protocol: 'socks5', source: 'monosans' });
        }
      }
      return candidates;
    } catch {
      return [];
    }
  }

  /**
   * Main Harvester Execution:
   * 1. Fetches candidate proxies.
   * 2. Tests their latency in parallel (up to 15 concurrent probes).
   * 3. Persists healthy proxies into PostgreSQL under `category = 'FREE_PUBLIC'`.
   */
  public static async harvestAndRefreshPool(): Promise<{
    tested: number;
    addedOrUpdated: number;
    errors: string[];
  }> {
    const candidates = await this.fetchMonosansCandidates();
    let tested = 0;
    let addedOrUpdated = 0;
    const errors: string[] = [];

    // Parallel testing in chunks of 10
    const chunkSize = 10;
    for (let i = 0; i < candidates.length && addedOrUpdated < this.TARGET_HARVEST_COUNT; i += chunkSize) {
      const chunk = candidates.slice(i, i + chunkSize);
      tested += chunk.length;

      const results = await Promise.allSettled(
        chunk.map(async (cand) => {
          const latency = await this.probeCandidateLatency(cand.host, cand.port);
          if (latency !== null && latency < 500) {
            return { ...cand, latency };
          }
          return null;
        })
      );

      for (const res of results) {
        if (res.status === 'fulfilled' && res.value !== null) {
          const valid = res.value;
          try {
            const label = `Free SOCKS5 (${valid.host}:${valid.port})`;

            const existing = await db.providerProxy.findFirst({
              where: { host: valid.host, port: valid.port },
            });

            if (existing) {
              await db.providerProxy.update({
                where: { id: existing.id },
                data: {
                  isActive: true,
                  lastTestAt: new Date(),
                  lastTestLatencyMs: valid.latency,
                  lastTestSuccess: true,
                  consecutiveFailures: 0,
                },
              });
            } else {
              await db.providerProxy.create({
                data: {
                  label,
                  description: `Auto-harvested from ${valid.source} (Ping: ${valid.latency}ms)`,
                  protocol: valid.protocol,
                  host: valid.host,
                  port: valid.port,
                  category: 'FREE_PUBLIC',
                  tags: JSON.stringify(['free', 'harvested', 'socks5']),
                  isActive: true,
                  lastTestAt: new Date(),
                  lastTestLatencyMs: valid.latency,
                  lastTestSuccess: true,
                },
              });
            }
            addedOrUpdated++;
          } catch (dbErr) {
            errors.push(dbErr instanceof Error ? dbErr.message : String(dbErr));
          }
        }
      }
    }

    return { tested, addedOrUpdated, errors };
  }
}
