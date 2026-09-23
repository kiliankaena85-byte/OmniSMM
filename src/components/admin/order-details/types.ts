import { OrderEnvironmentMode } from '@/utils/order-environment';

export interface OrderModalColumn {
  id: string;
  numericId: number;
  externalId?: string | null;
  link?: string;
  quantity?: number;
  remains?: number;
  status: string;
  charge: number | string;
  providerCost?: number | string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  isDripFeed?: boolean;
  dripExternalIds?: string[];
  runs?: number | null;
  interval?: number | null;
  currentRun?: number;
  error?: string | null;
  user?: { email: string; id?: string };
  providerName?: string | null;
  tenantId?: string;
  environmentMode?: string;
  isTest?: boolean;
  payment?: {
    id?: string;
    gatewayId?: string | null;
    gateway?: string | null;
  } | null;
  resolvedEnvironmentMode?: OrderEnvironmentMode;
  service?: {
    name: string;
    isCancelEnabled?: boolean;
    category: {
      name: string;
      network: { name: string } | null;
    };
  };
}

export interface OrderDetailsModalProps {
  order: OrderModalColumn | null;
  isOpen?: boolean;
  onClose: () => void;
  canSeeRates?: boolean;
  userRole?: string;
  addOptimisticUpdate?: (update: { id: string; status: string; remains?: number }) => void;
  onSuccess?: () => void;
}

export interface FailoverRoute {
  routeId: string;
  providerName: string;
  priceUnknown?: boolean;
  newCostCents: number | null;
  marginCents: number | null;
  marginPercent: number | null;
  isMarginPositive: boolean;
}

export interface FailoverPreviewData {
  success: boolean;
  clientPaidCents: number;
  currentBalance: number;
  routes: FailoverRoute[];
}

export const STATUS_CONFIG: Record<string, { label: string; cls: string; borderCls: string }> = {
  AWAITING_PAYMENT: { label: 'Ожидает оплаты', cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400', borderCls: 'border-slate-500/30' },
  PENDING:          { label: 'В очереди',       cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', borderCls: 'border-amber-500/30' },
  IN_PROGRESS:      { label: 'В работе',        cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',       borderCls: 'border-sky-500/30' },
  COMPLETED:        { label: 'Выполнен',        cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', borderCls: 'border-emerald-500/30' },
  PARTIAL:          { label: 'Частично',        cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', borderCls: 'border-orange-500/30' },
  CANCELED:         { label: 'Отменён',         cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',     borderCls: 'border-rose-500/30' },
  ERROR:            { label: 'Ошибка',          cls: 'bg-red-500/10 text-red-600 dark:text-red-400',       borderCls: 'border-red-500/30' },
  REFUNDING:        { label: 'Возврат средств', cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', borderCls: 'border-violet-500/30' },
};

export function localizeProviderError(error: string | null): string | null {
  if (!error) return null;
  const errLower = error.toLowerCase();

  if (
    errLower.includes('fail-fast') ||
    errLower.includes('mock_') ||
    errLower.includes('.env') ||
    errLower.includes('err_internal_server') ||
    errLower.includes('configure it in')
  ) {
    return null;
  }

  if (errLower.includes('invalid link') || errLower.includes('bad link')) {
    return 'Неверная ссылка (профиль закрыт или неверный формат)';
  }
  if (errLower.includes('rate limit') || errLower.includes('too many requests')) {
    return 'Превышен лимит запросов у провайдера';
  }
  if (errLower.includes('not enough balance') || errLower.includes('low balance')) {
    return 'Недостаточный баланс у провайдера';
  }
  return error;
}

export function parseAmountRub(val: number | string | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') {
    return val > 1000 && Number.isInteger(val) ? val / 100 : val;
  }
  const str = String(val).replace(/,/g, '.').trim();
  const num = parseFloat(str);
  if (!Number.isFinite(num)) return 0;
  return num > 1000 && Number.isInteger(num) ? num / 100 : num;
}
