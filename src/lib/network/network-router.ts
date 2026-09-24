// ==============================================================
// Universal Network Router (Clash Verge Pattern)
// Centralized outbound dispatcher with prioritized routing rules
// ==============================================================

import { URL } from 'node:url';
import type { 
  RoutingRule, 
  RoutingTargetType, 
  SubsystemServiceType, 
  NetworkRoutingConfig, 
  ProxyConfig 
} from '@/types/provider-proxy';
import { assertSafeOutboundUrl } from '@/lib/security/ssrf-guard';
import { createProxyDispatcher, buildProxyConfig } from '@/lib/http/proxy-fetch';
import { logger } from '@/lib/logger';

/**
 * Hardcoded security invariants: Russian banks, fiscalization and local services
 * MUST NEVER route via foreign proxies to prevent account bans or 54-FZ failures.
 */
export const IMMUTABLE_DIRECT_PATTERNS = [
  'api.yookassa.ru',
  'yookassa.ru',
  'auth.robokassa.ru',
  'robokassa.ru',
  'cbr.ru',
  'smtp.yandex.ru',
  'smtp.mail.ru',
  'vexboost.ru',
  'panel.smmtoolbox.ru',
  'smmtoolbox.ru',
  'primelike.happydesk.ru',
  'happydesk.ru',
  'localhost',
  '127.0.0.1'
];

export const DEFAULT_ROUTING_CONFIG: NetworkRoutingConfig = {
  serviceToggles: {
    aiGemini: 'PROXY_POOL',
    providers: 'PROXY_POOL',
    catalogSync: 'DIRECT',
    paymentsRu: 'DIRECT',
    paymentsCrypto: 'DIRECT',
    telegram: 'DIRECT'
  },
  systemProxyUrl: process.env.SYSTEM_PROXY_URL || process.env.HTTP_PROXY || process.env.ALL_PROXY || null,
  rules: [
    // 1. Immutable domestic services & payments
    {
      id: 'rule-yookassa',
      type: 'DOMAIN-SUFFIX',
      payload: 'yookassa.ru',
      target: 'DIRECT',
      comment: 'ЮKassa (строго прямой доступ РФ)',
      isEnabled: true,
      priority: 10
    },
    {
      id: 'rule-vexboost',
      type: 'DOMAIN-SUFFIX',
      payload: 'vexboost.ru',
      target: 'DIRECT',
      comment: 'Основной поставщик Vexboost (строго прямой доступ РФ)',
      isEnabled: true,
      priority: 15
    },
    {
      id: 'rule-robokassa',
      type: 'DOMAIN-SUFFIX',
      payload: 'robokassa.ru',
      target: 'DIRECT',
      comment: 'Робокасса (строго прямой доступ РФ)',
      isEnabled: true,
      priority: 20
    },
    {
      id: 'rule-cbr',
      type: 'DOMAIN-SUFFIX',
      payload: 'cbr.ru',
      target: 'DIRECT',
      comment: 'Курс валют ЦБ РФ',
      isEnabled: true,
      priority: 30
    },
    {
      id: 'rule-smtp-yandex',
      type: 'DOMAIN-SUFFIX',
      payload: 'smtp.yandex.ru',
      target: 'DIRECT',
      comment: 'Почтовый шлюз Яндекс 465',
      isEnabled: true,
      priority: 40
    },
    {
      id: 'rule-smmtoolbox',
      type: 'DOMAIN-SUFFIX',
      payload: 'smmtoolbox.ru',
      target: 'DIRECT',
      comment: 'SMMToolbox панель (строго прямой доступ РФ)',
      isEnabled: true,
      priority: 42
    },
    {
      id: 'rule-happydesk',
      type: 'DOMAIN-SUFFIX',
      payload: 'happydesk.ru',
      target: 'DIRECT',
      comment: 'HappyDesk тикеты и виджеты (строго прямой доступ РФ)',
      isEnabled: true,
      priority: 45
    },
    {
      id: 'rule-domestic-ru',
      type: 'DOMAIN-SUFFIX',
      payload: 'ru',
      target: 'DIRECT',
      comment: 'Все российские сервисы зоны .ru напрямую',
      isEnabled: true,
      priority: 50
    },
    {
      id: 'rule-domestic-rf',
      type: 'DOMAIN-SUFFIX',
      payload: 'xn--p1ai',
      target: 'DIRECT',
      comment: 'Все сервисы зоны .рф напрямую',
      isEnabled: true,
      priority: 51
    },
    // 2. AI Services (Google Gemini) - requires proxy in restricted regions
    {
      id: 'rule-gemini-googleapis',
      type: 'DOMAIN-SUFFIX',
      payload: 'googleapis.com',
      target: 'PROXY_POOL',
      comment: 'Google API / Gemini Generative Language',
      isEnabled: true,
      priority: 100
    },
    {
      id: 'rule-gemini-service',
      type: 'SERVICE',
      payload: 'AI_GEMINI',
      target: 'PROXY_POOL',
      comment: 'Любые запросы сервиса AI Gemini',
      isEnabled: true,
      priority: 110
    },
    // 3. Telegram API
    {
      id: 'rule-telegram-api',
      type: 'DOMAIN-SUFFIX',
      payload: 'api.telegram.org',
      target: 'DIRECT',
      comment: 'Telegram Bot API',
      isEnabled: true,
      priority: 200
    },
    // 4. Crypto payment gateways
    {
      id: 'rule-cryptobot',
      type: 'DOMAIN-SUFFIX',
      payload: 'pay.crypt.bot',
      target: 'DIRECT',
      comment: 'CryptoBot Payment Gateway',
      isEnabled: true,
      priority: 300
    },
    // 5. Providers fallback
    {
      id: 'rule-providers-service',
      type: 'SERVICE',
      payload: 'PROVIDERS',
      target: 'PROXY_POOL',
      comment: 'SMM панели и провайдеры по умолчанию',
      isEnabled: true,
      priority: 400
    },
    // 6. Final Catch-All
    {
      id: 'rule-final',
      type: 'FINAL',
      payload: '',
      target: 'DIRECT',
      comment: 'Все остальные запросы напрямую',
      isEnabled: true,
      priority: 9999
    }
  ]
};

