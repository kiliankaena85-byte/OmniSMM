'use client';

import * as React from 'react';
import {
  Zap,
  Upload,
  RefreshCw,
  Plus,
  Shield,
  Star,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  Search,
  Server,
  HeartPulse,
  Sparkles,
  ExternalLink,
  Flame,
} from 'lucide-react';
import {
  getTelegramPoolStatsAction,
  listTelegramSessionsAction,
  importTelegramSessionsAction,
  executeManualBoostAction,
  executeManualReactionAction,
  sweepExpiredBoostsAction,
  seedMockTelegramSessionsAction,
  clearMockTelegramSessionsAction,
  type SessionListItem,
} from '@/actions/admin/production/sessions';

interface TelegramMtprotoTabProps {
  tenantId?: string;
}

export function TelegramMtprotoTab({ tenantId: _tenantId }: TelegramMtprotoTabProps) {
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [stats, setStats] = React.useState<{
    totalSessions: number;
    activeSessions: number;
    premiumAccounts: number;
    totalBoostSlots: number;
    availableBoostSlots: number;
    averageHealthScore: number;
  } | null>(null);
  const [sessions, setSessions] = React.useState<SessionListItem[]>([]);
  const [search, setSearch] = React.useState('');
  const [stateFilter, setStateFilter] = React.useState('ALL');

  // Modals
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [showBoostModal, setShowBoostModal] = React.useState(false);
  const [showReactionModal, setShowReactionModal] = React.useState(false);

  // Import form state
  const [importJson, setImportJson] = React.useState('');
  const [importStatus, setImportStatus] = React.useState<string | null>(null);

  // Boost form state
  const [boostChannel, setBoostChannel] = React.useState('');
  const [boostDuration, setBoostDuration] = React.useState(30);
  const [boostResult, setBoostResult] = React.useState<string | null>(null);

  // Reaction form state
  const [reactionChannel, setReactionChannel] = React.useState('');
  const [reactionPostId, setReactionPostId] = React.useState(1);
  const [reactionEmoji, setReactionEmoji] = React.useState('👍');
  const [reactionResult, setReactionResult] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        getTelegramPoolStatsAction(),
        listTelegramSessionsAction({ state: stateFilter, search }),
      ]);

      if (statsRes.success && statsRes.stats) {
        setStats(statsRes.stats);
      }
      if (listRes.success && listRes.sessions) {
        setSessions(listRes.sessions);
      }
    } catch (err) {
      console.error('Failed to load MTProto pool data:', err);
    } finally {
      setLoading(false);
    }
  }, [stateFilter, search]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle bulk import
  const handleImport = async () => {
    if (!importJson.trim()) return;
    setActionLoading(true);
    setImportStatus(null);
    try {
      let parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) {
        parsed = [parsed];
      }

      const res = await importTelegramSessionsAction({
        sessions: parsed,
        testConnectionBeforeSave: true,
      });

      if (res.success) {
        setImportStatus(`Успешно импортировано: ${res.successfulCount} из ${res.total}`);
        loadData();
        setTimeout(() => {
          setShowImportModal(false);
          setImportJson('');
          setImportStatus(null);
        }, 1500);
      } else {
        setImportStatus(`Ошибка импорта: ${res.error}`);
      }
    } catch (err: unknown) {
      setImportStatus(`Некорректный JSON: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle manual boost
  const handleManualBoost = async () => {
    if (!boostChannel.trim()) return;
    setActionLoading(true);
    setBoostResult(null);
    try {
      const res = await executeManualBoostAction({
        channel: boostChannel.trim(),
        durationDays: boostDuration,
      });
      if (res.success && 'sessionId' in res && res.sessionId) {
        setBoostResult(`Буст успешно применен! Сессия: ${res.sessionId}, слот #${res.slotIndex ?? 0}`);
        loadData();
      } else {
        setBoostResult(`Ошибка буста: ${res.error || 'Неизвестная ошибка'}`);
      }
    } catch (err: unknown) {
      setBoostResult(`Сбой: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle manual reaction
  const handleManualReaction = async () => {
    if (!reactionChannel.trim() || !reactionPostId) return;
    setActionLoading(true);
    setReactionResult(null);
    try {
      const res = await executeManualReactionAction({
        channel: reactionChannel.trim(),
        postId: reactionPostId,
        reaction: reactionEmoji,
      });
      if (res.success && 'sessionId' in res && res.sessionId) {
        setReactionResult(`Реакция ${reactionEmoji} успешно отправлена! Сессия: ${res.sessionId}`);
        loadData();
      } else {
        setReactionResult(`Ошибка реакции: ${res.error || 'Неизвестная ошибка'}`);
      }
    } catch (err: unknown) {
      setReactionResult(`Сбой: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle sweep
  const handleSweep = async () => {
    setActionLoading(true);
    try {
      await sweepExpiredBoostsAction();
      loadData();
    } finally {
      setActionLoading(false);
    }
  };

  // Handle seed mock simulator
  const handleSeedMock = async () => {
    setActionLoading(true);
    try {
      const res = await seedMockTelegramSessionsAction();
      if (res.success) {
        loadData();
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle clear mock simulator
  const handleClearMock = async () => {
    setActionLoading(true);
    try {
      const res = await clearMockTelegramSessionsAction();
      if (res.success) {
        loadData();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const hasMockSessions = sessions.some((s) =>
    s.id.startsWith('tg_79165551234') ||
    s.id.startsWith('tg_79251234567') ||
    s.id.startsWith('tg_79039876543') ||
    s.id.startsWith('tg_447123456789') ||
    s.id.startsWith('tg_12125550199')
  );

  return (
    <div className="space-y-6">
      {/* HEADER CARD */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-background to-background border border-amber-500/20 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Zap className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Telegram MTProto Кластер
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                Tier-0 In-House
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Собственные серверные мощности для прямого исполнения бустов каналов (Level Boost), 
              премиум-реакций и авто-просмотров с себестоимостью 0–10% от рынка.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasMockSessions ? (
              <button
                type="button"
                onClick={handleClearMock}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all flex items-center gap-2 cursor-pointer"
                title="Очистить тестовые симуляторные сессии"
              >
                <span>Очистить симулятор</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSeedMock}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                title="Создать 5 виртуальных Telegram Premium сессий для тестирования бустов и реакций"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Заполнить симулятор (5 сессий)</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSweep}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>Сброс кулдаунов</span>
            </button>

            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Импорт сессий (JSON)</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sessions */}
        <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Активных сессий</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {stats?.activeSessions ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">
              из {stats?.totalSessions ?? 0} в пуле
            </span>
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Готовы к приему заказов</span>
          </div>
        </div>

        {/* Premium Boost Slots */}
        <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Слоты бустов (Boost Slots)</span>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {stats?.availableBoostSlots ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">
              свободно из {stats?.totalBoostSlots ?? 0}
            </span>
          </div>
          <div className="text-[11px] text-amber-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>{stats?.premiumAccounts ?? 0} Premium аккаунтов (4 слота/акк)</span>
          </div>
        </div>

        {/* Health Score */}
        <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Среднее здоровье сессий</span>
            <HeartPulse className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {stats?.averageHealthScore ?? 0}%
            </span>
            <span className="text-xs text-muted-foreground">
              Interaction Health
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{ width: `${stats?.averageHealthScore ?? 0}%` }}
            />
          </div>
        </div>

        {/* In-House Cost Advantage */}
        <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Себестоимость производства</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">
              0 – 10%
            </span>
            <span className="text-xs text-muted-foreground">
              от цен перекупов
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Буст 7d = ~11.25 ₽ | Реакция = 0.00 ₽
          </div>
        </div>
      </div>

      {/* TOOLBAR & ACTIONS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20 p-3 rounded-xl border border-border/60">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по телефону..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary w-48"
            />
          </div>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border/60 text-foreground cursor-pointer focus:outline-none"
          >
            <option value="ALL">Все статусы</option>
            <option value="READY">READY (Готовы)</option>
            <option value="BUSY">BUSY (В работе)</option>
            <option value="COOLDOWN">COOLDOWN (Кулдаун)</option>
            <option value="BANNED">BANNED (Бан)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBoostModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Тест буста</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReactionModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Тест реакции</span>
          </button>
        </div>
      </div>

      {/* SESSIONS TABLE */}
      <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3">Телефон / ID</th>
                <th className="px-3 py-3">Датацентр</th>
                <th className="px-3 py-3">Статус</th>
                <th className="px-3 py-3">Premium</th>
                <th className="px-3 py-3">Здоровье</th>
                <th className="px-3 py-3">Слоты бустов (4 шт)</th>
                <th className="px-3 py-3">Прокси</th>
                <th className="px-3 py-3 text-right">Устройство</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Загрузка сессий пула...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    В пуле пока нет зарегистрированных Telegram-сессий.
                    <br />
                    Нажмите «Импорт сессий (JSON)», чтобы добавить купленные аккаунты формата Session+JSON.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-foreground">
                      {s.phoneMasked}
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted font-mono">
                        DC{s.dcId}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.state === 'READY'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : s.state === 'BUSY'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : s.state === 'COOLDOWN'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {s.state}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {s.hasPremium ? (
                        <span className="flex items-center gap-1 text-amber-400 font-medium text-[11px]">
                          <Star className="w-3 h-3 fill-amber-400" />
                          Premium
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold">
                          {s.interactionHealthScore}%
                        </span>
                        <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              s.interactionHealthScore >= 70
                                ? 'bg-emerald-500'
                                : s.interactionHealthScore >= 50
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${s.interactionHealthScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        {s.boostSlots.map((slot) => {
                          const isOccupied = Boolean(slot.assignedChannelId);
                          return (
                            <span
                              key={slot.slotIndex}
                              title={
                                isOccupied
                                  ? `Слот #${slot.slotIndex}: Бустит @${slot.assignedChannelId}`
                                  : `Слот #${slot.slotIndex}: Свободен`
                              }
                              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold ${
                                isOccupied
                                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {slot.slotIndex + 1}
                            </span>
                          );
                        })}
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({s.freeBoostSlots} свободно)
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {s.hasProxy ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-mono">
                          SOCKS5
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">Прямой</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground text-[11px] font-mono">
                      {s.deviceModel}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: BULK IMPORT */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Массовый импорт сессий (Session+JSON)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Вставьте массив JSON купленных аккаунтов (формат Zelenka Market / Darkstore).
              Сессии шифруются алгоритмом AES-256-GCM перед сохранением в PostgreSQL.
            </p>

            <textarea
              rows={8}
              placeholder='[
  {
    "phone": "+79991234567",
    "sessionString": "1ApWq...",
    "hasPremium": true,
    "dcId": 2
  }
]'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              className="w-full p-3 text-xs font-mono bg-background border border-border/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />

            {importStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  importStatus.includes('Успешно')
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {importStatus}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={actionLoading || !importJson.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Импортирую...' : 'Импортировать в пул'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TEST BOOST */}
      {showBoostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-foreground">
                  Тестовый буст канала (MTProto)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBoostModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Целевой канал (@channel или t.me/+инвайт)
                </label>
                <input
                  type="text"
                  placeholder="@durov или https://t.me/my_channel"
                  value={boostChannel}
                  onChange={(e) => setBoostChannel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Срок буста
                </label>
                <select
                  value={boostDuration}
                  onChange={(e) => setBoostDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/60 text-foreground focus:outline-none cursor-pointer"
                >
                  <option value={7}>7 дней (Себестоимость: 11.25 ₽)</option>
                  <option value={30}>30 дней (Себестоимость: 45.00 ₽)</option>
                </select>
              </div>
            </div>

            {boostResult && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  boostResult.includes('успешно')
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {boostResult}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBoostModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground cursor-pointer"
              >
                Закрыть
              </button>
              <button
                type="button"
                onClick={handleManualBoost}
                disabled={actionLoading || !boostChannel.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-all cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Применяю буст...' : 'Запустить буст'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TEST REACTION */}
      {showReactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-foreground">
                  Тестовая реакция на пост
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReactionModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Канал (@channel)
                </label>
                <input
                  type="text"
                  placeholder="durov"
                  value={reactionChannel}
                  onChange={(e) => setReactionChannel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  ID поста
                </label>
                <input
                  type="number"
                  value={reactionPostId}
                  onChange={(e) => setReactionPostId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Эмодзи реакции
                </label>
                <div className="flex gap-2">
                  {['👍', '🔥', '❤️', '🎉', '👏', '⚡'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setReactionEmoji(emoji)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all ${
                        reactionEmoji === emoji
                          ? 'bg-primary/20 border-2 border-primary text-foreground'
                          : 'bg-muted/50 border border-border/60 hover:bg-muted'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {reactionResult && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  reactionResult.includes('успешно')
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {reactionResult}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReactionModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground cursor-pointer"
              >
                Закрыть
              </button>
              <button
                type="button"
                onClick={handleManualReaction}
                disabled={actionLoading || !reactionChannel.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Отправляю...' : 'Отправить реакцию'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
