'use client';

import { useState, useEffect, useCallback } from 'react';
import { refreshBalanceAction } from '@/actions/auth/refresh-balance';
import { formatBalance } from '@/lib/utils';
import { toast } from 'sonner';

export interface BalanceUpdatedDetail {
  balanceRub?: string;
  balanceCents?: number;
  source?: string;
}

const BALANCE_EVENT_NAME = 'smmplan:balance_updated';

/**
 * Dispatches a global balance update event across all client components.
 */
export function dispatchBalanceUpdate(detail: BalanceUpdatedDetail) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(BALANCE_EVENT_NAME, { detail }));
  } catch (e) {
    console.error('[useUserBalance] Failed to dispatch event:', e);
  }
}

/**
 * Unified hook for user balance synchronization across Sidebar, Header, Dashboard Home, and Modals.
 */
export function useUserBalance(initialBalance?: string | number | bigint) {
  const parseInitial = (): string => {
    if (typeof initialBalance === 'string') return initialBalance;
    if (typeof initialBalance === 'number' || typeof initialBalance === 'bigint') {
      return formatBalance(initialBalance);
    }
    return '0.00 ₽';
  };

  const [balance, setBalance] = useState<string>(parseInitial);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync state if initial prop changes
  useEffect(() => {
    if (initialBalance !== undefined) {
      setBalance(parseInitial());
    }
  }, [initialBalance]);

  // Global event listener for instant cross-component synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleEvent = (event: Event) => {
      const customEvent = event as CustomEvent<BalanceUpdatedDetail>;
      if (customEvent.detail?.balanceRub) {
        setBalance(customEvent.detail.balanceRub);
      }
    };

    window.addEventListener(BALANCE_EVENT_NAME, handleEvent);
    return () => {
      window.removeEventListener(BALANCE_EVENT_NAME, handleEvent);
    };
  }, []);

  // Trigger server action to fetch latest ledger-backed balance
  const refreshBalance = useCallback(async (isSilent = true) => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await refreshBalanceAction();
      if (res.success && res.balanceRub) {
        setBalance(res.balanceRub);
        dispatchBalanceUpdate({ balanceRub: res.balanceRub, source: 'refreshBalance' });
        if (!isSilent) {
          toast.success('Баланс успешно обновлен!');
        }
      } else if (!isSilent) {
        toast.error(res.error || 'Не удалось обновить баланс');
      }
    } catch (e) {
      console.error('[useUserBalance] Error refreshing balance:', e);
      if (!isSilent) {
        toast.error('Произошла ошибка при обновлении баланса');
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Window focus & visibility change listener to keep balance fresh
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshBalance(true);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [refreshBalance]);

  return {
    balance,
    isRefreshing,
    refreshBalance,
    setBalance: (newBalanceRub: string) => {
      setBalance(newBalanceRub);
      dispatchBalanceUpdate({ balanceRub: newBalanceRub, source: 'manualSet' });
    },
  };
}
