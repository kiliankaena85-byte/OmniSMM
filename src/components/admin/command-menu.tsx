'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Home,
  Users,
  Package,
  ShoppingCart,
  Settings,
  CreditCard,
  MessageSquare,
  Link as LinkIcon,
  Search,
  Gift,
  RefreshCw,
  AlertTriangle,
  ArrowLeftRight,
  TrendingUp,
  Inbox,
  Shield,
  Cpu,
  Globe,
  FileText,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  section?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export function CommandMenu({ navigation }: { navigation?: NavGroup[] }) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    setMounted(true);
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false);
      command();
    },
    []
  );

  const allowedHrefs = React.useMemo(() => {
    if (!navigation) return null; // If not provided, allow all
    const hrefs = new Set<string>();
    navigation.forEach((g) => g.items.forEach((item) => {
      const [clean] = item.href.split('?');
      hrefs.add(clean);
    }));
    return hrefs;
  }, [navigation]);

  const isHrefAllowed = React.useCallback((href: string) => {
    if (!allowedHrefs) return true;
    const [clean] = href.split('?');
    // Check exact or prefix match
    return allowedHrefs.has(clean) || Array.from(allowedHrefs).some((allowed) => clean.startsWith(allowed + '/'));
  }, [allowedHrefs]);

  return (
    <>
      <Button
        intent="outline"
        className="relative h-9 w-full justify-start rounded-[var(--radius,10px)] bg-muted/60 text-sm text-muted-foreground sm:pr-12 hover:bg-muted/80 hover:text-foreground border-border/80 flex mb-4"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="inline-flex">Поиск...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border border-border/80 bg-card px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {mounted && (
        <CommandDialog open={open} onOpenChange={setOpen}>
          <CommandInput placeholder="Поиск по разделам и модулям (Cmd+K)..." />
          <CommandList className="max-h-[380px] overflow-y-auto">
            <CommandEmpty>Нет результатов.</CommandEmpty>
            
            {/* ── Операционка ── */}
            {(isHrefAllowed('/admin/dashboard') || isHrefAllowed('/admin/orders') || isHrefAllowed('/admin/refills') || isHrefAllowed('/admin/tickets') || isHrefAllowed('/admin/clients')) && (
              <CommandGroup heading="Операционка">
                {isHrefAllowed('/admin/dashboard') && (
                  <CommandItem onSelect={() => runCommand(() => router.push('/admin/dashboard'))}>
                    <Home className="mr-2 h-4 w-4 text-primary" />
                    <span>Дашборд</span>
                  </CommandItem>
                )}
                {isHrefAllowed('/admin/orders') && (
                  <CommandItem onSelect={() => runCommand(() => router.push('/admin/orders'))}>
                    <Package className="mr-2 h-4 w-4 text-primary" />
                    <span>Заказы</span>
                  </CommandItem>
                )}
                {isHrefAllowed('/admin/refills') && (
                  <CommandItem onSelect={() => runCommand(() => router.push('/admin/refills'))}>
                    <RefreshCw className="mr-2 h-4 w-4 text-primary" />
                    <span>Докрутки (Refills)</span>
                  </CommandItem>
                )}
                {isHrefAllowed('/admin/tickets') && (
                  <CommandItem onSelect={() => runCommand(() => router.push('/admin/tickets'))}>
                    <MessageSquare className="mr-2 h-4 w-4 text-primary" />
                    <span>Тикеты и чаты</span>
                  </CommandItem>
                )}
                {isHrefAllowed('/admin/clients') && (
                  <CommandItem onSelect={() => runCommand(() => router.push('/admin/clients'))}>
                    <Users className="mr-2 h-4 w-4 text-primary" />
                    <span>Клиенты и пользователи</span>
                  </CommandItem>
                )}
              </CommandGroup>
            )}
            
            <CommandSeparator />
            
            {/* ── Финансы и Аналитика ── */}
            {(isHrefAllowed('/admin/finance') || isHrefAllowed('/admin/analytics') || isHrefAllowed('/admin/finance/balance-requests') || isHrefAllowed('/admin/marketing')) && (
              <CommandGroup heading="Финансы и Аналитика">
                {isHrefAllowed('/admin/finance') && (
                  <CommandItem onSelect={() => runCommand(() => router.push('/admin/finance'))}>
                    <CreditCard className="mr-2 h-4 w-4 text-success" />
                    <span>Биллинг и касса</span>
                  </CommandItem>
                )}
                {isHrefAllowed('/admin/analytics') && (
                  <CommandItem onSelect={() => runCommand(() => router.push('/admin/analytics'))}>
                    <TrendingUp className="mr-2 h-4 w-4 text-success" />
                    <span>Финансовая аналитика</span>
                  </CommandItem>
                )}
                {isHrefAllowed('/admin/finance/balance-requests') && (
                  <CommandItem onSelect={() => runCommand(() => router.push('/admin/finance/balance-requests'))}>
                    <Inbox className="mr-2 h-4 w-4 text-success" />
                    <span>Заявки на изменение баланса</span>
                  </CommandItem>
                )}
                {isHrefAllowed('/admin/marketing') && (
                  <CommandItem onSelect={() => runCommand(() => router.push('/admin/marketing'))}>
                    <Gift className="mr-2 h-4 w-4 text-violet-500" />
                    <span>Маркетинг и промокоды</span>
                  </CommandItem>
                )}
              </CommandGroup>
            )}

            <CommandSeparator />

            {/* ── Каталог и Провайдеры ── */}
            {(isHrefAllowed('/admin/catalog') || isHrefAllowed('/admin/providers') || isHrefAllowed('/admin/pages')) && (
              <CommandGroup heading="Каталог и Провайдеры">
                {isHrefAllowed('/admin/catalog') && (
                  <>
                    <CommandItem onSelect={() => runCommand(() => router.push('/admin/catalog'))}>
                      <ShoppingCart className="mr-2 h-4 w-4 text-amber-500" />
                      <span>Каталог услуг</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/admin/catalog/quarantine'))}>
                      <AlertTriangle className="mr-2 h-4 w-4 text-destructive" />
                      <span>Карантин и аномалии цен</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/admin/catalog/sync'))}>
                      <ArrowLeftRight className="mr-2 h-4 w-4 text-sky-500" />
                      <span>Синхронизация с провайдерами</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/admin/smart'))}>
                      <Cpu className="mr-2 h-4 w-4 text-purple-500" />
                      <span>Умный Dripfeed</span>
                    </CommandItem>
                  </>
                )}
                {isHrefAllowed('/admin/providers') && (
                  <CommandItem onSelect={() => runCommand(() => router.push('/admin/providers'))}>
                    <LinkIcon className="mr-2 h-4 w-4 text-sky-500" />
                    <span>Провайдеры (API)</span>
                  </CommandItem>
                )}
                {isHrefAllowed('/admin/pages') && (
                  <CommandItem onSelect={() => runCommand(() => router.push('/admin/pages'))}>
                    <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Страницы и База знаний</span>
                  </CommandItem>
                )}
              </CommandGroup>
            )}

            <CommandSeparator />

            {/* ── Система и Настройки ── */}
            {isHrefAllowed('/admin/settings') && (
              <CommandGroup heading="Система и Настройки">
                <CommandItem onSelect={() => runCommand(() => router.push('/admin/settings'))}>
                  <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Общие настройки сервиса</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/admin/settings/balance-policies'))}>
                  <Shield className="mr-2 h-4 w-4 text-indigo-500" />
                  <span>Политики лимитов баланса</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/admin/tenants'))}>
                  <Globe className="mr-2 h-4 w-4 text-teal-500" />
                  <span>Мульти-тенант (Бренды и домены)</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </CommandDialog>
      )}
    </>
  );
}
