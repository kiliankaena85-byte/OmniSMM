'use client';

import type { Message } from '../useChatMessages';
import type { ChatInputOrder } from '../ChatInput';

interface ChatAttachedOrderCardProps {
  order: NonNullable<Message['order']>;
  sender: string;
  isStaff: boolean;
  onSelectOrder?: (order: ChatInputOrder) => void;
}

export function ChatAttachedOrderCard({
  order,
  sender,
  isStaff,
  onSelectOrder,
}: ChatAttachedOrderCardProps) {
  return (
    <div
      className={`mb-3 rounded-xl p-3 flex flex-col gap-2 max-w-sm border-0 shadow-xs transition-all duration-200 ${
        sender === 'USER'
          ? 'bg-default-100 text-foreground'
          : sender === 'INTERNAL'
          ? 'bg-warning/10 text-warning-text'
          : 'bg-info/10 text-foreground'
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${
            sender === 'USER'
              ? 'bg-primary/10 text-primary'
              : sender === 'INTERNAL'
              ? 'bg-warning/25 text-warning-text'
              : 'bg-secondary-foreground/10 text-secondary-foreground'
          }`}
        >
          📦
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-black text-[11px] leading-none">
              Заказ #{order.numericId}
            </span>
            <span
              className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                order.status === 'COMPLETED'
                  ? 'bg-success/15 text-success-text'
                  : order.status === 'IN_PROGRESS'
                  ? 'bg-primary/15 text-primary'
                  : order.status === 'PENDING'
                  ? 'bg-warning/15 text-warning-text'
                  : order.status === 'AWAITING_PAYMENT'
                  ? 'bg-warning/15 text-warning-text'
                  : 'bg-default-200/50 text-muted-foreground'
              }`}
            >
              {order.status === 'COMPLETED'
                ? 'Выполнен'
                : order.status === 'IN_PROGRESS'
                ? 'Выполняется'
                : order.status === 'PENDING'
                ? 'В очереди'
                : order.status === 'AWAITING_PAYMENT'
                ? 'Ожидает оплаты'
                : order.status}
            </span>
          </div>
          <p className="text-[10px] opacity-80 mt-1 truncate leading-tight font-medium">
            {order.serviceName}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-dashed border-current/10 pt-2.5 mt-1.5 gap-4">
        <div className="text-xs font-bold opacity-90 leading-none">
          {(Number(order.charge) / 100).toFixed(2)} ₽
        </div>

        {isStaff && onSelectOrder ? (
          <button
            type="button"
            onClick={() => {
              onSelectOrder(order as unknown as ChatInputOrder);
            }}
            className={`text-[11px] font-black px-3 h-11 rounded-xl transition-all duration-200 flex items-center justify-center gap-0.5 shadow-xs cursor-pointer hover:scale-[1.02] active:scale-[0.98] border-0 ${
              sender === 'USER'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : sender === 'INTERNAL'
                ? 'bg-warning-text text-primary-foreground hover:bg-warning-text/90'
                : 'bg-card text-foreground hover:bg-card/90'
            }`}
          >
            Перейти к заказу ➔
          </button>
        ) : isStaff ? (
          <a
            href={`/admin/orders?edit_order_id=${order.id}`}
            className={`text-[11px] font-black px-3 h-11 rounded-xl transition-all duration-200 flex items-center justify-center gap-0.5 shadow-xs hover:scale-[1.02] active:scale-[0.98] border-0 ${
              sender === 'USER'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : sender === 'INTERNAL'
                ? 'bg-warning-text text-primary-foreground hover:bg-warning-text/90'
                : 'bg-card text-foreground hover:bg-card/90'
            }`}
          >
            Перейти к заказу ➔
          </a>
        ) : (
          <a
            href={`/dashboard/orders/${order.id}`}
            className={`text-[11px] font-black px-3 h-11 rounded-xl transition-all duration-200 flex items-center justify-center gap-0.5 shadow-xs hover:scale-[1.02] active:scale-[0.98] border-0 ${
              sender === 'USER'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-card text-foreground hover:bg-card/90'
            }`}
          >
            Перейти к заказу ➔
          </a>
        )}
      </div>
    </div>
  );
}
