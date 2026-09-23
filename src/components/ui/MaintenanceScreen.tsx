'use client';

import * as React from 'react';
import { 
  Wrench, 
  ShieldCheck, 
  Server, 
  Database, 
  RefreshCw, 
  Send, 
  Mail, 
  Lock, 
  Clock, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import Link from 'next/link';

interface MaintenanceScreenProps {
  siteName?: string;
  supportTelegram?: string;
  supportEmail?: string;
  estimatedDuration?: string;
  maintenanceReason?: string;
}

export function MaintenanceScreen({
  siteName = 'SMMplan',
  supportTelegram = 'smmplan_support_bot',
  supportEmail = 'support@smmplan.pro',
  estimatedDuration = 'в течение 30–45 минут',
  maintenanceReason,
}: MaintenanceScreenProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const telegramUrl = supportTelegram.startsWith('http')
    ? supportTelegram
    : `https://t.me/${supportTelegram.replace('@', '')}`;

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col justify-between relative overflow-x-hidden selection:bg-primary/20 selection:text-foreground">
      {/* ── Ambient Background Lighting ── */}
      <div className="absolute top-0 inset-x-0 h-[600px] pointer-events-none overflow-hidden select-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-gradient-to-b from-amber-500/15 via-rose-500/10 to-transparent blur-[120px] pointer-events-none" />
        <div className="absolute top-[20%] left-[10%] w-[350px] h-[350px] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
        <div className="absolute top-[15%] right-[10%] w-[350px] h-[350px] rounded-full bg-amber-500/10 blur-[110px] pointer-events-none" />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-primary-foreground font-black text-lg shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/20">
            <Wrench className="w-5 h-5 text-primary-foreground animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-foreground flex items-center gap-2">
              {siteName}
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              Сервисное обслуживание платформы
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-card/70 hover:bg-card border border-border/60 text-xs font-semibold text-foreground transition-all duration-200 backdrop-blur-md flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            title="Проверить статус работы"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Обновить статус</span>
          </button>

          <Link
            href="/login"
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-card/70 hover:bg-card border border-border/60 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all duration-200 backdrop-blur-md flex items-center gap-1.5 shadow-xs"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Вход для персонала</span>
          </Link>
        </div>
      </header>

      {/* ── Main Maintenance Container ── */}
      <main className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center text-center my-auto">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-extrabold mb-6 shadow-xs backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span>ПЛАНОВЫЕ РЕГЛАМЕНТНЫЕ ТЕХРАБОТЫ</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground leading-[1.2] mb-4">
          Обновляем узлы платформы <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-500 via-rose-500 to-primary">
            для стабильной и быстрой работы
          </span>
        </h1>

        {/* Description */}
        <p className="text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed mb-8">
          {maintenanceReason || 
            'Проводим плановую оптимизацию баз данных и обновление интеграционных протоколов. Доступ к витрине временно ограничен.'
          }
        </p>

        {/* High-Trust Guarantee Banner */}
        <div className="w-full bg-card/80 border border-border/80 rounded-2xl p-4 sm:p-5 mb-8 backdrop-blur-xl shadow-lg text-left divide-y divide-border/40">
          <div className="pb-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-foreground">
                Финансовая безопасность и сохранность заказов
              </h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Все клиентские балансы, активные подписки и очереди выполнения заказов сохранены в неизменном виде. После завершения работ всё возобновится автоматически.
              </p>
            </div>
          </div>

          {/* Infrastructure Health Sub-items */}
          <div className="pt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border/40">
              <Database className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-foreground text-[11px] truncate">База данных</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Сохранена 100%</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border/40">
              <Server className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-foreground text-[11px] truncate">Очереди BullMQ</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">На паузе</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border/40">
              <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-foreground text-[11px] truncate">Восстановление</span>
                <span className="text-[10px] text-primary font-semibold">{estimatedDuration}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button: Emergency Support */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md justify-center">
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex-1 min-h-[46px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all duration-200 active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>Дежурный инженер в Telegram</span>
          </a>

          <a
            href={`mailto:${supportEmail}`}
            className="w-full sm:w-auto min-h-[46px] px-5 py-2.5 rounded-xl bg-card hover:bg-muted border border-border/80 text-foreground font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-xs"
          >
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span>Email</span>
          </a>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <div>
          © {new Date().getFullYear()} {siteName}. OmniSMM Engine v1.0. Все права защищены.
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Данные в безопасности
          </span>
          <span className="text-border">•</span>
          <span>HTTP 503 Maintenance</span>
        </div>
      </footer>
    </div>
  );
}


