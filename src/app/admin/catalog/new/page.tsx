import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { SettingsProvider } from '@/lib/settings';
import { ServiceEditForm, InitialServiceData } from '../components/service-edit-form';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams?: Promise<{ returnUrl?: string; [key: string]: string | undefined }>;
}

export default async function AdminNewServicePage({ searchParams }: Props) {
  const session = await verifySession();
  if (!session) redirect('/admin/login');

  const sp = searchParams ? await searchParams : {};
  const returnUrl = sp.returnUrl || '/admin/catalog';

  const [networks, providers, exchangeRateUsd] = await Promise.all([
    db.network.findMany({
      orderBy: { sort: 'asc' },
      include: {
        categories: {
          orderBy: { sort: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    }),
    db.provider.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        balanceCurrency: true
      }
    }),
    SettingsProvider.getExchangeRateUSD()
  ]);

  const defaultCategory = networks[0]?.categories[0];

  const initialData: InitialServiceData = {
    name: '',
    description: '',
    icon: null,
    categoryId: defaultCategory?.id || '',
    rate: 0.1,
    markup: 2.0,
    minQty: 10,
    maxQty: 10000,
    providerId: providers[0]?.id || null,
    externalId: '',
    targetType: 'POST',
    isActive: true,
    isDripFeedEnabled: true,
    isRefillEnabled: false,
    isCancelEnabled: false,
    linkPlaceholder: '',
    linkHint: '',
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <ServiceEditForm
        initialData={initialData}
        networks={networks}
        providers={providers}
        exchangeRateUsd={exchangeRateUsd || 90.0}
        returnUrl={returnUrl}
      />
    </div>
  );
}
