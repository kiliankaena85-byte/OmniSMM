'use client';

/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Main Telegram Bot Constructor Tab in Admin Panel.
 */

import React, { useState, useEffect, useTransition } from 'react';
import {
  Bot,
  Plus,
  Settings2,
  Trash2,
  Power,
  ShieldAlert,
  Layers,
  ShoppingBag,
  Headphones,
  Megaphone,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import {
  listTelegramBotsAction,
  createTelegramBotAction,
  updateTelegramBotAction,
  toggleTelegramBotStatusAction,
  deleteTelegramBotAction,
  testTelegramBotTokenAction
} from '@/actions/admin/telegram-bots-manager';
import {
  BOT_PRESETS,
  type TelegramBotInstanceDTO,
  type TelegramBotRole,
  type BotFlowStep
} from '@/types/telegram-builder';
import type { TelegramMenuButton } from '@/types/telegram';
import { BotFlowBuilder } from './bot-flow-builder';

interface BotConstructorTabProps {
  tenantId: string;
}

const ROLE_ICONS: Record<TelegramBotRole, React.ComponentType<{ className?: string }>> = {
  STORE_FULL: ShoppingBag,
  SUPPORT_ONLY: Headphones,
  NEWS_BROADCAST: Megaphone,
  STAFF_ADMIN: ShieldCheck,
  CUSTOM_BUILDER: Layers
};

const ROLE_COLORS: Record<TelegramBotRole, { bg: string; text: string; border: string }> = {
  STORE_FULL: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' },
  SUPPORT_ONLY: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30' },
  NEWS_BROADCAST: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' },
  STAFF_ADMIN: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/30' },
  CUSTOM_BUILDER: { bg: 'bg-pink-500/10', text: 'text-pink-500', border: 'border-pink-500/30' }
};

export function BotConstructorTab({ tenantId }: BotConstructorTabProps) {
  const [bots, setBots] = useState<TelegramBotInstanceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<TelegramBotRole>('STORE_FULL');
  const [newBotName, setNewBotName] = useState('Бот Продаж SMM');
  const [newBotToken, setNewBotToken] = useState('');
  const [tokenTesting, setTokenTesting] = useState(false);
  const [testedBotInfo, setTestedBotInfo] = useState<{ username: string; first_name: string } | null>(null);

  // Edit Modal State
  const [editingBot, setEditingBot] = useState<TelegramBotInstanceDTO | null>(null);
  const [editTab, setEditTab] = useState<'general' | 'menu' | 'flow' | 'staff'>('general');

  const loadBots = async () => {
    setLoading(true);
    try {
      const res = await listTelegramBotsAction(tenantId);
      if (res.success && res.bots) {
        setBots(res.bots);
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error('Ошибка загрузки списка ботов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBots();
  }, [tenantId]);

  const handleTestToken = async () => {
    if (!newBotToken || newBotToken.length < 15) {
      toast.error('Введите токен от @BotFather перед проверкой');
      return;
    }
    setTokenTesting(true);
    setTestedBotInfo(null);
    try {
      const res = await testTelegramBotTokenAction(newBotToken);
      if (res.success && res.valid && res.bot) {
        setTestedBotInfo({ username: res.bot.username, first_name: res.bot.first_name });
        toast.success(`Токен валиден! Бот: @${res.bot.username}`);
      } else {
        toast.error(res.error || 'Токен не прошел проверку');
      }
    } catch {
      toast.error('Сбой проверки токена');
    } finally {
      setTokenTesting(false);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName.trim()) {
      toast.error('Укажите название бота');
      return;
    }
    if (!newBotToken.trim()) {
      toast.error('Укажите токен бота');
      return;
    }

    startTransition(async () => {
      const res = await createTelegramBotAction({
        name: newBotName,
        token: newBotToken,
        role: selectedPreset,
        tenantId,
        presetKey: selectedPreset
      });

      if (res.success && res.bot) {
        toast.success(`Бот "${res.bot.name}" успешно создан и запущен!`);
        setIsCreateOpen(false);
        setNewBotToken('');
        setTestedBotInfo(null);
        void loadBots();
      } else {
        toast.error(res.error || 'Ошибка создания бота');
      }
    });
  };

  const handleToggleStatus = async (bot: TelegramBotInstanceDTO) => {
    startTransition(async () => {
      const res = await toggleTelegramBotStatusAction(bot.id, !bot.isActive);
      if (res.success) {
        toast.success(bot.isActive ? `Бот "${bot.name}" остановлен` : `Бот "${bot.name}" запущен`);
        void loadBots();
      } else {
        toast.error(res.error || 'Ошибка переключения статуса');
      }
    });
  };

  const handleDeleteBot = async (bot: TelegramBotInstanceDTO) => {
    if (!confirm(`Вы действительно хотите удалить бота "${bot.name}"?`)) return;

    startTransition(async () => {
      const res = await deleteTelegramBotAction(bot.id);
      if (res.success) {
        toast.success(`Бот "${bot.name}" удален`);
        void loadBots();
      } else {
        toast.error(res.error || 'Ошибка удаления бота');
      }
    });
  };

  const handleSaveEdit = async () => {
    if (!editingBot) return;

    startTransition(async () => {
      const res = await updateTelegramBotAction(editingBot.id, {
        name: editingBot.name,
        description: editingBot.description || undefined,
        welcomeMessage: editingBot.welcomeMessage || undefined,
        maintenanceMode: editingBot.maintenanceMode,
        menuConfig: editingBot.menuConfig,
        flowConfig: editingBot.flowConfig,
        allowedUserIds: editingBot.allowedUserIds
      });

      if (res.success) {
        toast.success('Настройки бота успешно сохранены');
        setEditingBot(null);
        void loadBots();
      } else {
        toast.error(res.error || 'Ошибка сохранения');
      }
    });
  };

  const handleAddMenuButton = () => {
    if (!editingBot) return;
    const newBtn: TelegramMenuButton = {
      id: `btn_${Date.now()}`,
      label: 'Новая кнопка',
      action: 'TEXT_REPLY',
      value: 'Ответ на нажатие кнопки',
      row: editingBot.menuConfig.length,
      col: 0,
      isActive: true
    };
    setEditingBot({
      ...editingBot,
      menuConfig: [...editingBot.menuConfig, newBtn]
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-primary text-primary-foreground">
              OmniSMM Bot Builder
            </span>
            <span className="text-xs text-muted-foreground">Мульти-бот платформа</span>
          </div>
          <h2 className="text-lg font-bold text-foreground mt-1 flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Конструктор Telegram-ботов
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Создавайте и запускайте независимых ботов под разные задачи (продажи, саппорт, новости, админ-пульт), настраивайте меню, сценарии и ветвления в 1 клик.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadBots}
            disabled={loading}
            className="p-2 rounded-xl bg-card border border-border hover:bg-muted text-muted-foreground transition-colors"
            title="Обновить список"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm shadow-primary/25"
          >
            <Plus className="w-4 h-4" />
            Создать нового бота
          </button>
        </div>
      </div>

      {/* Bots Grid */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Загрузка привязанных ботов...</p>
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl bg-muted/10 p-8">
          <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-foreground">В этом тенанте пока нет настроенных ботов</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Используйте конструктор, чтобы подключить бота поддержки, бота витрины или новостного бота за пару минут.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
          >
            <Sparkles className="w-4 h-4" /> Выбрать готовый шаблон
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot) => {
            const Icon = ROLE_ICONS[bot.role] || Bot;
            const colors = ROLE_COLORS[bot.role] || ROLE_COLORS.CUSTOM_BUILDER;
            const preset = BOT_PRESETS[bot.role];

            return (
              <div
                key={bot.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-all hover:border-border/80 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl border ${colors.bg} ${colors.border}`}>
                        <Icon className={`w-4 h-4 ${colors.text}`} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground leading-tight">{bot.name}</h4>
                        {bot.username ? (
                          <a
                            href={`https://t.me/${bot.username}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5 mt-0.5"
                          >
                            @{bot.username}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Юзернейм не определен</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {bot.maintenanceMode && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
                          Техобслуживание
                        </span>
                      )}
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          bot.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'
                        }`}
                        title={bot.isOnline ? 'Бот запущен и слушает запросы' : 'Бот остановлен'}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
                      {preset?.title || bot.role}
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded font-mono">
                      Кнопок: {bot.menuConfig?.length || 0}
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded font-mono">
                      Шагов: {bot.flowConfig?.length || 0}
                    </span>
                  </div>

                  {bot.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{bot.description}</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(bot)}
                      disabled={isPending}
                      className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        bot.isActive
                          ? 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                      title={bot.isActive ? 'Остановить бота' : 'Запустить бота'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBot(bot);
                        setEditTab('general');
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted text-foreground hover:bg-muted/80 text-xs font-medium transition-colors"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      Настроить
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteBot(bot)}
                    disabled={isPending}
                    className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Удалить бота"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE BOT MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Создание нового Telegram-бота</h3>
                  <p className="text-xs text-muted-foreground">Выберите шаблон назначения и укажите токен бота</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Preset Selector */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  1. Выберите готовый шаблон (Preset):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(Object.keys(BOT_PRESETS) as TelegramBotRole[]).map((key) => {
                    const p = BOT_PRESETS[key];
                    const Icon = ROLE_ICONS[key];
                    const isSelected = selectedPreset === key;
                    return (
                      <div
                        key={key}
                        onClick={() => {
                          setSelectedPreset(key);
                          setNewBotName(p.title);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border bg-muted/10 hover:border-border/80'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className="text-xs font-bold text-foreground">{p.title}</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium text-muted-foreground">
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{p.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bot Name */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  2. Название бота (для отображения в панели):
                </label>
                <input
                  type="text"
                  required
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  placeholder="Например: Бот заботы о клиентах SMMplan"
                />
              </div>

              {/* Bot Token with Live Validator */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  3. Токен от @BotFather:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    required
                    value={newBotToken}
                    onChange={(e) => setNewBotToken(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                    placeholder="7123456789:AAH_xxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <button
                    type="button"
                    onClick={handleTestToken}
                    disabled={tokenTesting || !newBotToken}
                    className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition-colors shrink-0 flex items-center gap-1.5"
                  >
                    {tokenTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    Проверить
                  </button>
                </div>
                {testedBotInfo && (
                  <div className="mt-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      Бот подтвержден: <b>{testedBotInfo.first_name}</b> (<code>@{testedBotInfo.username}</code>)
                    </span>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  Токен будет надежно зашифрован ключом AES-256-GCM через VaultService.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted text-foreground transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm shadow-primary/25"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Создать и запустить бота
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BOT MODAL / DRAWER */}
      {editingBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  Настройка бота: {editingBot.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Роль: <b>{BOT_PRESETS[editingBot.role]?.title || editingBot.role}</b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingBot(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {/* Edit Sub-Tabs */}
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <button
                type="button"
                onClick={() => setEditTab('general')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  editTab === 'general' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                Основные параметры
              </button>
              <button
                type="button"
                onClick={() => setEditTab('menu')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  editTab === 'menu' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                Кнопки меню ({editingBot.menuConfig?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setEditTab('flow')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  editTab === 'flow' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                Сценарии (Flow) ({editingBot.flowConfig?.length || 0})
              </button>
              {editingBot.role === 'STAFF_ADMIN' && (
                <button
                  type="button"
                  onClick={() => setEditTab('staff')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    editTab === 'staff' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Доступ сотрудников
                </button>
              )}
            </div>

            {/* Tab: General */}
            {editTab === 'general' && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Название бота:</label>
                  <input
                    type="text"
                    value={editingBot.name}
                    onChange={(e) => setEditingBot({ ...editingBot, name: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">Описание назначения:</label>
                  <input
                    type="text"
                    value={editingBot.description || ''}
                    onChange={(e) => setEditingBot({ ...editingBot, description: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">Приветственное сообщение (/start):</label>
                  <textarea
                    rows={4}
                    value={editingBot.welcomeMessage || ''}
                    onChange={(e) => setEditingBot({ ...editingBot, welcomeMessage: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                  <input
                    type="checkbox"
                    id="maint_mode"
                    checked={editingBot.maintenanceMode}
                    onChange={(e) => setEditingBot({ ...editingBot, maintenanceMode: e.target.checked })}
                    className="w-4 h-4 text-primary rounded"
                  />
                  <label htmlFor="maint_mode" className="text-xs font-medium text-foreground cursor-pointer">
                    Включить режим технического обслуживания (бот будет выводить заглушку пользователям)
                  </label>
                </div>
              </div>
            )}

            {/* Tab: Menu Buttons */}
            {editTab === 'menu' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Настройте кнопки нижнего меню Telegram. Действия поддерживают переход в каталог, тикеты, вызов команд или отправку FAQ.
                  </span>
                  <button
                    type="button"
                    onClick={handleAddMenuButton}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="w-3.5 h-3.5" /> Добавить кнопку
                  </button>
                </div>

                <div className="space-y-2">
                  {editingBot.menuConfig.map((btn, idx) => (
                    <div
                      key={btn.id}
                      className="flex items-center gap-2 p-2.5 bg-background border border-border rounded-xl text-xs"
                    >
                      <span className="font-mono text-muted-foreground text-[10px] w-5 text-center">{idx + 1}</span>
                      <input
                        type="text"
                        value={btn.label}
                        onChange={(e) => {
                          const updated = editingBot.menuConfig.map((b) =>
                            b.id === btn.id ? { ...b, label: e.target.value } : b
                          );
                          setEditingBot({ ...editingBot, menuConfig: updated });
                        }}
                        placeholder="Название кнопки"
                        className="flex-1 bg-muted/20 border border-border rounded-lg px-2.5 py-1 text-foreground focus:outline-none"
                      />

                      <select
                        value={btn.action}
                        onChange={(e) => {
                          const updated = editingBot.menuConfig.map((b) =>
                            b.id === btn.id ? { ...b, action: e.target.value as any } : b
                          );
                          setEditingBot({ ...editingBot, menuConfig: updated });
                        }}
                        className="bg-muted/20 border border-border rounded-lg px-2.5 py-1 text-foreground focus:outline-none"
                      >
                        <option value="CATALOG">Каталог услуг</option>
                        <option value="ORDERS">Мои заказы</option>
                        <option value="REFILL">Пополнить баланс</option>
                        <option value="PROFILE">Личный кабинет</option>
                        <option value="SUPPORT">Техподдержка</option>
                        <option value="REFERRALS">Рефералы</option>
                        <option value="URL">Открыть ссылку (URL)</option>
                        <option value="TEXT_REPLY">Отправить FAQ / Текст</option>
                        <option value="COMMAND">Команда (/start, /health)</option>
                      </select>

                      {(btn.action === 'URL' || btn.action === 'TEXT_REPLY' || btn.action === 'COMMAND') && (
                        <input
                          type="text"
                          value={btn.value || ''}
                          onChange={(e) => {
                            const updated = editingBot.menuConfig.map((b) =>
                              b.id === btn.id ? { ...b, value: e.target.value } : b
                            );
                            setEditingBot({ ...editingBot, menuConfig: updated });
                          }}
                          placeholder={btn.action === 'URL' ? 'https://...' : 'Текст ответа'}
                          className="w-48 bg-muted/20 border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingBot.menuConfig.filter((b) => b.id !== btn.id);
                          setEditingBot({ ...editingBot, menuConfig: updated });
                        }}
                        className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Flow Builder */}
            {editTab === 'flow' && (
              <BotFlowBuilder
                steps={editingBot.flowConfig}
                onChange={(steps) => setEditingBot({ ...editingBot, flowConfig: steps })}
              />
            )}

            {/* Tab: Staff Whitelist */}
            {editTab === 'staff' && (
              <div className="space-y-3 text-xs">
                <p className="text-muted-foreground">
                  Укажите Telegram ID сотрудников, которым разрешен доступ к админ-пульту (через запятую):
                </p>
                <textarea
                  rows={3}
                  value={editingBot.allowedUserIds?.join(', ') || ''}
                  onChange={(e) => {
                    const ids = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                    setEditingBot({ ...editingBot, allowedUserIds: ids });
                  }}
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none focus:border-primary"
                  placeholder="268747191, 123456789"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setEditingBot(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted text-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm shadow-primary/25"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Сохранить изменения
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
