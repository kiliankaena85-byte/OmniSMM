import { normalizeTenantId, sanitizeTenantSlug } from '@/lib/tenant-resolver-edge';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

export type ThemePresetName = 'sky' | 'violet' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate' | 'custom';

export interface ThemePresetTokens {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  ring: string;
  accent: string;
  accentForeground: string;
  darkPrimary: string;
  darkPrimaryForeground: string;
  darkSecondary: string;
  darkSecondaryForeground: string;
  darkRing: string;
  radius: string;
}

export const THEME_PRESETS: Record<Exclude<ThemePresetName, 'custom'>, ThemePresetTokens> = {
  sky: {
    primary: '#0369a1',
    primaryForeground: '#ffffff',
    secondary: '#e0f2fe',
    secondaryForeground: '#0369a1',
    ring: '#bae6fd',
    accent: '#f1f5f9',
    accentForeground: '#0f172a',
    darkPrimary: '#38bdf8',
    darkPrimaryForeground: '#0f172a',
    darkSecondary: '#0c4a6e',
    darkSecondaryForeground: '#38bdf8',
    darkRing: 'rgba(56, 189, 248, 0.35)',
    radius: '1.25rem',
  },
  violet: {
    primary: '#9333ea',
    primaryForeground: '#ffffff',
    secondary: '#fdf2f8',
    secondaryForeground: '#be185d',
    ring: 'rgba(147, 51, 234, 0.35)',
    accent: '#faf5ff',
    accentForeground: '#7e22ce',
    darkPrimary: '#c084fc',
    darkPrimaryForeground: '#090d16',
    darkSecondary: '#3b0764',
    darkSecondaryForeground: '#f472b6',
    darkRing: 'rgba(192, 132, 252, 0.4)',
    radius: '1.25rem',
  },
  emerald: {
    primary: '#047857',
    primaryForeground: '#ffffff',
    secondary: '#d1fae5',
    secondaryForeground: '#047857',
    ring: '#a7f3d0',
    accent: '#f1f5f9',
    accentForeground: '#0f172a',
    darkPrimary: '#10b981',
    darkPrimaryForeground: '#020617',
    darkSecondary: '#064e3b',
    darkSecondaryForeground: '#34d399',
    darkRing: 'rgba(16, 185, 129, 0.35)',
    radius: '1.25rem',
  },
  amber: {
    primary: '#d97706',
    primaryForeground: '#ffffff',
    secondary: '#fef3c7',
    secondaryForeground: '#b45309',
    ring: '#fde68a',
    accent: '#fffbeb',
    accentForeground: '#92400e',
    darkPrimary: '#fbbf24',
    darkPrimaryForeground: '#0f172a',
    darkSecondary: '#78350f',
    darkSecondaryForeground: '#fcd34d',
    darkRing: 'rgba(251, 191, 36, 0.35)',
    radius: '1.25rem',
  },
  rose: {
    primary: '#e11d48',
    primaryForeground: '#ffffff',
    secondary: '#ffe4e6',
    secondaryForeground: '#be123c',
    ring: '#fecdd3',
    accent: '#fff1f2',
    accentForeground: '#9f1239',
    darkPrimary: '#fb7185',
    darkPrimaryForeground: '#0f172a',
    darkSecondary: '#881337',
    darkSecondaryForeground: '#fda4af',
    darkRing: 'rgba(251, 113, 133, 0.35)',
    radius: '1.25rem',
  },
  indigo: {
    primary: '#4f46e5',
    primaryForeground: '#ffffff',
    secondary: '#e0e7ff',
    secondaryForeground: '#4338ca',
    ring: '#c7d2fe',
    accent: '#eef2ff',
    accentForeground: '#3730a3',
    darkPrimary: '#818cf8',
    darkPrimaryForeground: '#0f172a',
    darkSecondary: '#312e81',
    darkSecondaryForeground: '#a5b4fc',
    darkRing: 'rgba(129, 140, 248, 0.35)',
    radius: '1.25rem',
  },
  slate: {
    primary: '#334155',
    primaryForeground: '#ffffff',
    secondary: '#f1f5f9',
    secondaryForeground: '#1e293b',
    ring: '#cbd5e1',
    accent: '#f8fafc',
    accentForeground: '#0f172a',
    darkPrimary: '#94a3b8',
    darkPrimaryForeground: '#0f172a',
    darkSecondary: '#1e293b',
    darkSecondaryForeground: '#e2e8f0',
    darkRing: 'rgba(148, 163, 184, 0.35)',
    radius: '0.75rem',
  },
};

