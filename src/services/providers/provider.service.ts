import { Provider } from '@prisma/client';
import { BaseProvider, ProviderServiceDto } from './base-provider';
import { getBaseUrlAsync } from '@/utils/get-base-url';
import { db } from '@/lib/db';
import { SettingsManager } from '@/lib/settings';
import { UniversalProvider } from './universal.provider';
import { VaultService } from '@/lib/vault';
import { redis } from '@/lib/redis';
import type { ProxyConfig } from '@/types/provider-proxy';

export class ProviderService {
  /**
   * Retrieves all active providers from DB
   */
  async getActiveProviders(): Promise<Provider[]> {
    return db.provider.findMany({ where: { isActive: true } });
  }

  /**
   * Resolves proxy config from DB for a given provider
   */
  private async resolveProxyConfig(provider: Provider): Promise<ProxyConfig | null> {
    if (!provider.proxyId) {
      const { ProxyPoolService } = await import('./proxy-pool.service');
      return ProxyPoolService.getHealthyProxy(provider.id);
    }
    try {
      const proxy = await db.providerProxy.findUnique({
        where: { id: provider.proxyId, isActive: true },
      });
      if (!proxy) {
        const { ProxyPoolService } = await import('./proxy-pool.service');
        return ProxyPoolService.getHealthyProxy(provider.id);
      }

      // Decrypt password in memory
      let password: string | undefined;
      if (proxy.passwordEncrypted) {
        try {
          password = VaultService.decrypt(proxy.passwordEncrypted);
        } catch {
          console.warn(`[Proxy] Failed to decrypt password for proxy ${proxy.id}, falling back to pool`);
          const { ProxyPoolService } = await import('./proxy-pool.service');
          return ProxyPoolService.getHealthyProxy(provider.id);
        }
      }

      return {
        protocol: proxy.protocol as 'http' | 'https' | 'socks5',
        host: proxy.host,
        port: proxy.port,
        username: proxy.username || undefined,
        password,
      };
    } catch (err) {
      console.warn(`[Proxy] Error resolving proxy for provider ${provider.id}:`, err);
      const { ProxyPoolService } = await import('./proxy-pool.service');
      return ProxyPoolService.getHealthyProxy(provider.id);
    }
  }

  /**
   * Main Factory Method — resolves and passes proxy config to UniversalProvider
   */
  async getProviderInstance(config: Provider): Promise<BaseProvider> {
    let apiUrl = config.apiUrl;
    let decryptedKey: string;
    try {
      decryptedKey = VaultService.decrypt(config.apiKey);
    } catch {
      decryptedKey = config.apiKey;
    }

    // Auto-route internal mock provider URLs or mock provider records to local mock-provider route
    if (apiUrl.includes('mock.smmplan.internal') || apiUrl.includes('mock-provider') || config.name.toLowerCase().includes('mock provider')) {
      const port = process.env.PORT || '3000';
      const internalBase = process.env.INTERNAL_WEB_URL || (process.env.NODE_ENV === 'production' ? 'http://web:3000' : `http://127.0.0.1:${port}`);
      const internalUrl = `${internalBase}/api/dev/mock-provider`;
      decryptedKey = process.env.MOCK_PROVIDER_KEY || decryptedKey || 'mock_master_key_2026';
      return new UniversalProvider(
        internalUrl,
        decryptedKey,
        (config.metadata as Record<string, unknown> | undefined),
        null,
      );
    }

    const proxyConfig = await this.resolveProxyConfig(config);

    return new UniversalProvider(
      apiUrl,
      decryptedKey || config.apiKey,
      (config.metadata as Record<string, unknown> | undefined),
      proxyConfig,
    );
  }

  /**
   * Retrieves services from the provider, utilizing a Redis cache (24-hour expiration)
   * unless forceRefresh is true.
   */
  async getServicesWithCache(
    config: Provider,
    providerInstance: BaseProvider,
    forceRefresh = false
  ): Promise<ProviderServiceDto[]> {
    const cacheKey = `provider:${config.id}:catalog`;

    if (!forceRefresh) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as ProviderServiceDto[];
        }
      } catch (err) {
        console.warn(`[Redis Cache] Failed to read ${cacheKey}:`, err);
      }
    }

    const rawServices = await providerInstance.getServices();

    try {
      await redis.set(cacheKey, JSON.stringify(rawServices), 'EX', 24 * 60 * 60);
    } catch (err) {
      console.warn(`[Redis Cache] Failed to write ${cacheKey}:`, err);
    }

    return rawServices;
  }

  /**
   * Factory for background workers (order/sync processors).
   * In test mode, redirects ALL provider traffic to the internal mock-provider API.
   * This protects real provider balance from being charged during QA testing.
   */
  async getWorkerProviderInstance(config: Provider, tenantId?: string): Promise<BaseProvider> {
    const isMockProvider = await SettingsManager.isMockProviderEnabled(tenantId);
    if (isMockProvider) {
      const mockKey = process.env.MOCK_PROVIDER_KEY || 'mock_master_key_2026';
      const port = process.env.PORT || '3000';
      const internalBase = process.env.INTERNAL_WEB_URL || (process.env.NODE_ENV === 'production' ? 'http://web:3000' : `http://127.0.0.1:${port}`);
      return new UniversalProvider(
        `${internalBase}/api/dev/mock-provider`,
        mockKey,
        (config.metadata as Record<string, unknown> | undefined),
      );
    }

    let decryptedKey: string;
    try {
      decryptedKey = VaultService.decrypt(config.apiKey);
    } catch {
      decryptedKey = config.apiKey;
    }

    const proxyConfig = await this.resolveProxyConfig(config);

    return new UniversalProvider(
      config.apiUrl,
      decryptedKey || config.apiKey,
      (config.metadata as Record<string, unknown> | undefined),
      proxyConfig,
    );
  }

  /**
   * Auto-resolves the default provider
   */
  async getDefaultProvider(): Promise<BaseProvider> {
    const provider = await db.provider.findFirst({
      where: { isActive: true },
    });

    if (!provider) {
      throw new Error('No active providers found in the database. Please add one (e.g., Vexboost).');
    }

    return await this.getProviderInstance(provider);
  }
}

// Singleton export
export const providerService = new ProviderService();
