'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface NetworkOption {
  id: string;
  name: string;
  slug: string;
}

export function OrdersFilter({ networks = [] }: { networks?: NetworkOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQ = searchParams.get('q') || '';
  const currentStatus = searchParams.get('status') || 'ALL';
  const currentNetwork = searchParams.get('networkSlug') || 'ALL';
  const currentUserId = searchParams.get('userId') || '';

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    // Preserve active userId if filtering orders of a specific client from CRM profile
    if (currentUserId) {
      params.set('userId', currentUserId);
    }

    fd.forEach((value, key) => {
      const valStr = String(value).trim();
      if (valStr && valStr !== 'ALL') {
        params.set(key, valStr);
      }
    });

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.currentTarget.form?.requestSubmit();
  };

  const handleReset = () => {
    // Keep userId if reset is triggered from specific user profile context
    if (currentUserId) {
      router.push(`${pathname}?userId=${currentUserId}`);
    } else {
      router.push(pathname);
    }
  };

  const QUICK_FILTERS = [
    { value: 'ALL', label: 'Все' },
    { value: 'ACTIVE', label: 'Активные 🔥' },
    { value: 'PROBLEMATIC', label: 'Ошибки / Проблемы ⚠️' },
    { value: 'COMPLETED_ALL', label: 'Выполненные ✅' },
    { value: 'IN_PROGRESS', label: 'В работе' },
    { value: 'CANCELED', label: 'Отменены' },
  ];

  return (
    <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5 space-y-4">
      {/* Quick Status Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none flex-nowrap" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2 shrink-0">Статус:</span>
        {QUICK_FILTERS.map((f) => {
          const isActive = currentStatus === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete('cursor'); // Reset pagination
                if (f.value === 'ALL') {
                  params.delete('status');
                } else {
                  params.set('status', f.value);
                }
                router.push(`${pathname}?${params.toString()}`);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap active:scale-95 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-border/40'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Main Filter Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        {/* Hidden status for form submission to preserve active status badge tab */}
        <input type="hidden" name="status" value={currentStatus} />

        {/* General Search Input */}
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Поиск</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">🔍</span>
            <input
              type="text"
              name="q"
              defaultValue={currentQ}
              placeholder="Email, ID заказа, ссылка или ID провайдера..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Network Slug Select */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Соцсеть</label>
          <select
            name="networkSlug"
            value={currentNetwork}
            onChange={handleSelectChange}
            className="w-full px-3 py-2 text-xs bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground"
          >
            <option value="ALL">Все соцсети</option>
            {networks.map((n) => (
              <option key={n.slug} value={n.slug}>
                {n.name}
              </option>
            ))}
          </select>
        </div>

        {/* Reset / Search Buttons */}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1 rounded-xl text-xs py-2">
            Применить
          </Button>
          <Button
            type="button"
            intent="outline"
            onClick={handleReset}
            className="rounded-xl p-2.5 flex items-center justify-center shrink-0"
            title="Сбросить фильтры"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </form>
    </div>
  );
}