export interface TenantThemeConfig {
  preset: ThemePresetName;
  primaryColor?: string;
  primaryForeground?: string;
  secondaryColor?: string;
  secondaryForeground?: string;
  ringColor?: string;
  accentColor?: string;
  accentForeground?: string;
  borderRadius?: string;
  darkPrimaryColor?: string;
  darkPrimaryForeground?: string;
  darkSecondaryColor?: string;
  darkSecondaryForeground?: string;
  darkRingColor?: string;
}

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR_REGEX = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;
const HSL_COLOR_REGEX = /^hsla?\(\s*\d{1,3}\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;
const RADIUS_REGEX = /^\d+(\.\d+)?(rem|px|em|%)$/;

/**
 * Validates and sanitizes CSS color values to prevent CSS/HTML injection.
 */
export function sanitizeColor(color: string | undefined | null): string | null {
  if (!color || typeof color !== 'string') return null;
  const trimmed = color.trim();
  if (HEX_COLOR_REGEX.test(trimmed) || RGB_COLOR_REGEX.test(trimmed) || HSL_COLOR_REGEX.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Validates and sanitizes CSS border radius values.
 */
export function sanitizeRadius(radius: string | undefined | null, fallback = '1.25rem'): string {
  if (!radius || typeof radius !== 'string') return fallback;
  const trimmed = radius.trim();
  if (RADIUS_REGEX.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

// In-Memory L1 Cache: tenantId -> { theme, expiresAt }
const l1ThemeCache = new Map<string, { theme: TenantThemeConfig; expiresAt: number }>();
const L1_TTL_MS = 60 * 1000; // 60 seconds

export class TenantThemeService {
  /**
   * Resets local in-memory cache (useful for testing and instant invalidation)
   */
  static clearCache(tenantId?: string) {
    if (tenantId) {
      const clean = normalizeTenantId(tenantId) || tenantId;
      l1ThemeCache.delete(clean);
      l1ThemeCache.delete(tenantId);
    } else {
      l1ThemeCache.clear();
    }
  }

  /**
   * Resolves default preset for standard/fallback tenants
   */
  static getDefaultPreset(tenantId: string): ThemePresetName {
    const clean = normalizeTenantId(tenantId) || 'smmplan';
    if (clean === 'flux') return 'violet';
    if (clean === 'smmplan') return 'sky';
    return 'sky';
  }

  /**
   * Resolves the full TenantThemeConfig using L1 (Memory) -> L2 (Redis) -> L3 (PostgreSQL SystemSetting)
   */
  static async getTheme(tenantId: string): Promise<TenantThemeConfig> {
    const cleanTenant = normalizeTenantId(tenantId) || 'smmplan';

    // 1. L1 In-Memory Cache
    const cached = l1ThemeCache.get(cleanTenant);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.theme;
    }

    const defaultPreset = this.getDefaultPreset(cleanTenant);
    const defaultTokens = THEME_PRESETS[defaultPreset === 'custom' ? 'sky' : defaultPreset];

    let resolvedConfig: TenantThemeConfig = {
      preset: defaultPreset,
      primaryColor: defaultTokens.primary,
      primaryForeground: defaultTokens.primaryForeground,
      secondaryColor: defaultTokens.secondary,
      secondaryForeground: defaultTokens.secondaryForeground,
      ringColor: defaultTokens.ring,
      accentColor: defaultTokens.accent,
      accentForeground: defaultTokens.accentForeground,
      borderRadius: defaultTokens.radius,
      darkPrimaryColor: defaultTokens.darkPrimary,
      darkPrimaryForeground: defaultTokens.darkPrimaryForeground,
      darkSecondaryColor: defaultTokens.darkSecondary,
      darkSecondaryForeground: defaultTokens.darkSecondaryForeground,
      darkRingColor: defaultTokens.darkRing,
    };

    // 2. L2 Redis Cache
    try {
      if (redis.status === 'ready') {
        const rawJson = await redis.get(`tenant:theme:${cleanTenant}`);
        if (rawJson) {
          const parsed = JSON.parse(rawJson) as Partial<TenantThemeConfig>;
          resolvedConfig = this.mergeWithPreset(parsed, defaultPreset);
          l1ThemeCache.set(cleanTenant, { theme: resolvedConfig, expiresAt: Date.now() + L1_TTL_MS });
          return resolvedConfig;
        }
      }
    } catch (err) {
      console.warn(`[TenantThemeService] Redis get error for ${cleanTenant}:`, err);
    }

    // 3. L3 PostgreSQL SystemSetting lookup (Key: "tenant_theme_<cleanTenant>")
    try {
      const setting = await db.systemSetting.findUnique({
        where: { key: `tenant_theme_${cleanTenant}` }
      });

      if (setting && setting.value) {
        const parsed = JSON.parse(setting.value) as Partial<TenantThemeConfig>;
        resolvedConfig = this.mergeWithPreset(parsed, defaultPreset);

        // Populate Redis
        try {
          if (redis.status === 'ready') {
            await redis.set(`tenant:theme:${cleanTenant}`, JSON.stringify(resolvedConfig), 'EX', 3600);
          }
        } catch {
          // ignore redis set failure
        }
      }
    } catch {
      // In test mode or when DB table is not yet seeded, keep fallback
    }

    // Populate L1 Cache
    l1ThemeCache.set(cleanTenant, { theme: resolvedConfig, expiresAt: Date.now() + L1_TTL_MS });
    return resolvedConfig;
  }

  /**
   * Merges partial configuration with base preset tokens
   */
  static mergeWithPreset(partial: Partial<TenantThemeConfig>, fallbackPreset: ThemePresetName): TenantThemeConfig {
    const preset = partial.preset && partial.preset in THEME_PRESETS ? partial.preset : fallbackPreset;
    const baseTokens = THEME_PRESETS[preset === 'custom' ? 'sky' : (preset as Exclude<ThemePresetName, 'custom'>)];

    return {
      preset,
      primaryColor: sanitizeColor(partial.primaryColor) || baseTokens.primary,
      primaryForeground: sanitizeColor(partial.primaryForeground) || baseTokens.primaryForeground,
      secondaryColor: sanitizeColor(partial.secondaryColor) || baseTokens.secondary,
      secondaryForeground: sanitizeColor(partial.secondaryForeground) || baseTokens.secondaryForeground,
      ringColor: sanitizeColor(partial.ringColor) || baseTokens.ring,
      accentColor: sanitizeColor(partial.accentColor) || baseTokens.accent,
      accentForeground: sanitizeColor(partial.accentForeground) || baseTokens.accentForeground,
      borderRadius: sanitizeRadius(partial.borderRadius, baseTokens.radius),
      darkPrimaryColor: sanitizeColor(partial.darkPrimaryColor) || baseTokens.darkPrimary,
      darkPrimaryForeground: sanitizeColor(partial.darkPrimaryForeground) || baseTokens.darkPrimaryForeground,
      darkSecondaryColor: sanitizeColor(partial.darkSecondaryColor) || baseTokens.darkSecondary,
      darkSecondaryForeground: sanitizeColor(partial.darkSecondaryForeground) || baseTokens.darkSecondaryForeground,
      darkRingColor: sanitizeColor(partial.darkRingColor) || baseTokens.darkRing,
    };
  }

  /**
   * Persists updated theme configuration to DB and Redis
   */
  static async saveTheme(tenantId: string, config: Partial<TenantThemeConfig>, adminEmail = 'system'): Promise<TenantThemeConfig> {
    const cleanTenant = normalizeTenantId(tenantId) || 'smmplan';
    const defaultPreset = this.getDefaultPreset(cleanTenant);
    const merged = this.mergeWithPreset(config, defaultPreset);

    // Save to PostgreSQL SystemSetting
    await db.systemSetting.upsert({
      where: { key: `tenant_theme_${cleanTenant}` },
      create: {
        key: `tenant_theme_${cleanTenant}`,
        value: JSON.stringify(merged),
        group: 'THEME',
        description: `Theme tokens for tenant ${cleanTenant}`,
        updatedBy: adminEmail,
      },
      update: {
        value: JSON.stringify(merged),
        updatedBy: adminEmail,
      },
    });

    // Save to Redis
    try {
      if (redis.status === 'ready') {
        await redis.set(`tenant:theme:${cleanTenant}`, JSON.stringify(merged), 'EX', 86400);
      }
    } catch (err) {
      console.warn(`[TenantThemeService] Failed to cache theme in Redis:`, err);
    }

    // Invalidate L1 Cache
    this.clearCache(cleanTenant);

    return merged;
  }

  /**
   * Generates sanitized CSS variables scoped for light and dark modes
   */
  static generateCss(config: TenantThemeConfig, tenantId: string): string {
    const cleanTenant = sanitizeTenantSlug(tenantId) || normalizeTenantId(tenantId) || 'smmplan';
    const preset = config.preset && config.preset in THEME_PRESETS ? config.preset : 'sky';
    const fallback = THEME_PRESETS[preset === 'custom' ? 'sky' : (preset as Exclude<ThemePresetName, 'custom'>)];

    const primary = sanitizeColor(config.primaryColor) || fallback.primary;
    const primaryForeground = sanitizeColor(config.primaryForeground) || fallback.primaryForeground;
    const secondary = sanitizeColor(config.secondaryColor) || fallback.secondary;
    const secondaryForeground = sanitizeColor(config.secondaryForeground) || fallback.secondaryForeground;
    const ring = sanitizeColor(config.ringColor) || fallback.ring;
    const accent = sanitizeColor(config.accentColor) || fallback.accent;
    const accentForeground = sanitizeColor(config.accentForeground) || fallback.accentForeground;
    const radius = sanitizeRadius(config.borderRadius, fallback.radius);

    const darkPrimary = sanitizeColor(config.darkPrimaryColor) || fallback.darkPrimary;
    const darkPrimaryForeground = sanitizeColor(config.darkPrimaryForeground) || fallback.darkPrimaryForeground;
    const darkSecondary = sanitizeColor(config.darkSecondaryColor) || fallback.darkSecondary;
    const darkSecondaryForeground = sanitizeColor(config.darkSecondaryForeground) || fallback.darkSecondaryForeground;
    const darkRing = sanitizeColor(config.darkRingColor) || fallback.darkRing;

    return `
:root, [data-tenant="${cleanTenant}"], .theme-${cleanTenant} {
  --color-primary: ${primary};
  --color-primary-foreground: ${primaryForeground};
  --color-secondary: ${secondary};
  --color-secondary-foreground: ${secondaryForeground};
  --color-ring: ${ring};
  --color-accent: ${accent};
  --color-accent-foreground: ${accentForeground};
  --radius: ${radius};
}

.dark, .dark[data-tenant="${cleanTenant}"], .dark.theme-${cleanTenant}, [data-theme*="dark"][data-tenant="${cleanTenant}"], [data-tenant="${cleanTenant}"] .dark {
  --color-primary: ${darkPrimary};
  --color-primary-foreground: ${darkPrimaryForeground};
  --color-secondary: ${darkSecondary};
  --color-secondary-foreground: ${darkSecondaryForeground};
  --color-ring: ${darkRing};
}
`.trim();
  }
}
