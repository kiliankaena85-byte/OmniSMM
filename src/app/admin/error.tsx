'use client';

import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Admin Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Произошла ошибка
        </h2>
        <p className="text-muted-foreground text-sm max-w-md">
          При загрузке раздела администрирования произошла непредвиденная ошибка.
          Попробуйте обновить страницу.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            ID: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-90"
      >
        Попробовать снова
      </button>
    </div>
  );
}
