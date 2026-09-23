/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Automated Custom Domain Verification & DNS Probe Engine (Phase 5).
 * Validates domain ownership via CNAME and TXT challenge tokens.
 * Zero PostgreSQL schema migrations — utilizes SystemSetting key-value storage.
 */

import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { db } from '@/lib/db';
import { DomainRegistryService } from './domain-registry.service';
import { sanitizeTenantSlug } from '@/lib/tenant-resolver-edge';

export type DomainVerificationStatus = 'UNCONFIGURED' | 'PENDING' | 'VERIFIED' | 'FAILED';

export interface TenantDomainMeta {
  customDomain: string;
  verificationToken: string;
  status: DomainVerificationStatus;
  cnameTarget: string;
  txtHost: string;
  txtValue: string;
  lastCheckedAt?: string;
  lastError?: string | null;
  verifiedAt?: string;
}

const FORBIDDEN_CUSTOM_DOMAINS = new Set([
  'smmplan.pro',
  'www.smmplan.pro',
  'smmplan.ru',
  'www.smmplan.ru',
  'smmflux.ru',
  'www.smmflux.ru',
  'localhost',
  '127.0.0.1',
]);

export class DomainVerificationService {
  /**
   * Resolves the canonical platform CNAME target.
   */
  public static getPlatformCnameTarget(): string {
    return process.env.PLATFORM_CNAME_TARGET || 'smmplan.pro';
  }

  /**
   * Generates initial verification metadata and unique challenge token for a custom domain.
   */
  public static generateDomainMeta(tenantSlug: string, customDomain: string): TenantDomainMeta {
    const cleanDomain = customDomain.trim().toLowerCase();

    // Prevent domain hijacking of core platform domains
    if (FORBIDDEN_CUSTOM_DOMAINS.has(cleanDomain) || cleanDomain.endsWith('.smmplan.pro') || cleanDomain.endsWith('.smmflux.ru')) {
      throw new Error(`Нельзя использовать системный домен платформы "${cleanDomain}" в качестве кастомного алиаса.`);
    }

    const token = `omni_verify_${crypto.randomBytes(16).toString('hex')}`;
    const cnameTarget = this.getPlatformCnameTarget();

    return {
      customDomain: cleanDomain,
      verificationToken: token,
      status: 'PENDING',
      cnameTarget,
      txtHost: `_omnismm-challenge.${cleanDomain}`,
      txtValue: `omnismm-verify=${token}`,
    };
  }

  /**
   * Performs real-time DNS resolution checks against CNAME and TXT challenge records.
   */
  public static async checkDns(
    customDomain: string,
    expectedToken: string,
    expectedCname?: string
  ): Promise<{ verified: boolean; method?: 'CNAME' | 'TXT'; error?: string }> {
    const cleanDomain = customDomain.trim().toLowerCase();
    const targetCname = (expectedCname || this.getPlatformCnameTarget()).toLowerCase().trim();
    const txtChallengeHost = `_omnismm-challenge.${cleanDomain}`;

    let cnameResolved: string[] = [];
    let txtResolved: string[][] = [];
    let cnameError: string | null = null;
    let txtError: string | null = null;

    // 1. Probe CNAME Record
    try {
      cnameResolved = await dns.resolveCname(cleanDomain);
      for (const cn of cnameResolved) {
        const cleanCn = cn.toLowerCase().replace(/\.$/, '');
        if (cleanCn === targetCname || cleanCn.endsWith('smmplan.pro') || cleanCn.endsWith('smmflux.ru')) {
          return { verified: true, method: 'CNAME' };
        }
      }
    } catch (err: unknown) {
      cnameError = err instanceof Error ? err.message : String(err);
    }

    // 2. Probe TXT Ownership Challenge Record
    try {
      txtResolved = await dns.resolveTxt(txtChallengeHost);
      const flattenedTxt = txtResolved.map((chunks) => chunks.join(''));
      const expectedTxtNeedle = `omnismm-verify=${expectedToken}`;

      for (const txt of flattenedTxt) {
        if (txt.includes(expectedTxtNeedle) || txt.includes(expectedToken)) {
          return { verified: true, method: 'TXT' };
        }
      }
    } catch (err: unknown) {
      txtError = err instanceof Error ? err.message : String(err);
    }

    // Diagnostics if not verified
    if (cnameResolved.length > 0) {
      return {
        verified: false,
        error: `CNAME запись указывает на [${cnameResolved.join(', ')}], ожидалось [${targetCname}].`,
      };
    }

    if (cnameError && txtError) {
      return {
        verified: false,
        error: `DNS-записи для домена ${cleanDomain} не найдены или еще не распространились. Проверьте правильность добавления CNAME или TXT записи у вашего регистратора.`,
      };
    }

    return {
      verified: false,
      error: `Проверка не пройдена: токен верификации в TXT записи не совпадает, а CNAME не указывает на платформу.`,
    };
  }

