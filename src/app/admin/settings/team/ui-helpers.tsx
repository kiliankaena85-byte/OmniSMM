'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

export function SearchButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit" className="font-bold text-xs h-10 px-6 cursor-pointer">
      {pending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
      Найти
    </Button>
  );
}

export const getAllowedRoles = (adminRole?: string) => {
  const base = ['USER', 'SUPPORT', 'MANAGER', 'BANNED'];
  if (adminRole === 'OWNER') return [...base, 'ADMIN', 'OWNER'];
  return base;
};

export const ROLE_COLORS: Record<string, string> = {
  OWNER:   'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400',
  ADMIN:   'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400',
  MANAGER: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  SUPPORT: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  BANNED:  'bg-rose-500/10 text-rose-500 border-rose-500/20',
  USER:    'bg-muted/60 text-muted-foreground border-border',
};

export function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLORS[role] || ROLE_COLORS.USER;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${cls}`}>
      {role}
    </span>
  );
}

export function EmailAvatar({ email }: { email: string }) {
  const letter = email?.[0]?.toUpperCase() ?? '?';
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-black border border-primary/20 shrink-0">
      {letter}
    </span>
  );
}
