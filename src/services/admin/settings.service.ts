import { Prisma, UsnScheme } from '@prisma/client';
import { db } from '@/lib/db';
import { SettingsProvider, getTenantFallbackBranding } from '@/lib/settings';
import { redis } from '@/lib/redis';

class SettingsService {
  // ── User Management ──
  async listUsers(search?: string, tenantId?: string) {
    return db.user.findMany({
      where: {
        ...(search ? { email: { contains: search, mode: 'insensitive' } } : {}),
        ...(tenantId ? { tenantId } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        email: true,
        role: true,
        balance: true,
        supportLimitCents: true,
        createdAt: true,
        _count: { select: { orders: true, tickets: true } }
      }
    });
  }

  async listStaffUsers(tenantId?: string) {
    return db.user.findMany({
      where: { 
        role: { in: ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'] },
        ...(tenantId ? { tenantId } : {})
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        balance: true,
        supportLimitCents: true,
        staffRoleId: true,
        staffRole: {
          select: {
            id: true,
            name: true,
          }
        },
        geminiApiKey: true,
        createdAt: true,
        _count: { select: { orders: true, tickets: true } }
      }
    });
  }

  async updateUserRole(userId: string, role: string, staffRoleId?: string | null) {
    const validRoles = ['USER', 'SUPPORT', 'MANAGER', 'ADMIN', 'OWNER', 'BANNED'];
    if (!validRoles.includes(role)) throw new Error(`Invalid role: ${role}`);
    
        const dataToUpdate: Prisma.UserUpdateInput = { role };
    if (staffRoleId !== undefined) {
      dataToUpdate.staffRole = staffRoleId ? { connect: { id: staffRoleId } } : { disconnect: true };
    }
    
    return db.user.update({
      where: { id: userId },
      data: dataToUpdate
    });
  }

  // ── Provider Management ──
  async listProviders() {
    return db.provider.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async upsertProvider(data: { id?: string; name: string; apiUrl: string; apiKey: string; isActive: boolean }) {
    if (data.id) {
      return db.provider.update({
        where: { id: data.id },
        data: { name: data.name, apiUrl: data.apiUrl, apiKey: data.apiKey, isActive: data.isActive }
      });
    }
    return db.provider.create({
      data: { name: data.name, apiUrl: data.apiUrl, apiKey: data.apiKey, isActive: data.isActive }
    });
  }

  async deleteProvider(id: string) {
    return db.provider.delete({ where: { id } });
  }

  // ── System Settings ──
  async getSystemSettings(tenantId?: string) {
    const activeTenantId = tenantId || await SettingsProvider.getTenantId();
    let settings = await db.systemSettings.findUnique({ where: { id: activeTenantId } });
    if (!settings) {
      const defaultName = getTenantFallbackBranding(activeTenantId).name;
      settings = await db.systemSettings.create({
        data: { id: activeTenantId, taxRate: 6.0, opexMonthly: 0, maintenanceMode: false, siteName: defaultName, siteDescription: '' }
      });
    }
    if (SettingsProvider.isTestEnvironment()) {
      settings.isTestMode = true;
    }
    return settings;
  }

  async updateSystemSettings(data: {
    taxRate?: number;
    opexMonthly?: number;
    maintenanceMode?: boolean;
    siteName?: string;
    siteDescription?: string;
    welcomeMessage?: string | null;
    yookassaShopId?: string | null;
    yookassaSecretKey?: string | null;
    yookassaTestShopId?: string | null;
    yookassaTestSecretKey?: string | null;
    cryptoBotToken?: string | null;
    exchangeRateUSD?: number;
    smtpHost?: string | null;
    smtpPort?: number;
    smtpUser?: string | null;
    smtpPassword?: string | null;
    supportEmailDomain?: string | null;
    inboundEmailWebhookSecret?: string | null;
    contactSupportEmail?: string | null;
    contactPrivacyEmail?: string | null;
    contactTelegramBot?: string | null;
    contactTelegramChannel?: string | null;
    contactWhatsApp?: string | null;
    contactVk?: string | null;
    legalCompanyName?: string | null;
    legalCompanyInn?: string | null;
    legalCompanyOgrnip?: string | null;
    legalCompanyAddress?: string | null;
    quarantineThreshold?: number;
    globalMarkup?: number;
    safetyFloor?: number;
    siteLogoUrl?: string | null;
    siteFaviconUrl?: string | null;
    robokassaLogin?: string | null;
    robokassaPassword?: string | null;
    robokassaWebhookPassword?: string | null;
    emailProvider?: string;
    resendApiKey?: string | null;
    usnScheme?: UsnScheme;
  }, tenantId?: string) {
    const activeTenantId = tenantId || await SettingsProvider.getTenantId();
    const result = await db.systemSettings.upsert({
      where: { id: activeTenantId },
      update: data,
      create: { id: activeTenantId, ...data }
    });

    SettingsProvider.clearMemoryCache(activeTenantId);

    if (data.maintenanceMode !== undefined) {
      try {
        await redis.set(`settings:${activeTenantId}:maintenanceMode`, String(data.maintenanceMode));
      } catch (err) {
        console.warn(`[SettingsService] Failed to update Redis cache for maintenanceMode on ${activeTenantId}:`, err);
      }
    }

    return result;
  }
}

export const settingsService = new SettingsService();
