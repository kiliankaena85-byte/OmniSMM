import Link from 'next/link';
import { FluxButton, FluxCard, FluxBadge } from '@/components/ui';
import { Home, LayoutDashboard, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Страница не найдена (404)',
};

export default function NotFound() {
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
            <FluxBadge variant="primary" pulse icon={<Sparkles className="w-3.5 h-3.5" />}>
              Ошибка 404
            </FluxBadge>
          </div>

          <div className="text-7xl sm:text-8xl font-black bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent select-none tabular-nums">
            404
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-foreground">Страница не найдена</h1>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
              Такой страницы не существует, либо она была перемещена на новый адрес.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/" className="w-full sm:w-auto">
              <FluxButton variant="primary" size="md" rightIcon={<Home className="w-4 h-4" />}>
                На главную
              </FluxButton>
            </Link>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <FluxButton variant="outline" size="md" rightIcon={<LayoutDashboard className="w-4 h-4" />}>
                Кабинет
              </FluxButton>
            </Link>
          </div>
        </div>
      </FluxCard>
    </div>
  );
}
