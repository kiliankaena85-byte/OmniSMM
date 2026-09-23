'use client';

import { useEffect } from 'react';

export default function ServicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Services Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Что-то пошло не так
        </h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Не удалось загрузить каталог услуг. Попробуйте обновить страницу.
        </p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-90"
      >
        Обновить
      </button>
    </div>
  );
}
