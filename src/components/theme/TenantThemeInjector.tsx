import React from 'react';
import { TenantThemeService } from '@/services/tenant/tenant-theme.service';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';

interface TenantThemeInjectorProps {
  tenantId?: string;
  nonce?: string;
}

/**
 * High-performance SSR style injector for White-Label Dynamic Theming.
 * Renders into <head> with cryptographic nonce to prevent FOUC and enforce strict CSP.
 */
export async function TenantThemeInjector({ tenantId, nonce }: TenantThemeInjectorProps) {
  const cleanTenant = normalizeTenantId(tenantId) || 'smmplan';
  
  let css = '';
  try {
    const theme = await TenantThemeService.getTheme(cleanTenant);
    css = TenantThemeService.generateCss(theme, cleanTenant);
  } catch (err) {
    console.error(`[TenantThemeInjector] Failed to generate theme CSS for ${cleanTenant}:`, err);
    // Safe empty style tag fallback
    return null;
  }

  if (!css) return null;

  return (
    <style
      id={`theme-vars-${cleanTenant}`}
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
