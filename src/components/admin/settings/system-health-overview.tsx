'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CreditCard, 
  Bot, 
  Mail, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  Zap,
  Activity,
  Database,
  Server
} from 'lucide-react';
import { toast } from 'sonner';
import { syncCBRExchangeRateAction } from '@/actions/admin/cbr-sync';
import { getSystemHealthReportAction, type SystemHealthReport } from '@/actions/admin/health';

interface SystemHealthOverviewProps {
  settings: {
    isTestMode?: boolean;
    maintenanceMode?: boolean;
    yookassaShopId?: string | null;
    yookassaSecretKey?: string | null;
    robokassaLogin?: string | null;
    robokassaPassword?: string | null;
    cryptoBotToken?: string | null;
    emailProvider?: string | null;
    smtpHost?: string | null;
    resendApiKey?: string | null;
    geminiApiKeys?: string | null;
    geminiProxy?: string | null;
    exchangeRateUSD?: number | null;
    exchangeRateUpdatedAt?: Date | string | null;
  };
}

export function SystemHealthOverview({ settings }: SystemHealthOverviewProps) {
  const [isSyncingCbr, startCbrSync] = React.useTransition();

  const isYooKassaReady = Boolean(settings.yookassaShopId && settings.yookassaSecretKey);
  const isRobokassaReady = Boolean(settings.robokassaLogin && settings.robokassaPassword);
  const isCryptoBotReady = Boolean(settings.cryptoBotToken);
  const isEmailReady = settings.emailProvider === 'RESEND' 
    ? Boolean(settings.resendApiKey) 
    : Boolean(settings.smtpHost);
  const isGeminiReady = Boolean(settings.geminiApiKeys);

  const handleSyncCbr = () => {
    startCbrSync(async () => {
      try {
        const res = await syncCBRExchangeRateAction();
        if (res && res.success) {
          toast.success(`Курс ЦБ РФ успешно синхронизирован: 1 USD = ${res.rate.toFixed(2)} ₽`);
        } else {
          toast.error(res?.error || 'Не удалось обновить курс с ЦБ РФ');
        }
      } catch {
        toast.error('Ошибка синхронизации курса ЦБ РФ');
      }
    });
  };

  const [isClient, setIsClient] = React.useState(false);
  const [healthReport, setHealthReport] = React.useState<SystemHealthReport | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = React.useState(false);

  const fetchHealthReport = React.useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const res = await getSystemHealthReportAction();
      if (res && res.success && res.data) {
        setHealthReport(res.data);
      }
    } catch (e) {
      console.error('Failed to load system health report:', e);
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  React.useEffect(() => {
    setIsClient(true);
    fetchHealthReport();
    const interval = setInterval(fetchHealthReport, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, [fetchHealthReport]);

  const formatTime = (d?: Date | string | null) => {
    if (!d) return 'Не синхронизировался';
    if (!isClient) return 'Загрузка...';
    try {
      const date = new Date(d);
      return date.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Не синхронизировался';
    }
  };

  return (
    <Card className="rounded-3xl border border-border/60 shadow-lg bg-card/70 backdrop-blur-xl p-6 sm:p-7 relative overflow-hidden ring-1 ring-border/5">
      {/* Background glow accent */}
      <div className="absolute top-0 right-0 w-96 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20">
              <Zap className="w-4 h-4" />
            </div>
            <h2 className="text-base font-black uppercase tracking-wider text-foreground">
              Пульс Платформы и Интеграций
            </h2>
            <Badge intent="outline" className="bg-background/80 font-mono text-[10px] text-muted-foreground">
              Live Health
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            Сводный статус ключевых систем: платежи, фискализация, email-сервер, ИИ и валютные курсы.
          </p>
        </div>

        {/* Global Operational Mode Badge */}
        <div className="flex items-center gap-3">
          {settings.maintenanceMode ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-destructive/15 border border-destructive/30 text-destructive animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-wider">Техработы активны</span>
            </div>
          ) : settings.isTestMode ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-warning/15 border border-warning/30 text-warning">
              <HelpCircle className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-wider">Тестовый Sandbox</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-success/15 border border-success/30 text-success">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-wider">Боевой Live режим</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid of 4 Health Cubes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
        {/* 1. Payment Gateways */}
        <div className="p-4 rounded-lg border border-border/70 bg-background/60 backdrop-blur-md space-y-3 shadow-xs">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Приём платежей</span>
            </div>
            {isYooKassaReady || isCryptoBotReady || isRobokassaReady ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-success">
                <CheckCircle2 className="w-3.5 h-3.5" /> В строю
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-destructive">
                <XCircle className="w-3.5 h-3.5" /> Нет ключей
              </span>
            )}
          </div>
          <div className="space-y-1 text-[11px] font-medium text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>ЮKassa (Карты/СБП/54-ФЗ):</span>
              <span className={isYooKassaReady ? 'text-success font-bold' : 'text-muted-foreground'}>
                {isYooKassaReady ? 'Подключено' : 'Выкл'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>CryptoBot (USDT/TON):</span>
              <span className={isCryptoBotReady ? 'text-success font-bold' : 'text-muted-foreground'}>
                {isCryptoBotReady ? 'Подключено' : 'Выкл'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Robokassa:</span>
              <span className={isRobokassaReady ? 'text-success font-bold' : 'text-muted-foreground'}>
                {isRobokassaReady ? 'Подключено' : 'Резерв'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Email Server */}
        <div className="p-4 rounded-lg border border-border/70 bg-background/60 backdrop-blur-md space-y-3 shadow-xs">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Почта & Тикеты</span>
            </div>
            {isEmailReady ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-success">
                <CheckCircle2 className="w-3.5 h-3.5" /> Активно
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-warning">
                <AlertTriangle className="w-3.5 h-3.5" /> Fallback (.env)
              </span>
            )}
          </div>
          <div className="space-y-1 text-[11px] font-medium text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>Провайдер:</span>
              <span className="text-foreground font-bold">{settings.emailProvider || 'SMTP'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Статус сервера:</span>
              <span className={isEmailReady ? 'text-success font-bold' : 'text-warning font-bold'}>
                {isEmailReady ? 'Готов к отправке' : 'Локальный .env'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Google Gemini AI */}
        <div className="p-4 rounded-lg border border-border/70 bg-background/60 backdrop-blur-md space-y-3 shadow-xs">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">ИИ Ассистент</span>
            </div>
            {isGeminiReady ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-success">
                <CheckCircle2 className="w-3.5 h-3.5" /> Пул активен
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-warning">
                <AlertTriangle className="w-3.5 h-3.5" /> Ключ из .env
              </span>
            )}
          </div>
          <div className="space-y-1 text-[11px] font-medium text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>Модель:</span>
              <span className="font-mono text-[10px] font-black text-primary">gemini-3-flash</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Прокси РФ:</span>
              <span className="text-foreground font-bold truncate max-w-[100px]" title={settings.geminiProxy || 'Прямое / Clash'}>
                {settings.geminiProxy ? 'Настроен' : 'Прямое'}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Exchange Rate */}
        <div className="p-4 rounded-lg border border-border/70 bg-background/60 backdrop-blur-md space-y-3 shadow-xs">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Курс ЦБ РФ (USD)</span>
            </div>
            <Button
              type="button"
              intent="ghost"
              size="sm"
              disabled={isSyncingCbr}
              onClick={handleSyncCbr}
              className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 gap-1 rounded-lg"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingCbr ? 'animate-spin' : ''}`} />
              Сверить
            </Button>
          </div>
          <div className="space-y-1 text-[11px] font-medium text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>Текущий курс:</span>
              <span className="text-sm font-black font-mono text-foreground">
                {settings.exchangeRateUSD ? `${settings.exchangeRateUSD.toFixed(2)} ₽` : 'Авто ЦБ'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span>Обновлено:</span>
              <span className="text-muted-foreground">{formatTime(settings.exchangeRateUpdatedAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Infrastructure Core Subsystem Pulse (PostgreSQL, Redis, BullMQ) */}
      <div className="mt-4 pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono">
        <div className="flex items-center gap-4 flex-wrap">
          {/* DB Status */}
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">PostgreSQL:</span>
            {healthReport ? (
              <span className={`font-bold ${healthReport.database.status === 'connected' ? 'text-success' : 'text-destructive'}`}>
                {healthReport.database.status === 'connected' ? `${healthReport.database.latencyMs}ms` : 'Error'}
              </span>
            ) : (
              <span className="text-muted-foreground animate-pulse">Опрос...</span>
            )}
          </div>

          {/* Redis Status */}
          <div className="flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">Redis:</span>
            {healthReport ? (
              <span className={`font-bold ${healthReport.redis.status === 'connected' ? 'text-success' : 'text-destructive'}`}>
                {healthReport.redis.status === 'connected' ? `${healthReport.redis.latencyMs}ms` : 'Error'}
              </span>
            ) : (
              <span className="text-muted-foreground animate-pulse">Опрос...</span>
            )}
          </div>

          {/* BullMQ Worker Status */}
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">Воркер:</span>
            {healthReport ? (
              <span className={`font-bold ${healthReport.worker.status === 'alive' ? 'text-success' : healthReport.worker.status === 'stale' ? 'text-warning' : 'text-muted-foreground'}`}>
                {healthReport.worker.status === 'alive' ? 'Online' : healthReport.worker.status === 'stale' ? 'Stale' : 'Idle'}
              </span>
            ) : (
              <span className="text-muted-foreground animate-pulse">Опрос...</span>
            )}
          </div>

          {/* Queues & Stuck Orders */}
          {healthReport && (healthReport.queues.waitingOrders > 0 || healthReport.stuckOrders.pendingOlderThan15m > 0) && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-warning/10 border border-warning/20 text-warning text-[10px]">
              <AlertTriangle className="w-3 h-3" />
              <span>Очередь: {healthReport.queues.waitingOrders} | Зависло: {healthReport.stuckOrders.pendingOlderThan15m}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={fetchHealthReport}
          disabled={isLoadingHealth}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
          title="Обновить метрики инфраструктуры"
        >
          <RefreshCw className={`w-3 h-3 ${isLoadingHealth ? 'animate-spin' : ''}`} />
          <span>Обновить пульс</span>
        </button>
      </div>
    </Card>
  );
}