export interface RouteResolution {
  target: RoutingTargetType;
  matchedRule?: RoutingRule;
  proxyConfig?: ProxyConfig | null;
  reason: string;
  isImmutableDirect: boolean;
}

export class UniversalNetworkRouter {
  private static cachedConfig: NetworkRoutingConfig | null = null;
  private static lastConfigFetch = 0;
  private static readonly CONFIG_CACHE_TTL_MS = 30_000;

  /**
   * Loads the current routing configuration from SystemSettings or returns default
   */
  static async getConfig(tenantId = 'smmplan'): Promise<NetworkRoutingConfig> {
    const now = Date.now();
    if (this.cachedConfig && now - this.lastConfigFetch < this.CONFIG_CACHE_TTL_MS) {
      return this.cachedConfig;
    }

    try {
      const { db } = await import('@/lib/db');
      const settings = await db.systemSettings.findFirst({
        where: { id: tenantId },
        select: { id: true, geminiProxy: true }
      });

      let parsedRules: NetworkRoutingConfig = { ...DEFAULT_ROUTING_CONFIG };
      
      // If geminiProxy is configured in settings, adapt the system proxy URL
      if (settings?.geminiProxy && settings.geminiProxy.trim()) {
        parsedRules.systemProxyUrl = settings.geminiProxy.trim();
      }

      this.cachedConfig = parsedRules;
      this.lastConfigFetch = now;
      return parsedRules;
    } catch (err) {
      console.warn('[NetworkRouter] Error fetching config from DB, using defaults:', err);
      return DEFAULT_ROUTING_CONFIG;
    }
  }

  /**
   * Invalidates internal configuration cache (called after admin saves rules)
   */
  static invalidateCache(): void {
    this.cachedConfig = null;
    this.lastConfigFetch = 0;
  }

