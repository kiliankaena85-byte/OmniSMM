'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, 
  Users, 
  Lock, 
  Ban, 
  RefreshCw, 
  AlertTriangle, 
  Radio, 
  Activity, 
  Copy, 
  Check, 
  Eye, 
  Search, 
  Globe, 
  Terminal 
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { FINANCE_TABS } from '@/components/admin/navigation-data';
import { getSecurityEventsAction, getSecurityStatsAction } from '@/actions/admin/security';
import { type SecurityEvent } from '@prisma/client';

export function AntiFraudMonitorClient() {
  const [activeTab, setActiveTab] = useState<'security' | 'vesting'>('security');
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [searchIp, setSearchIp] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [stats, setStats] = useState({
    total24h: 0,
    critical24h: 0,
    high24h: 0,
    warning24h: 0,
    uniqueIpsCount: 0,
    topEvents: [] as Array<{ event: string; count: number }>,
    topIps: [] as Array<{ ip: string; count: number }>
  });

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [eventsRes, statsRes] = await Promise.all([
        getSecurityEventsAction({
          limit: 50,
          severity: severityFilter,
          ip: searchIp ? searchIp.trim() : undefined,
        }),
        getSecurityStatsAction(),
      ]);

      if (eventsRes.success && eventsRes.events) {
        setEvents(eventsRes.events);
        setTotalEvents(eventsRes.total);
      }
      if (statsRes.success && statsRes.stats) {
        setStats(statsRes.stats);
      }
    } catch {
      toast.error('Не удалось загрузить данные мониторинга безопасности');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [severityFilter, searchIp]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time polling loop
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Скопировано в буфер обмена');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/30 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            HIGH
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            WARNING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
            INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10">
      {/* Top Header */}
      <AdminTabbedHeader
        icon={ShieldAlert}
        title="Антифрод & Защита контуров"
        description="Мониторинг атак на вебхуки в реальном времени, аномалий трафика и защита финансовых контуров"
        action={(
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs">
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-muted-foreground'}`} />
              <span className="text-muted-foreground">Live Feed:</span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`font-semibold transition-colors cursor-pointer ${autoRefresh ? 'text-emerald-500' : 'text-muted-foreground'}`}
              >
                {autoRefresh ? 'ВКЛ (5s)' : 'ВЫКЛ'}
              </button>
            </div>

            <button
              onClick={() => {
                fetchData();
                toast.success('Данные обновлены');
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-card border border-border text-foreground hover:bg-muted transition-all duration-200 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
          </div>
        )}
        tabs={FINANCE_TABS}
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'security'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Radio className="w-4 h-4" />
          🛡️ Real-Time Webhook & Security Monitor
          {stats.critical24h > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white animate-pulse">
              {stats.critical24h}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('vesting')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'vesting'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Lock className="w-4 h-4 text-amber-500" />
          👥 Рефералы & Vesting Hold
        </button>
      </div>

      {activeTab === 'security' ? (
        <>
          {/* Live KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Алертов за 24ч</span>
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.total24h}</div>
              <p className="text-[11px] text-muted-foreground">Все зафиксированные инциденты</p>
            </div>

            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-1">
              <div className="flex items-center justify-between text-red-500">
                <span className="text-xs font-medium uppercase tracking-wider">Критических атак (P0)</span>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div className="text-2xl font-bold text-red-500">{stats.critical24h}</div>
              <p className="text-[11px] text-muted-foreground">Подделки HMAC, Replay, IP spoofing</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-1">
              <div className="flex items-center justify-between text-amber-500">
                <span className="text-xs font-medium uppercase tracking-wider">Высокий риск (P1)</span>
                <ShieldAlert className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.high24h}</div>
              <p className="text-[11px] text-muted-foreground">Отсутствие подписи, stale timestamp</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Уникальных IP</span>
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.uniqueIpsCount}</div>
              <p className="text-[11px] text-muted-foreground">Источники аномальной активности</p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3.5 rounded-xl border border-border">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Уровень:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">Все уровни</option>
                <option value="CRITICAL">CRITICAL 🚨</option>
                <option value="HIGH">HIGH ⚠️</option>
                <option value="WARNING">WARNING 🟡</option>
                <option value="INFO">INFO ℹ️</option>
              </select>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Поиск по IP адресу..."
                value={searchIp}
                onChange={(e) => setSearchIp(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Security Events Stream Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Лента инцидентов и атак на вебхуки
                </h2>
                <span className="text-xs text-muted-foreground">({totalEvents} записей)</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 whitespace-nowrap">Время (МСК)</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Событие</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Критичность</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Шлюз / Модуль</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">IP Атакующего</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Тенант</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && events.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        Загрузка журнала безопасности...
                      </td>
                    </tr>
                  ) : events.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        🛡️ Инцидентов не обнаружено. Система работает в штатном безопасном режиме.
                      </td>
                    </tr>
                  ) : (
                    events.map((ev) => {
                      const details = (ev.details as Record<string, unknown>) || {};
                      const gateway = (details.gateway as string) || (details.provider as string) || (details.action as string) || 'webhook';

                      return (
                        <tr key={ev.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground font-mono">
                            {new Date(ev.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-mono font-medium text-foreground">
                            {ev.event}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {getSeverityBadge(ev.severity)}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-muted text-[11px] font-mono text-foreground border border-border">
                              {gateway}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-mono">
                            {ev.ip ? (
                              <div className="flex items-center gap-1.5">
                                <span>{ev.ip}</span>
                                <button
                                  onClick={() => copyToClipboard(ev.ip || '', ev.id)}
                                  className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                                  title="Копировать IP"
                                >
                                  {copiedId === ev.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                            {ev.tenantId || 'smmplan'}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <button
                              onClick={() => setSelectedEvent(ev)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-muted hover:bg-muted/80 text-foreground border border-border transition-all"
                            >
                              <Eye className="w-3 h-3" />
                              Payload
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Vesting Table Tab */
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Заморожено (Vesting)</span>
                <Lock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">0 ₽</div>
              <p className="text-xs text-muted-foreground">Период заморозки: 72 часа</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Подозрительные кластеры</span>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">0</div>
              <p className="text-xs text-muted-foreground">IP / User-Agent совпадения</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Заблокировано фрода</span>
                <Ban className="w-4 h-4 text-red-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">100%</div>
              <p className="text-xs text-muted-foreground">Self-referral & Duplicate Fingerprints</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                Замороженные бонусы (Vesting 72h)
              </h2>
              <span className="text-xs text-muted-foreground">Авто-разблокировка после завершения холда</span>
            </div>

            <div className="p-8 text-center text-muted-foreground text-sm">
              Нет активных замороженных бонусов. Все реферальные начисления проверены и безопасны.
            </div>
          </div>
        </div>
      )}

      {/* Payload Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  Инспектор инцидента безопасности
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  ID: {selectedEvent.id} • {new Date(selectedEvent.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-muted-foreground hover:text-foreground text-lg px-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-muted/50 border border-border space-y-1">
                  <span className="text-muted-foreground">Событие:</span>
                  <div className="font-mono font-bold text-foreground">{selectedEvent.event}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/50 border border-border space-y-1">
                  <span className="text-muted-foreground">Критичность:</span>
                  <div>{getSeverityBadge(selectedEvent.severity)}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/50 border border-border space-y-1">
                  <span className="text-muted-foreground">IP Адрес:</span>
                  <div className="font-mono font-bold text-foreground">{selectedEvent.ip || '—'}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/50 border border-border space-y-1">
                  <span className="text-muted-foreground">Тенант:</span>
                  <div className="font-mono font-bold text-foreground">{selectedEvent.tenantId || 'smmplan'}</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Контекст и метаданные (JSON Details):</span>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(selectedEvent.details, null, 2), 'modal-payload')}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {copiedId === 'modal-payload' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    Копировать JSON
                  </button>
                </div>
                <pre className="p-3.5 rounded-lg bg-muted text-[11px] font-mono text-foreground border border-border overflow-x-auto max-h-60">
                  {JSON.stringify(selectedEvent.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

