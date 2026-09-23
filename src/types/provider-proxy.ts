// ==============================================================
// Provider Proxy Types
// Enterprise proxy management for upstream SMM provider connections
// ==============================================================

export type ProxyProtocol = 'http' | 'https' | 'socks5';
export type ProxyCategory = 'PAID_PREMIUM' | 'FREE_PUBLIC' | 'BACKUP_RESERVE';

export interface SubscriptionInfo {
  uploadBytes: bigint;
  downloadBytes: bigint;
  totalBytes: bigint;
  expiresAt: Date | null;
  daysLeft: number | null;
  rawHeader?: string;
}

export interface ProviderProxy {
  id: string;
  label: string;
  description: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string | null;
  passwordEncrypted?: string | null;
  isActive: boolean;
  isRotating: boolean;
  geoCountry?: string | null;
  tags: string[];
  category: ProxyCategory;
  subscriptionUrl?: string | null;
  expiresAt?: Date | null;
  trafficUsedBytes?: bigint | null;
  trafficTotalBytes?: bigint | null;
  lastSyncAt?: Date | null;
  lastTestAt?: Date | null;
  lastTestLatencyMs?: number | null;
  lastTestSuccess?: boolean | null;
  errorCount: number;
  lastErrorAt?: Date | null;
  consecutiveFailures: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderProxyWithUsage extends ProviderProxy {
  _count?: {
    providers: number;
    logs: number;
  };
}

export interface ProxyTestResult {
  success: boolean;
  latencyMs?: number;
  statusCode?: number;
  error?: string;
  testedAt: string;
  resolvedIp?: string;
}

export interface ProxyConnectionLog {
  id: string;
  proxyId: string;
  providerId?: string | null;
  action: string;
  url?: string | null;
  method?: string | null;
  statusCode?: number | null;
  latencyMs?: number | null;
  error?: string | null;
  bytesSent: number;
  bytesReceived: number;
  createdAt: Date;
}

export interface ProxyConfig {
  id?: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
  lastTestLatencyMs?: number | null;
  category?: ProxyCategory;
  isActive?: boolean;
}

export interface ProxyHealthSummary {
  total: number;
  active: number;
  withErrors: number;
  avgLatencyMs: number | null;
  providersUsingProxy: number;
  providersDirect: number;
}

export const GEO_OPTIONS = [
  { value: 'RU', label: 'Россия' },
  { value: 'NL', label: 'Нидерланды' },
  { value: 'DE', label: 'Германия' },
  { value: 'FI', label: 'Финляндия' },
  { value: 'US', label: 'США' },
  { value: 'KZ', label: 'Казахстан' },
  { value: 'PL', label: 'Польша' },
  { value: 'CZ', label: 'Чехия' },
] as const;

export const PROXY_PROTOCOL_LABELS: Record<ProxyProtocol, string> = {
  http: 'HTTP',
  https: 'HTTPS',
  socks5: 'SOCKS5',
};

// ==============================================================
// Clash Verge-Style Universal Network Routing Types
// ==============================================================

export type RoutingRuleType = 'DOMAIN' | 'DOMAIN-SUFFIX' | 'DOMAIN-KEYWORD' | 'SERVICE' | 'FINAL';

export type RoutingTargetType =
  | 'DIRECT'            // Прямое соединение без прокси
  | 'REJECT'            // Блокировка исходящего запроса
  | 'SYSTEM_PROXY'      // Локальный системный VPN/туннель
  | 'PROXY_POOL'        // Автовыбор здорового прокси из пула
  | 'RU_SOVEREIGN_POOL' // Автовыбор из пула проверенных нод РФ (суверенный резерв для зарубежных серверов)
  | 'SPECIFIC_PROXY';   // Конкретный прокси по ID

export type SubsystemServiceType =
  | 'AI_GEMINI'
  | 'PROVIDERS'
  | 'CATALOG_SYNC'
  | 'PAYMENTS_RU'
  | 'PAYMENTS_CRYPTO'
  | 'TELEGRAM'
  | 'CBR_RATES'
  | 'OTHER';

export interface RoutingRule {
  id: string;
  type: RoutingRuleType;
  payload: string; // 'googleapis.com', 'yookassa.ru', 'AI_GEMINI', etc.
  target: RoutingTargetType;
  targetProxyId?: string | null; // ID из таблицы ProviderProxy при SPECIFIC_PROXY
  comment?: string;
  isEnabled: boolean;
  priority: number; // 0 = наивысший (First Match Win)
}

export interface ServiceTogglesConfig {
  aiGemini: RoutingTargetType;
  aiGeminiProxyId?: string | null;
  providers: RoutingTargetType;
  providersProxyId?: string | null;
  catalogSync: RoutingTargetType;
  catalogSyncProxyId?: string | null;
  paymentsRu: 'DIRECT' | 'RU_SOVEREIGN_POOL'; // Напрямую или через суверенный резерв РФ
  paymentsRuProxyId?: string | null;
  paymentsCrypto: RoutingTargetType;
  paymentsCryptoProxyId?: string | null;
  telegram: RoutingTargetType;
  telegramProxyId?: string | null;
}

export interface NetworkRoutingConfig {
  serviceToggles: ServiceTogglesConfig;
  rules: RoutingRule[];
  systemProxyUrl?: string | null; // e.g. http://127.0.0.1:7897
}