  /**
   * Resolves routing target and proxy configuration for a given URL and context
   */
  static async resolveRoute(
    targetUrl: string,
    context?: {
      service?: SubsystemServiceType;
      providerId?: string;
      customProxy?: ProxyConfig | null;
    }
  ): Promise<RouteResolution> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return {
        target: 'DIRECT',
        reason: 'Invalid URL, falling back to DIRECT',
        isImmutableDirect: false
      };
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // 1. HARD SECURITY INVARIANT: Russian fintech, CBR and mail servers are ALWAYS DIRECT
    for (const pattern of IMMUTABLE_DIRECT_PATTERNS) {
      if (hostname === pattern || hostname.endsWith('.' + pattern)) {
        return {
          target: 'DIRECT',
          reason: `Strict security invariant: ${pattern} is locked to DIRECT`,
          isImmutableDirect: true
        };
      }
    }

    // If explicit custom proxy passed by caller (e.g. from Provider entity)
    if (context?.customProxy) {
      return {
        target: 'SPECIFIC_PROXY',
        proxyConfig: context.customProxy,
        reason: 'Explicit custom proxy provided by caller',
        isImmutableDirect: false
      };
    }

    const config = await this.getConfig();

    // 1. HARD SECURITY INVARIANT: Russian fintech, CBR and mail servers
    for (const pattern of IMMUTABLE_DIRECT_PATTERNS) {
      if (hostname === pattern || hostname.endsWith('.' + pattern)) {
        // If admin activated Sovereign RU Reserve for foreign servers
        if (
          config.serviceToggles.paymentsRu === 'RU_SOVEREIGN_POOL' &&
          (pattern.includes('yookassa') || pattern.includes('robokassa'))
        ) {
          const ruProxy = await this.resolveProxyForTarget('RU_SOVEREIGN_POOL', config);
          if (ruProxy) {
            return {
              target: 'RU_SOVEREIGN_POOL',
              proxyConfig: ruProxy,
              reason: `Sovereign Disaster Recovery: Routing ${pattern} via certified Russian exit node`,
              isImmutableDirect: false
            };
          }
        }

        return {
          target: 'DIRECT',
          reason: `Strict security invariant: ${pattern} is locked to DIRECT`,
          isImmutableDirect: true
        };
      }
    }

    // 2. Service-level override from Quick Toggles
    if (context?.service) {
      const toggleTarget = this.resolveServiceToggle(context.service, config);
      if (toggleTarget && toggleTarget !== 'DIRECT') {
        const proxyConfig = await this.resolveProxyForTarget(toggleTarget, config, context.providerId);
        return {
          target: toggleTarget,
          proxyConfig,
          reason: `Service quick toggle: ${context.service} -> ${toggleTarget}`,
          isImmutableDirect: false
        };
      }
    }

    // 3. Evaluate rules in order of priority (First Match Win, like Clash)
    const sortedRules = [...config.rules]
      .filter(r => r.isEnabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      let matched = false;

      switch (rule.type) {
        case 'DOMAIN':
          matched = hostname === rule.payload.toLowerCase();
          break;
        case 'DOMAIN-SUFFIX': {
          const suffix = rule.payload.toLowerCase();
          matched = hostname === suffix || hostname.endsWith('.' + suffix);
          break;
        }
        case 'DOMAIN-KEYWORD':
          matched = hostname.includes(rule.payload.toLowerCase());
          break;
        case 'SERVICE':
          matched = Boolean(context?.service && context.service === rule.payload);
          break;
        case 'FINAL':
          matched = true;
          break;
      }

      if (matched) {
        const proxyConfig = await this.resolveProxyForTarget(rule.target, config, context?.providerId, rule.targetProxyId);
        return {
          target: rule.target,
          matchedRule: rule,
          proxyConfig,
          reason: `Matched rule [${rule.type}] ${rule.payload} -> ${rule.target}`,
          isImmutableDirect: false
        };
      }
    }

