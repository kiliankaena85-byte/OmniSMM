'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export function NetworkAwareProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleOffline = () => {
      toast.error('Нет подключения к сети', {
        id: 'network-status',
        description: 'Возможно, форма не будет отправлена. Проверьте интернет.',
        duration: Infinity,
      });
    };

    const handleOnline = () => {
      toast.success('Подключение восстановлено', {
        id: 'network-status',
        description: 'Вы снова онлайн',
        duration: 3000,
      });
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Initial check
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return <>{children}</>;
}
