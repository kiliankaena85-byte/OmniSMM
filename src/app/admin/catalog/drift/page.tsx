import { getDriftCandidatesAction } from '@/actions/admin/catalog/price-drift';
import { DriftClient } from './drift-client';

export const metadata = {
  title: 'Price Drift Monitor | OmniSMM 1.0',
};

export default async function DriftPage() {
  const result = await getDriftCandidatesAction();
  
  if (!result.success) {
    return (
      <div className="p-6">
        <div className="text-danger">Ошибка загрузки: {result.error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Price Drift Monitor</h1>
        <p className="text-default-500 mt-2">
          Мониторинг постепенного повышения цен провайдеров (дрейф от 5% до 20% за 30 дней). 
          Эти услуги еще не ушли в карантин, но постепенно снижают маржинальность системы.
        </p>
      </div>

      <DriftClient initialData={result.data || []} />
    </div>
  );
}
