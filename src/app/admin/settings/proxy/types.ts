import type { ProxyProtocol, ProxyCategory } from '@/types/provider-proxy';

export interface FormData {
  label: string;
  description: string;
  protocol: ProxyProtocol;
  category: ProxyCategory;
  host: string;
  port: string;
  username: string;
  password: string;
  isRotating: boolean;
  geoCountry: string;
  tags: string[];
  subscriptionUrl: string;
  expiresAt?: string;
}

export const EMPTY_FORM: FormData = {
  label: '',
  description: '',
  protocol: 'socks5',
  category: 'PAID_PREMIUM',
  host: '',
  port: '7891',
  username: '',
  password: '',
  isRotating: false,
  geoCountry: '',
  tags: [],
  subscriptionUrl: '',
  expiresAt: '',
};

export interface SubFormData {
  subscriptionUrl: string;
  label: string;
  category: ProxyCategory;
  protocol: ProxyProtocol;
  inboundHost: string;
  inboundPort: string;
  autoAssignToProviders: boolean;
}

export interface RawFormData {
  rawListText: string;
  category: ProxyCategory;
  defaultProtocol: ProxyProtocol;
  tag: string;
}

export function formatTraffic(bytes: bigint | null | undefined): string {
  if (!bytes || bytes === BigInt(0)) return '0 GB';
  const gb = Number(bytes) / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

export function getDaysLeft(expiresAt: Date | null | undefined): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
