'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  ListOrdered,
  Wallet,
  Users,
  MessageSquare,
  Settings,
  UserCircle,
  Receipt,
  Cpu,
  Search,
  ExternalLink,
  Globe
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command';
import { SocialIcon } from '@/components/ui/SocialIcon';

const PLATFORMS = [
  { slug: 'telegram', name: 'Telegram', label: 'Подписчики, Просмотры, Реакции' },
  { slug: 'vk', name: 'ВКонтакте (VK)', label: 'Подписчики, Лайки, Охваты' },
  { slug: 'instagram', name: 'Instagram', label: 'Фолловеры, Лайки, Reels' },
  { slug: 'youtube', name: 'YouTube', label: 'Просмотры, Shorts, Лайки' },
  { slug: 'tiktok', name: 'TikTok', label: 'Просмотры, Подписчики' },
  { slug: 'twitch', name: 'Twitch', label: 'Зрители на стрим, Фолловеры' },
  { slug: 'discord', name: 'Discord', label: 'Участники сервера' },
  { slug: 'rutube', name: 'Rutube', label: 'Просмотры, Подписчики' },
];

export function UserCommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'л') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/60 hover:bg-secondary border border-border/60 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all duration-200 group cursor-pointer"
        aria-label="Поиск и быстрые команды (Ctrl+K)"
      >
        <span className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span>Быстрый поиск...</span>
        </span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-bold text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Поиск по кабинету, платформам и услугам..." />
        <CommandList className="max-h-[380px] overflow-y-auto">
          <CommandEmpty>Ничего не найдено.</CommandEmpty>
          
          <CommandGroup heading="Навигация">
            <CommandItem onSelect={() => handleSelect('/')}>
              <Globe className="mr-2 h-4 w-4 text-emerald-500" />
              <span>На главную (Витрина услуг)</span>
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect('/dashboard')}>
              <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
              <span>Дашборд кабинета</span>
              <CommandShortcut>⌘D</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect('/dashboard/new-order')}>
              <ShoppingCart className="mr-2 h-4 w-4 text-primary" />
              <span>Создать новый заказ</span>
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect('/dashboard/orders')}>
              <ListOrdered className="mr-2 h-4 w-4 text-sky-500" />
              <span>Мои заказы</span>
              <CommandShortcut>⌘O</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect('/dashboard/add-funds')}>
              <Wallet className="mr-2 h-4 w-4 text-emerald-500" />
              <span>Пополнить баланс</span>
              <CommandShortcut>⌘B</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect('/dashboard/transactions')}>
              <Receipt className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>История транзакций</span>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect('/dashboard/tickets')}>
              <MessageSquare className="mr-2 h-4 w-4 text-amber-500" />
              <span>Служба поддержки</span>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect('/dashboard/referrals')}>
              <Users className="mr-2 h-4 w-4 text-purple-500" />
              <span>Реферальная программа</span>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect('/dashboard/settings')}>
              <UserCircle className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Настройки профиля</span>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect('/dashboard/settings/api')}>
              <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>API разработчика</span>
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Платформы и Соцсети">
            {PLATFORMS.map((p) => (
              <CommandItem
                key={p.slug}
                onSelect={() => handleSelect(`/dashboard/new-order?network=${p.slug}`)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-secondary/80 flex items-center justify-center p-0.5">
                    <SocialIcon slug={p.slug} className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold">{p.name}</span>
                  <span className="text-[11px] text-muted-foreground font-normal">({p.label})</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
