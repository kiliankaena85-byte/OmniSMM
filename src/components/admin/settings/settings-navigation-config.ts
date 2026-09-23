import * as React from 'react';
import { 
  Store, 
  CreditCard, 
  ShieldCheck, 
  Settings, 
  Database, 
  Link as LinkIcon, 
  Bot, 
  Server, 
  Users, 
  MessageSquare, 
  History,
  KeyRound 
} from 'lucide-react';

export type SettingsMasterCluster = 'showcase' | 'integrations' | 'security';

export interface SettingsSubTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export interface SettingsClusterConfig {
  id: SettingsMasterCluster;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  subTabs: SettingsSubTab[];
}

export const SETTINGS_CLUSTERS: SettingsClusterConfig[] = [
  {
    id: 'showcase',
    label: 'Магазин и Каталог',
    icon: Store,
    description: 'Брендинг, витрина, правила наценок и курс ЦБ РФ',
    subTabs: [
      { id: 'system', label: 'Бренд и Витрина', icon: Settings, description: 'Название, логотип, режим техработ, 152-ФЗ' },
      { id: 'catalog', label: 'Каталог и Цены', icon: Database, description: 'Наценки, курс ЦБ РФ, карантин цен' },
    ],
  },
  {
    id: 'integrations',
    label: 'Платежи и Каналы',
    icon: CreditCard,
    description: 'Эквайринг (ЮKassa/Robo/Crypto), Telegram и прокси',
    subTabs: [
      { id: 'integrations', label: 'Кассы и Шлюзы', icon: LinkIcon, description: 'ЮKassa, Robokassa, CryptoBot, Gemini AI, Email' },
      { id: 'telegram', label: 'Telegram Бот', icon: Bot, description: 'Токен, вебхуки, авто-ответчик, рассылки' },
      { id: 'proxy', label: 'Прокси провайдеров', icon: Server, description: 'SOCKS5/HTTP прокси и ротация' },
      { id: 'storefront', label: 'Ключи витрин (API)', icon: KeyRound, description: 'Ключи Storefront API v1 для внешних витрин и инвесторов' },
    ],
  },
  {
    id: 'security',
    label: 'Команда и Доступ',
    icon: ShieldCheck,
    description: 'Сотрудники, роли RBAC, шаблоны и журнал аудита',
    subTabs: [
      { id: 'team', label: 'Команда и RBAC', icon: Users, description: 'Сотрудники, роли, лимиты саппорта' },
      { id: 'templates', label: 'Шаблоны ответов', icon: MessageSquare, description: 'Быстрые ответы и шорткаты саппорта' },
      { id: 'audit', label: 'Журнал аудита', icon: History, description: 'Неизменяемый лог действий персонала' },
    ],
  },
];

/**
 * 🛡️ Helper: Resolves which master cluster and sub-tab should be active.
 * Guarantees 100% backwards compatibility with legacy `?tab=proxy`, `?tab=team`, etc.
 */
export function resolveSettingsNavigation(rawTab?: string | null): {
  activeCluster: SettingsMasterCluster;
  activeSubTab: string;
} {
  const tab = (rawTab || 'system').toLowerCase();

  for (const cluster of SETTINGS_CLUSTERS) {
    const matchingSubTab = cluster.subTabs.find(st => st.id === tab);
    if (matchingSubTab) {
      return {
        activeCluster: cluster.id,
        activeSubTab: matchingSubTab.id,
      };
    }
  }

  // Fallback defaults
  return {
    activeCluster: 'showcase',
    activeSubTab: 'system',
  };
}
