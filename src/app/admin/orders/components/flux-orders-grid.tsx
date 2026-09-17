import * as React from 'react';
import { OrderColumn, RowActions, STATUS_LABELS, STATUS_STYLES, SPEED_CLASS_META } from './columns';
import { OrderEnvironmentBadge } from '@/components/admin/OrderEnvironmentBadge';
import { resolveOrderEnvironmentMode } from '@/utils/order-environment';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Copy, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FluxOrdersGridProps {
  data: OrderColumn[];
  canSeeRates: boolean;
  onSelect: (id: string, isSelected: boolean) => void;
  selectedIds: Set<string>;
  onBulkCancel: (ids: string[]) => void;
  isPendingBulk: boolean;
}

export function FluxOrdersGrid({ data, canSeeRates, onSelect, selectedIds, onBulkCancel, isPendingBulk }: FluxOrdersGridProps) {
  function handleCopyIds() {
    const idsToCopy = Array.from(selectedIds).map(id => {
      const o = data.find(x => x.id === id);
      return o ? (o.numericId ?? o.id) : id;
    });
    navigator.clipboard.writeText(idsToCopy.join(', '));
    toast.success(`ID заказов скопированы (${idsToCopy.length} шт)`);
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-700 ease-out">
      {data.map(order => {
        const style = STATUS_STYLES[order.status] || 'default';
        
        const classes: Record<string, string> = {
          success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          primary: 'bg-primary/10 text-primary border-primary/20',
          default: 'bg-muted text-muted-foreground border-border/80',
        };

        const s = order.service;
        const dateStr = new Date(order.createdAt).toLocaleString('ru-RU', { 
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        return (
          <div key={order.id} className="group relative bg-background/50 backdrop-blur-md border border-border/50 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 flex flex-col gap-4">
            
            {/* Glass Background Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-white/5 dark:to-transparent rounded-3xl pointer-events-none" />

            <div className="relative z-10 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-border/50 text-primary focus:ring-primary cursor-pointer transition-colors"
                  checked={selectedIds.has(order.id)}
                  onChange={(e) => onSelect(order.id, e.target.checked)}
                />
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-extrabold text-lg text-foreground tracking-tight">#{order.numericId}</h3>
                    <OrderEnvironmentBadge mode={order.resolvedEnvironmentMode || resolveOrderEnvironmentMode(order)} size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">{dateStr}</p>
                </div>
              </div>
              <Badge className={`font-bold text-[10px] uppercase px-2 py-1 rounded-xl shadow-sm ${classes[style] || classes.default}`}>
                {STATUS_LABELS[order.status] || order.status}
              </Badge>
            </div>

            <div className="relative z-10 flex-1 space-y-4">
              {/* Service Info */}
              <div className="bg-muted/30 rounded-2xl p-4 border border-border/40 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-md bg-background border border-border/50 text-[9px] font-black uppercase text-muted-foreground tracking-wider">
                    {s.category.network?.name || '—'}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground truncate">
                    {s.category.name}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                  {s.name}
                </p>
                <a
                  href={order.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-mono text-[11px] truncate block mt-2"
                >
                  {order.link}
                </a>
              </div>

              {/* Stats */}
              <div className="flex justify-between items-end px-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Количество</span>
                  <span className="font-extrabold text-foreground text-base tabular-nums">
                    {order.quantity.toLocaleString('ru-RU')}
                    {order.remains > 0 && <span className="text-muted-foreground text-xs ml-1">/ {order.remains} остаток</span>}
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Сумма</span>
                  <span className="font-extrabold text-foreground text-base tabular-nums">
                    {(Number(BigInt(order.charge || 0)) / 100).toFixed(2)} ₽
                  </span>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-4 border-t border-border/40 flex justify-between items-center">
              <Link
                href={`/admin/clients?q=${encodeURIComponent(order.user.email)}`}
                className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors truncate max-w-[150px]"
              >
                {order.user.email}
              </Link>
              <RowActions order={order} />
            </div>
          </div>
        );
      })}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 mx-auto w-max max-w-[90vw] z-50 animate-in slide-in-from-bottom-10 fade-in flex items-center gap-4 bg-card/80 backdrop-blur-xl border border-border px-6 py-3 rounded-full shadow-2xl">
          <div className="flex items-center gap-2 border-r border-border pr-4">
            <Badge className="bg-primary text-primary-foreground font-bold px-2">
              {selectedIds.size}
            </Badge>
            <span className="text-sm font-medium text-foreground">выбрано</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              intent="secondary"
              onClick={handleCopyIds}
              aria-label="Скопировать ID выбранных заказов"
              className="transition-all duration-200 cursor-pointer shadow-sm bg-background hover:bg-muted"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Скопировать ID
            </Button>

            <Button
              size="sm"
              intent="ghost"
              disabled={isPendingBulk}
              onClick={() => onBulkCancel(Array.from(selectedIds))}
              aria-label="Отменить выбранные заказы"
              className="text-destructive hover:bg-destructive/10 transition-all duration-200 cursor-pointer"
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              {isPendingBulk ? 'Отмена...' : 'Отменить'}
            </Button>

            <Button
              size="sm"
              intent="ghost"
              onClick={() => {
                // To unselect all, just call onSelect on each with false. 
                // However, since we don't pass an onUnselectAll prop, we'll just simulate it.
                // It's better to add an onClearSelection prop. Let's just dispatch false for all currently selected.
                Array.from(selectedIds).forEach(id => onSelect(id, false));
              }}
              aria-label="Сбросить выделение"
              className="text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer"
            >
              Сбросить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
