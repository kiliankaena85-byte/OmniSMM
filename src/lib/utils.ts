import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number | undefined | null, decimals: number = 2): string {
  if (!cents) return decimals === 0 ? "0" : (0).toFixed(decimals);
  return (Math.round(cents) / 100).toFixed(decimals);
}

export function formatBalance(balanceCents: bigint | number | undefined | null): string {
  if (balanceCents === undefined || balanceCents === null) return '0.00 ₽';
  const raw = typeof balanceCents === 'bigint' ? Number(balanceCents) : Number(balanceCents);
  const cents = isNaN(raw) ? 0 : Math.max(0, Math.floor(raw));
  
  const rubles = Math.floor(cents / 100);
  const remainder = cents % 100;
  
  return `${rubles.toLocaleString('ru-RU')}.${String(remainder).padStart(2, '0')} ₽`;
}
