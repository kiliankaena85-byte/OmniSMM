import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { SettingsProvider } from '@/lib/settings';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let host = '';
  let tenantHeader = '';
  try {
    if (req?.headers) {
      host = req.headers.get('host') || req.headers.get('x-forwarded-host') || '';
      tenantHeader = req.headers.get('x-tenant-id') || '';
    } else {
      const reqHeaders = await headers();
      host = reqHeaders.get('host') || reqHeaders.get('x-forwarded-host') || '';
      tenantHeader = reqHeaders.get('x-tenant-id') || '';
    }
  } catch {
    // Non-request context fallback
  }

  const tenantId = normalizeTenantId(tenantHeader) || 'smmplan';
  const settings = await SettingsProvider.get(tenantId);

  const isTestDomain = host.startsWith('test.') && !host.includes('.ts.net') && !host.includes('tailscale');
  const isMaintenanceMode = settings.maintenanceMode && !isTestDomain;

  if (isMaintenanceMode) {
    const contactSettings = await SettingsProvider.getContactAndLegalSettings(tenantId);
    return NextResponse.json({
      isMaintenanceMode: true,
      siteName: contactSettings.SITE_NAME || (tenantId === 'flux' ? 'SMMflux' : 'SMMplan'),
      message: 'На платформе проводятся плановые технические работы. Сервис скоро возобновит работу.',
    });
  }

  return NextResponse.json({ isMaintenanceMode: false });
}

