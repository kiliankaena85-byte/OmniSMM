import { StatusConfig } from '@/types/flux';

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  COMPLETED: {
    label: 'Завершён',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dotClass: 'bg-emerald-500',
  },
  IN_PROGRESS: {
    label: 'В процессе',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    dotClass: 'bg-blue-500',
  },
  PENDING: {
    label: 'В очереди',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dotClass: 'bg-amber-500',
  },
  PENDING_CHECK: {
    label: 'На проверке',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dotClass: 'bg-amber-500',
  },
  PROVISIONING: {
    label: 'Обработка',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    dotClass: 'bg-indigo-500',
  },
  AWAITING_PAYMENT: {
    label: 'Ожидает оплаты',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    dotClass: 'bg-slate-500',
  },
  PARTIAL: {
    label: 'Частично выполнен',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    dotClass: 'bg-purple-500',
  },
  CANCELING: {
    label: 'Отменяется',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dotClass: 'bg-amber-500',
  },
  CANCELED: {
    label: 'Отменён',
    badgeClass: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    dotClass: 'bg-slate-400',
  },
  ERROR: {
    label: 'Ошибка',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    dotClass: 'bg-rose-500',
  },
};

export function getStatusConfig(status: string): StatusConfig {
  const normalized = status.toUpperCase();
  return (
    STATUS_CONFIG[normalized] || {
      label: status,
      badgeClass: 'bg-muted text-muted-foreground border-border/40',
      dotClass: 'bg-muted-foreground',
    }
  );
}

export function getStatusLabel(status: string): string {
  return getStatusConfig(status).label;
}

export function getStatusBadgeClass(status: string): string {
  return getStatusConfig(status).badgeClass;
}
