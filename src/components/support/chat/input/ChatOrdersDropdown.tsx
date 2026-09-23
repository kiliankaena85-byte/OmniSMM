'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { ChatInputOrder } from '../ChatInput';

interface ChatOrdersDropdownProps {
  show: boolean;
  orders: ChatInputOrder[];
  onSelectOrder: (order: ChatInputOrder) => void;
  onToggle: () => void;
}

export function ChatOrdersDropdown({
  show,
  orders,
  onSelectOrder,
  onToggle,
}: ChatOrdersDropdownProps) {
  if (!orders || orders.length === 0) return null;

  return (
    <div className="relative shrink-0 flex">
      <button 
        type="button"
        onClick={onToggle}
        className={`h-9 px-2.5 border text-xs transition-all flex items-center justify-center gap-1.5 rounded-lg font-medium cursor-pointer shadow-xs ${
          show 
            ? 'bg-primary/10 border-primary/30 text-primary shadow-inner' 
            : 'bg-background/80 border-border text-muted-foreground hover:bg-background hover:text-foreground'
        }`}
        title="Прикрепить заказ"
        aria-label="Прикрепить заказ"
      >
        <span className="text-sm">📦</span>
        <span className="hidden sm:inline text-[11px]">Заказ</span>
      </button>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-11 left-0 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden py-2"
          >
            <div className="px-3 py-1.5 border-b border-divider text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Выберите заказ для привязки:
            </div>
            <div className="max-h-60 overflow-y-auto">
              {orders.map((order: ChatInputOrder) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => onSelectOrder(order)}
                  className="w-full text-left px-3 py-2 hover:bg-default-50 flex flex-col gap-0.5 border-b border-divider last:border-0 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">Заказ #{order.numericId || order.id.slice(0, 8)}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      order.status === 'COMPLETED' ? 'bg-success/15 text-success-text' :
                      order.status === 'IN_PROGRESS' ? 'bg-primary/15 text-primary' :
                      order.status === 'PENDING' ? 'bg-warning/15 text-warning-text' :
                      'bg-default-200/50 text-muted-foreground'
                    }`}>
                      {order.status === 'COMPLETED' ? 'Выполнен' :
                       order.status === 'IN_PROGRESS' ? 'В процессе' :
                       order.status === 'PENDING' ? 'Ожидание' : order.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate w-full">{order.serviceName}</span>
                  <span className="text-[10px] font-medium text-foreground opacity-80">{order.charge} ₽</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
