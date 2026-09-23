import React from 'react';

interface OrderProgressBarProps {
  status: string;
  quantity: number;
  remains: number;
}

export function OrderProgressBar({ status, quantity, remains }: OrderProgressBarProps) {
  if (status === 'AWAITING_PAYMENT') return null;
  if (status === 'IN_PROGRESS' && remains == null) return null;

  const safeQuantity = quantity > 0 ? quantity : 1;
  let delivered = quantity - remains;
  if (delivered < 0) delivered = 0;
  if (delivered > quantity) delivered = quantity;
  
  let percent = Math.round((delivered / safeQuantity) * 100);
  percent = Math.min(100, Math.max(0, percent));

  let label: string;
  let barColor: string;
  let isIndeterminate = false;

  switch (status) {
    case 'PENDING':
    case 'PROVISIONING':
      percent = 100;
      isIndeterminate = true;
      label = 'Ожидание запуска';
      barColor = 'bg-primary/50';
      break;
    case 'IN_PROGRESS':
      if (percent === 100) {
        label = `Завершение (доставлено ${quantity.toLocaleString('ru-RU')})`;
        isIndeterminate = true;
      } else if (percent === 0) {
        label = `Начинаем работу (выполнено 0 из ${quantity.toLocaleString('ru-RU')})`;
        isIndeterminate = true;
      } else {
        label = `В работе (выполнено ${delivered.toLocaleString('ru-RU')} из ${quantity.toLocaleString('ru-RU')})`;
      }
      barColor = 'bg-blue-500';
      break;
    case 'PARTIAL':
      label = `Выполнено частично: ${delivered.toLocaleString('ru-RU')} из ${quantity.toLocaleString('ru-RU')}`;
      barColor = 'bg-warning';
      break;
    case 'COMPLETED':
      percent = 100;
      label = 'Выполнено полностью';
      barColor = 'bg-success';
      break;
    case 'CANCELED':
      label = quantity > 0 && delivered > 0
        ? `Отменено (выполнено ${delivered.toLocaleString('ru-RU')} из ${quantity.toLocaleString('ru-RU')})`
        : 'Отменено';
      barColor = 'bg-muted-foreground';
      break;
    case 'ERROR':
      label = quantity > 0 && delivered > 0
        ? `Ошибка выполнения (выполнено ${delivered.toLocaleString('ru-RU')} из ${quantity.toLocaleString('ru-RU')})`
        : 'Ошибка выполнения';
      barColor = 'bg-muted-foreground';
      break;
    default:
      label = `Выполнено ${delivered.toLocaleString('ru-RU')} из ${quantity.toLocaleString('ru-RU')}`;
      barColor = 'bg-primary';
      break;
  }

  return (
    <div className="px-5 py-4 border-b border-border bg-card/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {!isIndeterminate && (
          <span className="text-sm font-bold text-muted-foreground tabular-nums">{percent}%</span>
        )}
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor} ${isIndeterminate ? 'animate-pulse' : ''}`}
          style={{ width: isIndeterminate ? '100%' : `${percent}%` }}
        />
      </div>
    </div>
  );
}