    return {
      target: 'DIRECT',
      reason: 'No rules matched, fallback to DIRECT',
      isImmutableDirect: false
    };
  }

  private static resolveServiceToggle(service: SubsystemServiceType, config: NetworkRoutingConfig): RoutingTargetType | null {
    switch (service) {
      case 'AI_GEMINI':
        return config.serviceToggles.aiGemini;
      case 'PROVIDERS':
        return config.serviceToggles.providers;
      case 'CATALOG_SYNC':
        return config.serviceToggles.catalogSync;
      case 'PAYMENTS_RU':
        return config.serviceToggles.paymentsRu;
      case 'PAYMENTS_CRYPTO':
        return config.serviceToggles.paymentsCrypto;
      case 'TELEGRAM':
        return config.serviceToggles.telegram;
      default:
        return null;
    }
  }

  private static async resolveProxyForTarget(
    target: RoutingTargetType,
    config: NetworkRoutingConfig,
    providerId?: string,
    specificProxyId?: string | null
  ): Promise<ProxyConfig | null> {
    if (target === 'DIRECT' || target === 'REJECT') return null;

    if (target === 'RU_SOVEREIGN_POOL') {
      try {
        const { ProxyPoolService } = await import('@/services/providers/proxy-pool.service');
        const ruProxy = await ProxyPoolService.getHealthyRuProxy();
        if (ruProxy) return ruProxy;
      } catch (err) {
        console.warn('[NetworkRouter] Error resolving RU_SOVEREIGN_POOL:', err);
      }
      // Fallback to general pool if no specific RU proxy available
      return this.resolveProxyForTarget('PROXY_POOL', config, providerId, specificProxyId);
    }

    if (target === 'SYSTEM_PROXY' && config.systemProxyUrl) {
      try {
        const u = new URL(config.systemProxyUrl);
        return {
          protocol: (u.protocol.replace(':', '') || 'http') as 'http' | 'https' | 'socks5',
          host: u.hostname,
          port: parseInt(u.port || '80', 10),
          username: u.username ? decodeURIComponent(u.username) : undefined,
          password: u.password ? decodeURIComponent(u.password) : undefined
        };
      } catch {
        return null;
      }
    }

    if (target === 'SPECIFIC_PROXY' && specificProxyId) {
      try {
        const { db } = await import('@/lib/db');
        const proxy = await db.providerProxy.findUnique({ where: { id: specificProxyId } });
        if (proxy && proxy.isActive) {
          let password = '';
          if (proxy.passwordEncrypted) {
            const { VaultService } = await import('@/lib/vault');
            password = VaultService.decrypt(proxy.passwordEncrypted);
          }
          return {
            id: proxy.id,
            protocol: proxy.protocol as 'http' | 'https' | 'socks5',
            host: proxy.host,
            port: proxy.port,
            username: proxy.username || undefined,
            password: password || undefined,
            lastTestLatencyMs: proxy.lastTestLatencyMs,
            category: proxy.category as any
          };
        }
      } catch (err) {
        console.warn(`[NetworkRouter] Error loading specific proxy ${specificProxyId}:`, err);
      }
    }

    if (target === 'PROXY_POOL') {
      try {
        const { ProxyPoolService } = await import('@/services/providers/proxy-pool.service');
        const healthyProxy = await ProxyPoolService.getHealthyProxy(providerId);
        if (healthyProxy) return healthyProxy;
      } catch (err) {
        console.warn('[NetworkRouter] ProxyPoolService error, checking systemProxyUrl:', err);
      }

      // Fallback to systemProxyUrl if pool has no active proxies
      if (config.systemProxyUrl) {
        return this.resolveProxyForTarget('SYSTEM_PROXY', config);
      }
    }

    return null;
  }

  /**
   * Universal fetch drop-in replacement with Clash-style routing dispatch & Multi-Proxy Failover
   */
  static async fetch(
    url: string,
    init?: RequestInit,
    context?: {
      service?: SubsystemServiceType;
      providerId?: string;
      customProxy?: ProxyConfig | null;
    }
  ): Promise<Response> {
    // OWASP A10: Always assert outbound URL safety
    const ssrfCheck = await assertSafeOutboundUrl(url);
    if (!ssrfCheck.ok) {
      throw new Error(`SSRF blocked: ${ssrfCheck.reason} for URL ${url}`);
    }

    const route = await this.resolveRoute(url, context);

    if (route.target === 'REJECT') {
      throw new Error(`[NetworkRouter] Connection blocked by policy (REJECT): ${url}`);
    }

    if (route.target === 'DIRECT' || !route.proxyConfig) {
      return fetch(url, {
        ...init,
        signal: init?.signal || AbortSignal.timeout(10000),
      });
    }

    // Try primary proxy, automatically failover to secondary if connection drops
    try {
      const dispatcher = await createProxyDispatcher(route.proxyConfig);
      const { fetch: undiciFetch } = await import('undici');

      return await undiciFetch(url, {
        method: init?.method,
        headers: init?.headers as unknown as Record<string, string>,
        body: init?.body as unknown as string | Buffer,
        signal: init?.signal as unknown as AbortSignal,
        dispatcher: dispatcher as unknown as NonNullable<Parameters<typeof undiciFetch>[1]>['dispatcher']
      }) as unknown as Response;
    } catch (primaryErr: any) {
      console.warn(`[NetworkRouter] Primary proxy failed (${route.proxyConfig.host}:${route.proxyConfig.port}):`, primaryErr?.message);

      // Report failure to ProxyPoolService
      if (route.proxyConfig.id) {
        const { ProxyPoolService } = await import('@/services/providers/proxy-pool.service');
        void ProxyPoolService.reportFailure(route.proxyConfig.id, primaryErr?.message || 'Connection error');
      }

      // Record security event if critical service was affected
      if (context?.service === 'AI_GEMINI' || context?.service === 'PAYMENTS_RU') {
        const { SecurityAlertService } = await import('@/services/security/security-alert.service');
        void SecurityAlertService.record({
          event: 'PROXY_NODE_FAILURE',
          severity: 'WARNING',
          details: {
            service: context.service,
            url,
            proxyHost: route.proxyConfig.host,
            error: primaryErr?.message
          }
        });
      }

      // Multi-Proxy Failover: Try backup proxy
      try {
        const { ProxyPoolService } = await import('@/services/providers/proxy-pool.service');
        const backupProxy = route.target === 'RU_SOVEREIGN_POOL'
          ? await ProxyPoolService.getHealthyRuProxy()
          : await ProxyPoolService.getHealthyProxy(context?.providerId);

        if (backupProxy && backupProxy.id !== route.proxyConfig.id) {
          logger.info(`[NetworkRouter] Multi-Proxy Failover to: ${backupProxy.host}:${backupProxy.port}`);
          const backupDisp = await createProxyDispatcher(backupProxy);
          const { fetch: undiciFetch } = await import('undici');

          return await undiciFetch(url, {
            method: init?.method,
            headers: init?.headers as unknown as Record<string, string>,
            body: init?.body as unknown as string | Buffer,
            signal: init?.signal as unknown as AbortSignal,
            dispatcher: backupDisp as unknown as NonNullable<Parameters<typeof undiciFetch>[1]>['dispatcher']
          }) as unknown as Response;
        }
      } catch (failoverErr) {
        logger.warn('[NetworkRouter] Failover attempt also failed:', { error: String(failoverErr) });
      }

      // If non-restricted service, last resort fallback to direct
      if (context?.service !== 'AI_GEMINI') {
        logger.warn('[NetworkRouter] Proxies exhausted, falling back to direct connection');
        return fetch(url, {
          ...init,
          signal: init?.signal || AbortSignal.timeout(10000),
        });
      }

      throw primaryErr;
    }
  }

  /**
   * Inspects a route without making a network request (for admin UI Route Inspector)
   */
  static async inspectRoute(
    url: string,
    service?: SubsystemServiceType
  ): Promise<RouteResolution & { checkedUrl: string; hostname: string }> {
    const parsed = new URL(url);
    const resolution = await this.resolveRoute(url, { service });
    return {
      ...resolution,
      checkedUrl: url,
      hostname: parsed.hostname
    };
  }
}