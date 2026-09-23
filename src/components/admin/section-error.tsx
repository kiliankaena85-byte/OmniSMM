'use client';

import { useEffect } from 'react';

export function AdminSectionError({
  error,
  reset,
  sectionTitle,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  sectionTitle: string;
}) {
  useEffect(() => {
    console.error(`[Admin ${sectionTitle} Error Boundary]`, error);
  }, [error, sectionTitle]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Раздел временно недоступен</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          При загрузке раздела «{sectionTitle}» произошла ошибка. Попробуйте снова —
          если повторяется, сообщите разработчику ID ошибки ниже.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">ID: {error.digest}</p>
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
