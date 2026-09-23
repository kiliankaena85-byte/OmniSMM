import { db } from '@/lib/db';
import { tenantVisibilityFilter } from '@/lib/tenant-scope';

// ── DTOs ──────────────────────────────────────────────────────────────────────

/** Safe public DTO — never includes encrypted apiKey */
export type ProviderListDTO = {
  id: string;
  name: string;
  apiUrl: string;
  isActive: boolean;
  balanceCurrency: string;
  serviceCount: number;
  avgResponseMs: number;
  errorCount5m: number;
  lastSuccessAt: string | null;
  ticketUrl?: string | null;
  createdAt: string;
};

export type ApiMappingDTO = {
  httpMethod?: 'GET' | 'POST';
  contentType?: 'form' | 'json';
  auth: {
    type: 'body' | 'query' | 'header';
    field: string;
    prefix?: string;
  };
  order: {
    serviceField: string;
    linkField: string;
    quantityField: string;
  };
  response: {
    orderIdField: string;
    errorField: string;
  };
  catalog?: {
    itemsPath?: string;
    serviceIdField?: string;
    nameField?: string;
    priceField?: string;
    minField?: string;
    maxField?: string;
    typeField?: string;
    descField?: string;
  };
  balance?: {
    balancePath?: string;
    currencyPath?: string;
  };
};

/** Detail DTO for edit form — includes metadata but NEVER the raw apiKey */
export type ProviderDetailDTO = {
  id: string;
  name: string;
  apiUrl: string;
  isActive: boolean;
  balanceCurrency: string;
  mapping: ApiMappingDTO | null; // null means Standard v2 integration
  hasApiKey: boolean;    // true = key is set; the key itself is never exposed
  ticketUrl: string | null;
};

// ── Service ───────────────────────────────────────────────────────────────────

class AdminProviderService {
  /**
   * List all providers — safe DTO, no apiKey.
   */
  async listProviders(): Promise<ProviderListDTO[]> {
    const rows = await db.provider.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        apiUrl: true,
        isActive: true,
        balanceCurrency: true,
        avgResponseMs: true,
        errorCount5m: true,
        lastSuccessAt: true,
        ticketUrl: true,
        createdAt: true,
        _count: { select: { services: true } },
      },
    });

    return rows.map(p => ({
      id: p.id,
      name: p.name,
      apiUrl: p.apiUrl,
      isActive: p.isActive,
      balanceCurrency: p.balanceCurrency,
      serviceCount: p._count.services,
      avgResponseMs: p.avgResponseMs,
      errorCount5m: p.errorCount5m,
      lastSuccessAt: p.lastSuccessAt ? p.lastSuccessAt.toISOString() : null,
      ticketUrl: p.ticketUrl,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  /**
   * Get provider detail for the edit form.
   * NEVER exposes the raw encrypted apiKey to the client.
   */
  async getProviderDetail(providerId: string): Promise<ProviderDetailDTO | null> {
    const p = await db.provider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        name: true,
        apiUrl: true,
        isActive: true,
        balanceCurrency: true,
        apiKey: true,        // needed only to check if set
        metadata: true,
        ticketUrl: true,
      },
    });

    if (!p) return null;

    // metadata is JsonValue — cast safely
    const meta = (p.metadata as Record<string, unknown> | null) ?? {};

    return {
      id: p.id,
      name: p.name,
      apiUrl: p.apiUrl,
      isActive: p.isActive,
      balanceCurrency: p.balanceCurrency,
      mapping: (meta.mapping as ApiMappingDTO) || null,
      hasApiKey: Boolean(p.apiKey && p.apiKey.length > 0),
      ticketUrl: p.ticketUrl,
    };
  }

  /**
   * Get category list for import wizard.
   * AUD-05 (3.1): tenant-scoped — the wizard only offers categories visible
   * to the current tenant (own + shared 'all'), so imports never silently
   * retarget taxonomy of another tenant.
   */
  async listCategories(tenantId?: string) {
    const rows = await db.category.findMany({
      where: tenantId ? { tenantId: tenantVisibilityFilter(tenantId) } : undefined,
      orderBy: [{ network: { slug: 'asc' } }, { sort: 'asc' }],
      include: { network: true },
    });
    return rows;
  }

  /**
   * Tests provider connection safely with SSRF protection and 10s timeout.
   */
  async testConnection(apiUrl: string): Promise<{ success: boolean; error?: string }> {
    const cleanUrl = apiUrl ? apiUrl.trim().replace(/\/+$/, '') : apiUrl;
    const { assertSafeUrl } = await import('@/utils/ssrf-guard');
    await assertSafeUrl(cleanUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(cleanUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return { success: res.ok || res.status < 500 };
    } catch (err) {
      clearTimeout(timeoutId);
      return { success: false, error: err instanceof Error ? err.message : 'Connection failed' };
    }
  }
}

export const adminProviderService = new AdminProviderService();
