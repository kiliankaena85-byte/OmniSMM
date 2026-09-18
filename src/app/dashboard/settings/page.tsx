import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  User, Mail, Calendar, Shield,
  CreditCard, TrendingUp, Settings, Star, Key,
} from 'lucide-react';
import PasswordCard from '@/components/dashboard/settings/PasswordCard';
import DeleteAccountCard from '@/components/dashboard/settings/DeleteAccountCard';
import LogoutCard from '@/components/dashboard/settings/LogoutCard';
import TelegramCard from '@/components/dashboard/settings/TelegramCard';
import Consent152FzCard from '@/components/dashboard/settings/Consent152FzCard';
import CompanyRequisitesCard from '@/components/dashboard/settings/CompanyRequisitesCard';
import ApiWebhookCard from '@/components/dashboard/settings/ApiWebhookCard';
import ApiKeyManager from './api/ApiKeyManager';
import { formatBalance } from '@/lib/utils';
import { DashboardBreadcrumbs } from '@/components/dashboard/DashboardBreadcrumbs';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Профиль и Настройки | SMMplan',
};

export default async function ClientSettingsPage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  const canResetPassword = session.canResetPassword === true;

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

  const balanceFormatted    = formatBalance(user.balance);
  const spentFormatted      = formatBalance(user.totalSpent);
  const refBalanceFormatted = formatBalance(user.referralBalance ?? 0);

  const memberSince = user.createdAt.toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // Loyalty tier based on totalSpent
  const spent = Number(user.totalSpent) / 100;
  const tier = spent >= 50000
    ? { name: 'Платиновый', color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20', icon: '💎' }
    : spent >= 10000
    ? { name: 'Золотой',    color: 'text-amber-600 dark:text-amber-400 bg-warning/10 border-amber-500/20',    icon: '🏆' }
    : spent >= 2000
    ? { name: 'Серебряный', color: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20',    icon: '⭐' }
    : { name: 'Базовый',    color: 'text-muted-foreground bg-muted border-border/60',   icon: '🌱' };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <DashboardBreadcrumbs items={[{ label: 'Настройки' }]} />
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Профиль и настройки</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Управление безопасностью, интеграцией с Telegram, реквизитами организации и Panel API
        </p>
      </div>

      {/* Profile card */}
      <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-black uppercase shrink-0">
            {user.email.substring(0, 2)}
          </div>

          <div className="flex-1 min-w-0 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-2">
              <p className="font-bold text-foreground truncate max-w-full">{user.email}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase w-fit mx-auto sm:mx-0 shrink-0 ${tier.color}`}>
                {tier.icon} {tier.name}
              </span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-muted-foreground mt-1.5">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Участник с {memberSince}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { icon: CreditCard, label: 'Баланс',       value: balanceFormatted,        color: 'text-primary bg-primary/10' },
          { icon: TrendingUp, label: 'Потрачено всего', value: spentFormatted,        color: 'text-success bg-success/10' },
          { icon: Settings,   label: 'Заказов',       value: user._count.orders.toString(), color: 'text-blue-500 bg-blue-500/10' },
          { icon: Star,       label: 'Рефералов',     value: user._count.referrals.toString(), color: 'text-warning bg-warning/10' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card border border-border/60 rounded-2xl p-6 space-y-3 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground">{label}</div>
              <div className="text-lg font-black text-foreground tabular-nums">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Account details */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm">Данные аккаунта</h2>
        </div>
        <div className="divide-y divide-border">
          {[
            { icon: Mail,     label: 'Email',             value: user.email },
            { icon: Star,     label: 'Реферальный баланс', value: refBalanceFormatted },
            { icon: Shield,   label: 'Реф. код',          value: user.referralCode ?? '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-4 px-5 py-4">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-sm font-semibold text-foreground truncate">{value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Smart Bind Telegram Integration */}
      <TelegramCard
        telegramId={user.telegramId}
        notifyOrders={user.telegramNotifyOrders}
        notifyBalance={user.telegramNotifyBalance}
        notifyTickets={user.telegramNotifyTickets}
      />

      {/* 152-FZ Consent Status */}
      <Consent152FzCard
        tosAcceptedAt={user.tosAcceptedAt}
        tosAcceptedIp={user.tosAcceptedIp}
      />

      {/* Tax & Company Requisites */}
      <CompanyRequisitesCard
        initialData={{
          companyName: user.companyName,
          inn: user.inn,
          kpp: user.kpp,
          ogrn: user.ogrn,
          legalAddress: user.legalAddress,
        }}
      />

      {/* API Webhook Settings */}
      <ApiWebhookCard
        initialData={{
          webhookUrl: user.apiConfig?.webhookUrl,
          webhookSecret: user.apiConfig?.webhookSecret,
          isWebhookActive: user.apiConfig?.isWebhookActive,
        }}
      />

      {/* API Key Management */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-sm">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2.5 bg-muted/20">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-sm">
              Управление API-ключами API
            </h2>
            <p className="text-[10px] text-muted-foreground">
              Ключ авторизации для программного создания заказов через API SMMplan
            </p>
          </div>
        </div>
        <div className="p-5">
          <ApiKeyManager hasKey={!!user.apiKeyHash} />
        </div>
      </div>

      {/* Password Management */}
      <PasswordCard hasPassword={!!user.passwordHash} canResetPassword={canResetPassword} />

      {/* Session & Logout Card */}
      <LogoutCard tenantId={session.tenantId} />

      {/* Account Soft Deletion */}
      <DeleteAccountCard hasPassword={!!user.passwordHash} />

      {/* Referral balance usage info */}
      {(user.referralBalance ?? 0) > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 flex items-start gap-3">
          <Star className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-0.5">
              У вас {refBalanceFormatted} реферального баланса
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-3">
              Реферальный баланс начисляется автоматически — 15% с каждого заказа приглашённых вами пользователей.
              Средства зачисляются на ваш основной баланс при выводе.
            </p>
            <Link
              href="/dashboard/referrals"
              aria-label="Перейти к реферальной программе"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 underline hover:no-underline transition-colors"
            >
              Управление реферальной программой →
            </Link>
          </div>
        </div>
      )}

      {/* Loyalty progress */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">Уровень лояльности</h2>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase ${tier.color}`}>
            {tier.icon} {tier.name}
          </span>
        </div>

        {/* Tier progression */}
        <div className="space-y-2">
          {[
            { label: 'Базовый',    threshold: 0,     icon: '🌱' },
            { label: 'Серебряный', threshold: 2000,  icon: '⭐' },
            { label: 'Золотой',    threshold: 10000, icon: '🏆' },
            { label: 'Платиновый', threshold: 50000, icon: '💎' },
          ].map((t, i, arr) => {
            const next = arr[i + 1];
            const isCurrentOrPast = spent >= t.threshold;
            const isCurrent = isCurrentOrPast && (!next || spent < next.threshold);
            return (
              <div key={t.label} className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                    isCurrentOrPast ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground/40'
                  }`}
                >
                  {t.icon}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-semibold ${isCurrent ? 'text-primary' : isCurrentOrPast ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {t.label}
                      {isCurrent && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-bold">ВЫ ЗДЕСЬ</span>}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      от {t.threshold.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Next tier hint */}
        {spent < 50000 && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
            {spent < 2000  && `До Серебряного уровня: ещё ${(2000 - spent).toLocaleString('ru-RU')} ₽`}
            {spent >= 2000  && spent < 10000 && `До Золотого уровня: ещё ${(10000 - spent).toLocaleString('ru-RU')} ₽`}
            {spent >= 10000 && spent < 50000 && `До Платинового уровня: ещё ${(50000 - spent).toLocaleString('ru-RU')} ₽`}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/dashboard/referrals"
          className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:bg-muted/30 transition-all duration-200 group"
          aria-label="Реферальная программа"
        >
          <div className="w-9 h-9 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0">
            <Star className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              Реферальная программа
            </div>
            <div className="text-xs text-muted-foreground">Зарабатывайте 15% с каждого заказа</div>
          </div>
        </Link>

        <Link
          href="/dashboard/settings/api"
          className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:bg-muted/30 transition-all duration-200 group"
          aria-label="API доступ"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              Panel API
            </div>
            <div className="text-xs text-muted-foreground">Документация и полное управление API-ключами</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
