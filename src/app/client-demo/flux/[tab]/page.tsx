import React from 'react';
import { SmmFluxFullApp, FluxTab } from '../../components/flux-views';

type Props = {
  params: Promise<{ tab: string }>;
};

const VALID_TABS: FluxTab[] = ['dashboard', 'orders', 'new-order', 'transactions', 'deposit', 'referrals', 'support', 'settings'];

export async function generateMetadata({ params }: Props) {
  const { tab } = await params;
  const tabTitles: Record<string, string> = {
    'orders': 'Мои заказы',
    'new-order': 'Создать заказ',
    'transactions': 'История транзакций',
    'deposit': 'Пополнение баланса',
    'referrals': 'Рефералы',
    'support': 'Поддержка',
    'settings': 'Настройки',
  };

  return {
    title: `SMMflux — ${tabTitles[tab] || 'Личный кабинет'}`,
  };
}

export default async function SmmFluxTabPage({ params }: Props) {
  const { tab } = await params;
  const initialTab = (VALID_TABS.includes(tab as FluxTab) ? tab : 'dashboard') as FluxTab;
  return <SmmFluxFullApp initialTab={initialTab} />;
}
