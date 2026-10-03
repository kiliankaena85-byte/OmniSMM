'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { 
  LayoutGrid, 
  AlertTriangle, 
  Loader, 
  Clock, 
  Banknote, 
  RefreshCw, 
  Unplug, 
  CalendarDays, 
  Undo2 
} from 'lucide-react';

export const QUICK_FILTERS = [
  {
    id: 'all',
    label: 'Все',
    icon: LayoutGrid,
    params: {}
  },
  {
    id: 'errors',
    label: 'Ошибки',
    icon: AlertTriangle,
    params: { status: 'ERROR' },
    color: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20'
  },
  {
    id: 'in_progress',
    label: 'В работе',
    icon: Loader,
    params: { status: 'IN_PROGRESS' },
    color: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20'
  },
  {
    id: 'stale',
    label: 'Ожидают >1ч',
    icon: Clock,
    params: { status: 'PENDING', stale: '60' },
    color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
  },
  {
    id: 'expensive',
    label: 'Дорогие >500₽',
    icon: Banknote,
    params: { minPrice: '500' },
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  },
  {
    id: 'dripfeed',
    label: 'Dripfeed',
    icon: RefreshCw,
    params: { isDripFeed: 'true' },
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
  },
  {
    id: 'no_provider',
    label: 'Без провайдера',
    icon: Unplug,
    params: { noProvider: 'true' },
    color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20'
  },
  {
    id: 'today',
    label: 'Сегодня',
    icon: CalendarDays,
    params: { datePreset: 'today' },
    color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20'
  },
  {
    id: 'refunding',
    label: 'С возвратом',
    icon: Undo2,
    params: { status: 'REFUNDING' },
    color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
  }
];

export function QuickFilterChips() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeStatus = searchParams.get('status') || '';
  const activeStale = searchParams.get('stale') || '';
  const activeMinPrice = searchParams.get('minPrice') || '';
  const activeIsDripFeed = searchParams.get('isDripFeed') || '';
  const activeNoProvider = searchParams.get('noProvider') || '';
  const activeDatePreset = searchParams.get('datePreset') || '';

  const getIsActive = (chip: typeof QUICK_FILTERS[number]) => {
    if (chip.id === 'all') {
      return !activeStatus && !activeStale && !activeMinPrice && !activeIsDripFeed && !activeNoProvider && !activeDatePreset;
    }
    if (chip.params.status && activeStatus !== chip.params.status) return false;
    if (chip.params.stale && activeStale !== chip.params.stale) return false;
    if (chip.params.minPrice && activeMinPrice !== chip.params.minPrice) return false;
    if (chip.params.isDripFeed && activeIsDripFeed !== chip.params.isDripFeed) return false;
    if (chip.params.noProvider && activeNoProvider !== chip.params.noProvider) return false;
    if (chip.params.datePreset && activeDatePreset !== chip.params.datePreset) return false;
    return true;
  };

  const handleSelect = (chip: typeof QUICK_FILTERS[number]) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Reset specific chip params if clicking active chip or clicking ALL
    if (chip.id === 'all' || getIsActive(chip)) {
      ['status', 'stale', 'minPrice', 'isDripFeed', 'noProvider', 'datePreset'].forEach(k => params.delete(k));
    } else {
      // Clear conflicting params and set new chip params
      ['status', 'stale', 'minPrice', 'isDripFeed', 'noProvider', 'datePreset'].forEach(k => params.delete(k));
      Object.entries(chip.params).forEach(([k, v]) => params.set(k, v));
    }

    params.delete('cursor');
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Быстрые:</span>
      {QUICK_FILTERS.map((chip) => {
        const Icon = chip.icon;
        const isActive = getIsActive(chip);

        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => handleSelect(chip)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 active:scale-95 shadow-sm ${
              isActive
                ? 'bg-primary text-primary-foreground border-primary shadow-md'
                : chip.color || 'bg-background/80 hover:bg-muted text-foreground border-border/60'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
