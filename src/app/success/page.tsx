import { Suspense } from 'react';
import { SuccessContent } from './SuccessContent';

export const metadata = {
  title: 'Статус оплаты | SMMplan',
  description: 'Проверка статуса вашего платежа',
};

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
