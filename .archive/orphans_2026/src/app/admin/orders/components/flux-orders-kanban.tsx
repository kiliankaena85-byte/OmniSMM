import { useState } from 'react';
import { useOrderManagement } from '@/hooks/admin/use-orders';
import { Package, Search, Filter, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatKopecks } from '@/utils/format-kopecks';
import type { OrderColumn } from './columns';
import { OrderEnvironmentBadge } from '@/components/admin/OrderEnvironmentBadge';
import { resolveOrderEnvironmentMode } from '@/utils/order-environment';

export function FluxOrdersKanban({ 
  initialOrders, 
  canSeeRates 
}: { 
  initialOrders: OrderColumn[],
  canSeeRates: boolean
}) {
  const { optimisticData: orders } = useOrderManagement({ initialData: initialOrders });

  const pending = orders.filter(o => o.status === 'PENDING' || o.status === 'AWAITING_PAYMENT');
  const inProgress = orders.filter(o => o.status === 'IN_PROGRESS');
  const completed = orders.filter(o => o.status === 'COMPLETED' || o.status === 'PARTIAL');
  const error = orders.filter(o => o.status === 'ERROR' || o.status === 'CANCELED');

  return (
    <div className="h-full flex flex-col pt-4">
      {/* Sleek Header */}
      <div className="flex items-center justify-between mb-8 px-2">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-foreground/90">Orders <span className="font-semibold text-foreground">Board</span></h1>
          <p className="text-sm text-muted-foreground/60 mt-1">Manage and track service fulfillments in real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => document.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="flex items-center gap-2 px-4 py-2 bg-background/50 hover:bg-muted/80 border border-border/40 backdrop-blur-md rounded-2xl text-sm font-medium transition-all shadow-sm"
          >
            <Search className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Cmd + K to Search</span>
          </button>
          <button className="w-10 h-10 flex items-center justify-center bg-background/50 hover:bg-muted/80 border border-border/40 backdrop-blur-md rounded-2xl transition-all shadow-sm">
            <Filter className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-6 custom-scrollbar">
        <div className="flex gap-6 min-w-max px-2 h-full">
          <KanbanColumn title="Pending" count={pending.length} orders={pending} type="pending" />
          <KanbanColumn title="In Progress" count={inProgress.length} orders={inProgress} type="progress" />
          <KanbanColumn title="Completed" count={completed.length} orders={completed} type="completed" />
          <KanbanColumn title="Issues" count={error.length} orders={error} type="error" />
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ title, count, orders, type }: { title: string, count: number, orders: OrderColumn[], type: string }) {
  const getBadgeStyle = () => {
    switch (type) {
      case 'pending': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'progress': return 'bg-primary/10 text-primary border-primary/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'error': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="w-[320px] flex flex-col bg-muted/20 border border-border/30 rounded-3xl p-3">
      <div className="flex items-center justify-between px-2 py-3 mb-2">
        <h3 className="text-sm font-semibold text-foreground/80 tracking-wide">{title}</h3>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getBadgeStyle()}`}>
          {count}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 pb-2">
        <AnimatePresence>
          {orders.map((o) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group bg-card hover:bg-muted/40 border border-border/50 hover:border-border transition-all duration-300 rounded-2xl p-4 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-muted-foreground/70 bg-muted/50 px-2 py-1 rounded-md">
                    #{o.numericId}
                  </span>
                  <OrderEnvironmentBadge mode={o.resolvedEnvironmentMode || resolveOrderEnvironmentMode(o)} size="sm" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {new Date(o.createdAt).toLocaleDateString('ru')}
                </span>
              </div>
              <p className="text-sm font-medium leading-snug line-clamp-2 mb-3">
                {o.service?.name || 'Unknown Service'}
              </p>
              
              <div className="flex items-center justify-between text-xs mt-auto pt-3 border-t border-border/40">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-muted-foreground uppercase font-semibold">Quantity</span>
                  <span className="font-mono text-foreground/80">{o.quantity}</span>
                </div>
                <div className="flex flex-col gap-0.5 text-right">
                  <span className="text-[9px] text-muted-foreground uppercase font-semibold">Total</span>
                  <span className="font-mono text-foreground/80">{formatKopecks(BigInt(o.charge || 0))} ₽</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
