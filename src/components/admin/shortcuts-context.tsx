'use client';

import { createContext, useContext } from 'react';

export interface HotkeyConfig {
  id: string;
  keys: string[];
  label: string;
  path?: string;
  actionId?: string;
  category: 'Навигация' | 'Заказы' | 'Каталог' | 'Система';
}

export const DEFAULT_HOTKEYS: HotkeyConfig[] = [
  { id: 'go_orders', keys: ['g', 'o'], label: 'Перейти в Заказы', path: '/admin/orders', category: 'Навигация' },
  { id: 'go_providers', keys: ['g', 'p'], label: 'Перейти к Провайдерам', path: '/admin/providers', category: 'Навигация' },
  { id: 'go_tickets', keys: ['g', 't'], label: 'Перейти в Тикеты', path: '/admin/tickets', category: 'Навигация' },
  { id: 'go_staff', keys: ['g', 's'], label: 'Перейти к Сотрудникам', path: '/admin/staff', category: 'Навигация' },
  { id: 'go_clients', keys: ['g', 'c'], label: 'Перейти к Клиентам', path: '/admin/clients', category: 'Навигация' },
  { id: 'go_catalog', keys: ['g', 'k'], label: 'Перейти в Каталог', path: '/admin/catalog', category: 'Навигация' },
  { id: 'go_finance', keys: ['g', 'f'], label: 'Перейти в Биллинг', path: '/admin/finance', category: 'Навигация' },
  { id: 'go_settings', keys: ['g', 'e'], label: 'Перейти в Настройки', path: '/admin/settings', category: 'Навигация' },
  { id: 'open_search', keys: ['/'], label: 'Фокус в строку поиска таблицы', actionId: 'focus_search', category: 'Навигация' },
  { id: 'help_modal', keys: ['?'], label: 'Справка по горячим клавишам', actionId: 'toggle_help', category: 'Система' },
];

export interface ShortcutsContextType {
  hotkeysEnabled: boolean;
  setHotkeysEnabled: (val: boolean) => void;
  hotkeys: HotkeyConfig[];
  updateHotkey: (id: string, newKeys: string[]) => void;
  resetHotkeys: () => void;
  isHelpOpen: boolean;
  setIsHelpOpen: (val: boolean) => void;
}

export const ShortcutsContext = createContext<ShortcutsContextType | undefined>(undefined);

export function useShortcuts() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) {
    throw new Error('useShortcuts must be used within ShortcutsProvider');
  }
  return ctx;
}
