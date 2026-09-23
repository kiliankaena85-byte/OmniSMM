import { redirect } from 'next/navigation';
import { ClientDashboardsDemo } from './client-demo-client';

export default async function ClientDemoPage() {
  const isProd = process.env.NODE_ENV === 'production';
  let isTestMode = false;
  try {
    const { SettingsManager } = await import('@/lib/settings');
    isTestMode = await SettingsManager.isTestMode();
  } catch {
    /* prod */
  }
  if (isProd && !isTestMode) redirect('/');
  return <ClientDashboardsDemo />;
}
