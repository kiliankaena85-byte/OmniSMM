'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { syncProviderCatalogAction } from '@/actions/admin/providers/crud';

interface Props {
  providerId: string;
}

export function SyncProviderButton({ providerId }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSync = async () => {
    startTransition(async () => {
      const result = await syncProviderCatalogAction(providerId);
      if (result.success && result.stats) {
        toast.success('Каталог синхронизирован', {
          description: `Отключено зомби: ${result.stats.zombiesDisabled}, Восстановлено: ${result.stats.resurrected}, Аномалии цен: ${result.stats.priceAnomalies}`
        });
        router.refresh();
      } else {
        toast.error('Ошибка синхронизации', {
          description: result.error || 'Неизвестная ошибка'
        });
      }
    });
  };

  return (
    <Button
      intent="outline"
      size="sm"
      className="text-[10px] h-7 font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all duration-200"
      onClick={handleSync}
      disabled={isPending}
    >
      {isPending ? (
        <div className="flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Синхронизация...</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3" />
          <span>Обновить</span>
        </div>
      )}
    </Button>
  );
}
