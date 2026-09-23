'use client';

import './globals.css';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error?: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error) {
      console.error('[GlobalErrorRoot]', error);
    }
  }, [error]);

  return (
    <html lang="ru">
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 font-sans antialiased">
        <div className="max-w-md w-full bg-card text-card-foreground border border-border/80 rounded-2xl p-6 text-center shadow-2xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Критическая ошибка приложения
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Произошел непредвиденный сбой при инициализации платформы. Попробуйте обновить страницу или передайте код ошибки службе поддержки.
          </p>
          {error?.digest && (
            <div className="py-2 px-3 bg-muted border border-border rounded-lg text-xs font-mono text-muted-foreground select-all break-all">
              <span className="font-semibold select-none">Код ошибки: </span>
              {error.digest}
            </div>
          )}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              type="button"
              className="w-full sm:w-auto px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 active:scale-95 transition shadow-sm cursor-pointer"
            >
              Попробовать снова
            </button>
            <a
              href="/"
              className="w-full sm:w-auto px-5 py-2.5 bg-muted text-foreground border border-border text-sm font-medium rounded-xl hover:bg-muted/80 active:scale-95 transition text-center"
            >
              На главную
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
