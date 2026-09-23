export const dynamic = 'force-dynamic';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { ApiDashboardClient } from '@/components/dashboard/settings/api/ApiDashboardClient';

export const metadata = {
  title: 'API-доступ | SMMplan',
  description: 'Управляйте вашим Panel API-ключом и изучайте стандартизированные интеграционные руководства.',
};

export default async function ApiSettingsPage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { apiKeyHash: true },
  });

  if (!user) redirect('/login');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API-доступ</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Интегрируйте возможности SMMplan прямо в ваши CRM, платформы реселлеров или боты.
        </p>
      </div>

      <ApiDashboardClient hasKey={!!user.apiKeyHash} />
    </div>
  );
}
