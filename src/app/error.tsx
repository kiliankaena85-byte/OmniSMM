'use client';

import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { FluxButton, FluxCard, FluxBadge } from '@/components/ui';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 relative overflow-hidden font-sans">
      {/* Radiant Aurora Mesh Backdrop */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 opacity-40 dark:opacity-20"
        style={{
          backgroundImage: `
            radial-gradient(65% 55% at 15% 0%, rgba(59, 130, 246, 0.55), transparent 70%),
            radial-gradient(55% 55% at 85% 5%, rgba(56, 189, 248, 0.45), transparent 70%),
            radial-gradient(65% 55% at 20% 40%, rgba(244, 63, 94, 0.45), transparent 70%),
            radial-gradient(55% 55% at 80% 50%, rgba(249, 115, 22, 0.40), transparent 70%),
            radial-gradient(70% 70% at 50% 25%, rgba(217, 70, 239, 0.50), transparent 75%)
          `
        }}
      />

      <FluxCard variant="glass" padding="xl" className="max-w-md w-full text-center relative z-10 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
        <div className="space-y-6">
          <div className="flex justify-center">
            <FluxBadge variant="destructive" pulse icon={<AlertTriangle className="w-3.5 h-3.5" />}>
              Системное уведомление
            </FluxBadge>
          </div>

          <div className="w-16 h-16 rounded-3xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-pink-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-foreground">Что-то пошло не так</h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
              Возникла непредвиденная ошибка при загрузке. Попробуйте обновить страницу.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground/60 font-mono mt-2 bg-muted/40 py-1 px-3 rounded-full inline-block">
                Код: {error.digest}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <FluxButton
              onClick={reset}
              variant="primary"
              size="md"
              rightIcon={<RefreshCw className="w-4 h-4" />}
            >
              Попробовать снова
            </FluxButton>
            <Link href="/">
              <FluxButton variant="outline" size="md" rightIcon={<Home className="w-4 h-4" />}>
                На главную
              </FluxButton>
            </Link>
          </div>
        </div>
      </FluxCard>
    </div>
  );
}