  /**
   * Retrieves stored verification metadata from SystemSetting key-value table.
   */
  public static async getDomainMeta(tenantSlug: string): Promise<TenantDomainMeta | null> {
    const cleanSlug = sanitizeTenantSlug(tenantSlug);
    const key = `tenant_domain_meta_${cleanSlug}`;

    try {
      const setting = await db.systemSetting.findUnique({
        where: { key },
      });

      if (!setting?.value) return null;
      return JSON.parse(setting.value) as TenantDomainMeta;
    } catch (err) {
      console.warn(`[DomainVerificationService] Failed to load domain meta for ${cleanSlug}:`, err);
      return null;
    }
  }

  /**
   * Saves or updates domain verification metadata in SystemSetting.
   */
  public static async saveDomainMeta(tenantSlug: string, meta: TenantDomainMeta): Promise<void> {
    const cleanSlug = sanitizeTenantSlug(tenantSlug);
    const key = `tenant_domain_meta_${cleanSlug}`;

    await db.systemSetting.upsert({
      where: { key },
      update: {
        value: JSON.stringify(meta),
        group: 'DOMAIN',
      },
      create: {
        key,
        value: JSON.stringify(meta),
        group: 'DOMAIN',
        description: `Метаданные верификации кастомного домена для бренда ${cleanSlug}`,
      },
    });
  }

  /**
   * Verifies domain ownership and registers it in DomainRegistryService upon success.
   */
  public static async verifyDomain(tenantSlug: string): Promise<{
    success: boolean;
    status: DomainVerificationStatus;
    error?: string;
    meta: TenantDomainMeta | null;
  }> {
    const cleanSlug = sanitizeTenantSlug(tenantSlug);
    let meta = await this.getDomainMeta(cleanSlug);

    // Fallback: check if tenant has customDomain in Tenant table
    if (!meta) {
      const tenant = await db.tenant.findUnique({
        where: { slug: cleanSlug },
        select: { customDomain: true, domain: true },
      });

      if (tenant?.customDomain) {
        meta = this.generateDomainMeta(cleanSlug, tenant.customDomain);
        await this.saveDomainMeta(cleanSlug, meta);
      } else {
        return {
          success: false,
          status: 'UNCONFIGURED',
          error: 'Кастомный домен не настроен для данного бренда',
          meta: null,
        };
      }
    }

    const checkResult = await this.checkDns(
      meta.customDomain,
      meta.verificationToken,
      meta.cnameTarget
    );

    const now = new Date().toISOString();

    if (checkResult.verified) {
      meta.status = 'VERIFIED';
      meta.verifiedAt = now;
      meta.lastCheckedAt = now;
      meta.lastError = null;

      await this.saveDomainMeta(cleanSlug, meta);

      // Register verified domain in DomainRegistryService for active traffic
      const tenant = await db.tenant.findUnique({
        where: { slug: cleanSlug },
      }).catch(() => null);

      await DomainRegistryService.registerDomain({
        id: tenant?.id || cleanSlug,
        slug: cleanSlug,
        domain: tenant?.domain || cleanSlug,
        customDomain: meta.customDomain,
        isActive: tenant?.isActive ?? true,
        isVerified: true,
      });

      return {
        success: true,
        status: 'VERIFIED',
        meta,
      };
    } else {
      meta.status = 'FAILED';
      meta.lastCheckedAt = now;
      meta.lastError = checkResult.error || 'Проверка DNS не удалась';

      await this.saveDomainMeta(cleanSlug, meta);

      return {
        success: false,
        status: 'FAILED',
        error: checkResult.error,
        meta,
      };
    }
  }

  /**
   * Rotates and issues a new verification token for the tenant.
   */
  public static async regenerateToken(tenantSlug: string): Promise<TenantDomainMeta> {
    const cleanSlug = sanitizeTenantSlug(tenantSlug);
    let meta = await this.getDomainMeta(cleanSlug);

    if (!meta) {
      const tenant = await db.tenant.findUnique({
        where: { slug: cleanSlug },
        select: { customDomain: true },
      });
      if (!tenant?.customDomain) {
        throw new Error(`Бренд "${cleanSlug}" не имеет настроенного кастомного домена.`);
      }
      meta = this.generateDomainMeta(cleanSlug, tenant.customDomain);
    } else {
      const newToken = `omni_verify_${crypto.randomBytes(16).toString('hex')}`;
      meta.verificationToken = newToken;
      meta.txtValue = `omnismm-verify=${newToken}`;
      meta.status = 'PENDING';
      meta.lastError = null;
    }

    await this.saveDomainMeta(cleanSlug, meta);
    return meta;
  }
}
