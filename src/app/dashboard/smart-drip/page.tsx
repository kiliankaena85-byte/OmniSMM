import { getClientCampaigns } from '@/actions/order/smart';
import { SmartDripDashboardClient, CampaignDTO } from './smart-client';

export const dynamic = 'force-dynamic';

export default async function SmartDripDashboardPage() {
  const result = await getClientCampaigns(1, 100);
  const campaigns = result.success ? result.data.campaigns : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Умный Dripfeed</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Мониторинг ваших постепенных доставок и распределения заказов во времени
        </p>
      </div>

      <SmartDripDashboardClient initialCampaigns={campaigns as CampaignDTO[]} />
    </div>
  );
}
