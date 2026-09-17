/**
 * Order Environment Mode Resolver & Configuration
 * Standardizes visual and behavioral distinction of orders across:
 * - SANDBOX: Песочница (100% Mock)
 * - HYBRID: Гибридный тест (Mock payment + Live provider)
 * - ACQUIRING_TEST: Тест эквайринга (Test payment gateway / acquiring)
 * - PRODUCTION: Боевой режим (Production)
 */

export type OrderEnvironmentMode = 'SANDBOX' | 'HYBRID' | 'ACQUIRING_TEST' | 'PRODUCTION';

export interface OrderEnvironmentMetadata {
  id: OrderEnvironmentMode;
  label: string;
  shortLabel: string;
  badgeClass: string;
  rowBorderClass: string;
  rowGlowClass: string;
  description: string;
}

export const ORDER_ENV_CONFIG: Record<OrderEnvironmentMode, OrderEnvironmentMetadata> = {
  SANDBOX: {
    id: 'SANDBOX',
    label: 'Песочница (100% Mock)',
    shortLabel: 'Песочница',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    rowBorderClass: 'border-l-4 border-l-emerald-500/80',
    rowGlowClass: 'hover:bg-emerald-500/5',
    description: 'Тестовый режим: виртуальная оплата (0 ₽) и виртуальный Mock SMM.',
  },
  HYBRID: {
    id: 'HYBRID',
    label: 'Гибридный тест (Live SMM)',
    shortLabel: 'Гибрид',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    rowBorderClass: 'border-l-4 border-l-amber-500/80',
    rowGlowClass: 'hover:bg-amber-500/5',
    description: 'Гибридный режим: тестовая оплата (0 ₽) и реальный заказ у провайдера.',
  },
  ACQUIRING_TEST: {
    id: 'ACQUIRING_TEST',
    label: 'Тест эквайринга',
    shortLabel: 'Тест эквайринга',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    rowBorderClass: 'border-l-4 border-l-blue-500/80',
    rowGlowClass: 'hover:bg-blue-500/5',
    description: 'Тестирование эквайринга: тестовый платежный шлюз без реального списания.',
  },
  PRODUCTION: {
    id: 'PRODUCTION',
    label: 'Боевой (Production)',
    shortLabel: 'Продакшн',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    rowBorderClass: 'border-l-4 border-l-purple-500/80',
    rowGlowClass: 'hover:bg-purple-500/5',
    description: 'Штатный боевой режим: реальные платежи клиентов и реальное исполнение.',
  },
};

export function normalizeEnvironmentMode(mode?: string | null): OrderEnvironmentMode | null {
  if (!mode) return null;
  const upper = mode.trim().toUpperCase();
  if (upper === 'SANDBOX' || upper === 'MOCK') return 'SANDBOX';
  if (upper === 'HYBRID') return 'HYBRID';
  if (upper === 'ACQUIRING_TEST') return 'ACQUIRING_TEST';
  if (upper === 'PRODUCTION') return 'PRODUCTION';
  return null;
}

/**
 * Resolves the operational environment mode of an order based on order flags and linked payment data.
 * Precedence hierarchy:
 * 1. Explicit ACQUIRING_TEST
 * 2. Explicit HYBRID mode
 * 3. Explicit SANDBOX or MOCK mode
 * 4. Legacy isTest flag without hybrid/acquiring indicators (resolves to SANDBOX)
 * 5. Payment Test Acquiring Signature Detection (mock_*, test_*, yoo_test_mock_*, robo_test_mock_*, crypto_test_mock_*, gateway: test/mock/sandbox)
 * 6. PRODUCTION (default)
 */
export function resolveOrderEnvironmentMode(order: {
  environmentMode?: string | null;
  isTest?: boolean | null;
  payment?: {
    gatewayId?: string | null;
    gateway?: string | null;
  } | null;
  paymentId?: string | null;
}): OrderEnvironmentMode {
  const rawMode = (order.environmentMode || '').toUpperCase().trim();

  // 1. Explicit ACQUIRING_TEST
  if (rawMode === 'ACQUIRING_TEST') {
    return 'ACQUIRING_TEST';
  }

  // 2. Explicit HYBRID
  if (rawMode === 'HYBRID') {
    return 'HYBRID';
  }

  // 3. Explicit SANDBOX or legacy MOCK
  if (rawMode === 'SANDBOX' || rawMode === 'MOCK') {
    return 'SANDBOX';
  }

  // 4. Legacy isTest flag without explicit hybrid/acquiring mode -> SANDBOX
  if (order.isTest) {
    return 'SANDBOX';
  }

  // 5. Payment Test Acquiring Signature Detection
  const gatewayId = (order.payment?.gatewayId || '').toLowerCase();
  const gateway = (order.payment?.gateway || '').toLowerCase();

  const isTestAcquiringGateway =
    gateway === 'test' ||
    gateway === 'mock' ||
    gateway === 'sandbox' ||
    gatewayId.startsWith('mock_') ||
    gatewayId.startsWith('test_') ||
    gatewayId.startsWith('yoo_test_mock_') ||
    gatewayId.startsWith('robo_test_mock_') ||
    gatewayId.startsWith('crypto_test_mock_');

  if (isTestAcquiringGateway) {
    return 'ACQUIRING_TEST';
  }

  // 6. Default to PRODUCTION
  return 'PRODUCTION';
}
