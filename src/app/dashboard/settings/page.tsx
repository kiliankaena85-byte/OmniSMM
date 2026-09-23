import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Calendar, CreditCard, TrendingUp, Settings, Star } from 'lucide-react';
import { formatBalance } from '@/lib/utils';
import { DashboardBreadcrumbs } from '@/components/dashboard/DashboardBreadcrumbs';
import { SettingsTabsClient } from '@/components/dashboard/settings/SettingsTabsClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Профиль и Настройки | SMMplan',
};

export default async function ClientSettingsPage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      email: true,
      passwordHash: true,
      balance: true,
      totalSpent: true,
      createdAt: true,
      referralCode: true,
      referralBalance: true,
      telegramId: true,
      telegramNotifyOrders: true,
      telegramNotifyBalance: true,
      telegramNotifyTickets: true,
      apiKeyHash: true,
      tosAcceptedAt: true,
      tosAcceptedIp: true,
      companyName: true,
      inn: true,
      kpp: true,
      ogrn: true,
      legalAddress: true,
      apiConfig: {
        select: {
          webhookUrl: true,
          webhookSecret: true,
          isWebhookActive: true,
        },
      },
      _count: {
        select: {
          orders: true,
          referrals: true,
        },
      },
    },
  });

  if (!user) redirect('/login');

  const balanceFormatted = formatBalance(user.balance);
  const spentFormatted = formatBalance(user.totalSpent);
  const memberSince = user.createdAt.toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const spent = Number(user.totalSpent) / 100;
  const tier = spent >= 50000
    ? { name: 'Платиновый', color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20', icon: '💎' }
    : spent >= 10000
    ? { name: 'Золотой', color: 'text-amber-600 dark:text-amber-400 bg-warning/10 border-amber-500/20', icon: '🏆' }
    : spent >= 2000
    ? { name: 'Серебряный', color: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20', icon: '⭐' }
    : { name: 'Базовый', color: 'text-muted-foreground bg-muted border-border/60', icon: '🌱' };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <DashboardBreadcrumbs items={[{ label: 'Настройки' }]} />

      {/* Profile Header & Summary */}
      <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-left">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-black uppercase shrink-0">
            {user.email.substring(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-foreground truncate">{user.email}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase ${tier.color}`}>
                {tier.icon} {tier.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>На платформе с {memberSince}</span>
            </div>
          </div>
        </div>

        {/* Compact Quick Stats */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:flex-initial bg-muted/40 border border-border/50 rounded-xl px-3.5 py-2">
            <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-primary" /> Баланс
            </div>
            <div className="text-sm font-black text-foreground tabular-nums">{balanceFormatted}</div>
          </div>
          <div className="flex-1 md:flex-initial bg-muted/40 border border-border/50 rounded-xl px-3.5 py-2">
            <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" /> Заказов
            </div>
            <div className="text-sm font-black text-foreground tabular-nums">{user._count.orders}</div>
          </div>
          <div className="flex-1 md:flex-initial bg-muted/40 border border-border/50 rounded-xl px-3.5 py-2">
            <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-500" /> Рефералов
            </div>
            <div className="text-sm font-black text-foreground tabular-nums">{user._count.referrals}</div>
          </div>
        </div>
      </div>

      {/* Nested Tabs Settings Component */}
      <SettingsTabsClient
        user={{
          email: user.email,
          hasPassword: !!user.passwordHash,
          canResetPassword: session.canResetPassword === true,
          telegramId: user.telegramId,
          telegramNotifyOrders: user.telegramNotifyOrders,
          telegramNotifyBalance: user.telegramNotifyBalance,
          telegramNotifyTickets: user.telegramNotifyTickets,
          tosAcceptedAt: user.tosAcceptedAt,
          tosAcceptedIp: user.tosAcceptedIp,
          apiKeyHash: user.apiKeyHash,
          companyName: user.companyName,
          inn: user.inn,
          kpp: user.kpp,
          ogrn: user.ogrn,
          legalAddress: user.legalAddress,
          webhookUrl: user.apiConfig?.webhookUrl,
          webhookSecret: user.apiConfig?.webhookSecret,
          isWebhookActive: user.apiConfig?.isWebhookActive,
          tenantId: session.tenantId,
        }}
      />
    </div>
  );
}
