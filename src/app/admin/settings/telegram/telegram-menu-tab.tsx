'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  RotateCcw, 
  Save, 
  Loader2, 
  MoveUp, 
  MoveDown, 
  ExternalLink, 
  MessageSquare, 
  ShoppingBag, 
  Package, 
  Wallet, 
  User, 
  HelpCircle, 
  Users,
  Smartphone,
  Zap,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { saveTelegramMenuConfigAction } from '@/actions/admin/telegram-bot';
import { 
  type TelegramMenuButton, 
  type TelegramMenuButtonAction, 
  DEFAULT_TELEGRAM_MENU_BUTTONS,
} from '@/types/telegram';

interface TelegramMenuTabProps {
  initialButtons: TelegramMenuButton[];
  onButtonsChange?: (buttons: TelegramMenuButton[]) => void;
  tenantId?: string;
}

const ACTION_LABELS: Record<TelegramMenuButtonAction, { label: string; icon: React.ComponentType<{ className?: string }>; desc: string }> = {
  FAST_ORDER: { label: 'Быстрый заказ по ссылке', icon: Zap, desc: 'Запрашивает ссылку на соцсеть и запускает быстрый заказ' },
  CATALOG: { label: 'Каталог услуг', icon: ShoppingBag, desc: 'Открывает интерактивное меню выбора соцсетей и услуг' },
  ORDERS: { label: 'Мои заказы', icon: Package, desc: 'Показывает последние 5 активных заказов пользователя' },
  REFILL: { label: 'Пополнить баланс', icon: Wallet, desc: 'Запускает пошаговый мастер пополнения (ЮKassa/Crypto)' },
  PROFILE: { label: 'Профиль пользователя', icon: User, desc: 'Выводит ID, баланс, реферальный код и статистику' },
  SUPPORT: { label: 'Служба поддержки', icon: HelpCircle, desc: 'Переводит бота в режим прямого чата с оператором' },
  REFERRALS: { label: 'Реферальная программа', icon: Users, desc: 'Генерирует реферальную ссылку и процент отчислений' },
  URL: { label: 'Внешняя ссылка (URL)', icon: ExternalLink, desc: 'Отправляет кликабельную ссылку на внешний сайт' },
  WEB_APP: { label: 'Telegram Mini App (Web)', icon: Smartphone, desc: 'Открывает Web App версию платформы внутри Telegram' },
  COMMAND: { label: 'Системная команда', icon: Zap, desc: 'Выполняет команду бота (например, /start, /help)' },
  TEXT_REPLY: { label: 'Быстрый автоответ (FAQ)', icon: MessageSquare, desc: 'Отправляет готовый текст или инструкцию клиенту' },
};

export function TelegramMenuTab({ initialButtons, onButtonsChange, tenantId = 'smmplan' }: TelegramMenuTabProps) {
  const [buttons, setButtons] = React.useState<TelegramMenuButton[]>(
    Array.isArray(initialButtons) && initialButtons.length > 0 ? initialButtons : DEFAULT_TELEGRAM_MENU_BUTTONS
  );
  const [isSaving, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (Array.isArray(initialButtons) && initialButtons.length > 0) {
      setButtons(initialButtons);
    }
  }, [initialButtons, tenantId]);

  const updateButtons = (newButtons: TelegramMenuButton[]) => {
    setButtons(newButtons);
    onButtonsChange?.(newButtons);
  };

  const handleAddButton = () => {
    const maxRow = buttons.reduce((max, b) => Math.max(max, b.row), 0);
    const lastRowButtons = buttons.filter(b => b.row === maxRow);
    let newRow = maxRow;
    let newCol = 0;

    if (lastRowButtons.length < 2) {
      newCol = lastRowButtons.length;
    } else {
      newRow = maxRow + 1;
      newCol = 0;
    }

    const newBtn: TelegramMenuButton = {
      id: `btn_${Date.now()}`,
      label: '✨ Новая кнопка',
      action: 'TEXT_REPLY',
      row: newRow,
      col: newCol,
      value: 'Информация о сервисе SMMplan.',
      isActive: true,
    };

    updateButtons([...buttons, newBtn]);
    toast.success('Кнопка добавлена в меню');
  };

  const handleRemoveButton = (id: string) => {
    const filtered = buttons.filter(b => b.id !== id);
    const reindexed = reindexButtons(filtered);
    updateButtons(reindexed);
    toast.info('Кнопка удалена');
  };

  const handleUpdateButton = (id: string, updates: Partial<TelegramMenuButton>) => {
    const updated = buttons.map(b => (b.id === id ? { ...b, ...updates } : b));
    updateButtons(updated);
  };

  const handleMoveRow = (id: string, direction: 'up' | 'down') => {
    const target = buttons.find(b => b.id === id);
    if (!target) return;

    const newRow = direction === 'up' ? Math.max(0, target.row - 1) : target.row + 1;
    if (newRow === target.row) return;

    const updated = buttons.map(b => {
      if (b.id === id) return { ...b, row: newRow };
      if (b.row === newRow && b.col === target.col) return { ...b, row: target.row };
      return b;
    });

    updateButtons(reindexButtons(updated));
  };

  const handleResetDefaults = () => {
    if (confirm('Сбросить все кнопки меню к стандартному набору из 6 системных кнопок?')) {
      updateButtons(DEFAULT_TELEGRAM_MENU_BUTTONS);
      toast.info('Кнопки меню сброшены к стандартным');
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await saveTelegramMenuConfigAction(buttons, tenantId);
        if (res.success) {
          toast.success(res.message);
        } else {
          toast.error(res.error || 'Ошибка при сохранении кнопок');
        }
      } catch (err) {
        toast.error(String(err));
      }
    });
  };

  const rowsMap = new Map<number, TelegramMenuButton[]>();
  for (const b of buttons) {
    if (!rowsMap.has(b.row)) rowsMap.set(b.row, []);
    rowsMap.get(b.row)!.push(b);
  }
  const sortedRowKeys = Array.from(rowsMap.keys()).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-muted/20 border border-border/60">
        <div>
          <h3 className="text-sm font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            Конструктор Telegram Reply Keyboard
          </h3>
          <p className="text-xs text-muted-foreground">
            Настройте сетку кнопок главного меню, действия при нажатии и быстрые ответы бота.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            intent="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="text-xs font-bold gap-1.5 h-9 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
            Сброс
          </Button>

          <Button
            type="button"
            intent="secondary"
            size="sm"
            onClick={handleAddButton}
            className="text-xs font-bold gap-1.5 h-9 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            Добавить кнопку
          </Button>

          <Button
            type="button"
            intent="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs font-bold gap-1.5 h-9 shadow-md shadow-primary/20 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Сохранить меню
          </Button>
        </div>
      </div>

      {/* Grid of Rows */}
      <div className="space-y-4">
        {sortedRowKeys.map((rowKey, rowIdx) => {
          const rowBtns = rowsMap.get(rowKey)!.sort((a, b) => a.col - b.col);
          return (
            <div key={rowKey} className="p-4 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground pb-2 border-b border-border/40">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center font-mono text-[10px] text-foreground">
                    {rowIdx + 1}
                  </span>
                  Ряд {rowIdx + 1} (кнопок: {rowBtns.length})
                </span>
                <span className="text-[10px] text-muted-foreground">Максимум 2 кнопки в ряду для идеальной читаемости</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rowBtns.map(btn => {
                  const actionMeta = ACTION_LABELS[btn.action] || ACTION_LABELS.CATALOG;
                  const Icon = actionMeta.icon;
                  const isCustomPayload = ['URL', 'WEB_APP', 'COMMAND', 'TEXT_REPLY'].includes(btn.action);

                  return (
                    <div
                      key={btn.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        btn.isActive
                          ? 'bg-muted/10 border-border/80 hover:border-primary/40'
                          : 'bg-muted/30 border-dashed border-border/60 opacity-60'
                      }`}
                    >
                      {/* Top Bar of Button */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <input
                              type="text"
                              value={btn.label}
                              onChange={e => handleUpdateButton(btn.id, { label: e.target.value })}
                              className="font-bold text-xs bg-transparent border-b border-dashed border-border/80 focus:border-primary focus:outline-none w-full text-foreground"
                              placeholder="Текст на кнопке..."
                            />
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateButton(btn.id, { isActive: !btn.isActive })}
                            title={btn.isActive ? 'Кнопка активна' : 'Кнопка скрыта'}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            {btn.isActive ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveRow(btn.id, 'up')}
                            disabled={rowIdx === 0}
                            title="Поднять ряд выше"
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 cursor-pointer"
                          >
                            <MoveUp className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveRow(btn.id, 'down')}
                            disabled={rowIdx === sortedRowKeys.length - 1}
                            title="Опустить ряд ниже"
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 cursor-pointer"
                          >
                            <MoveDown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveButton(btn.id)}
                            title="Удалить кнопку"
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Action Selector */}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Действие при нажатии</Label>
                        <select
                          value={btn.action}
                          onChange={e => handleUpdateButton(btn.id, { action: e.target.value as TelegramMenuButtonAction })}
                          className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                        >
                          {Object.entries(ACTION_LABELS).map(([actionKey, meta]) => (
                            <option key={actionKey} value={actionKey}>
                              {meta.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-muted-foreground">{actionMeta.desc}</p>
                      </div>

                      {/* Custom Payload/URL Value */}
                      {isCustomPayload && (
                        <div className="space-y-1.5 pt-1">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                            {btn.action === 'URL' && 'Адрес внешней ссылки (https://...)'}
                            {btn.action === 'WEB_APP' && 'URL Telegram Web App'}
                            {btn.action === 'COMMAND' && 'Команда бота (например, /bonus)'}
                            {btn.action === 'TEXT_REPLY' && 'Текст ответа клиенту'}
                          </Label>
                          <Input
                            value={btn.value || ''}
                            onChange={e => handleUpdateButton(btn.id, { value: e.target.value })}
                            placeholder={
                              btn.action === 'URL'
                                ? 'https://smmplan.pro/catalog'
                                : btn.action === 'WEB_APP'
                                ? 'https://smmplan.pro/client-demo'
                                : btn.action === 'COMMAND'
                                ? '/catalog'
                                : 'Введите текст ответа бота...'
                            }
                            className="font-mono text-xs"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function reindexButtons(btns: TelegramMenuButton[]): TelegramMenuButton[] {
  const sorted = [...btns].sort((a, b) => a.row - b.row || a.col - b.col);
  const result: TelegramMenuButton[] = [];
  let currentRow = 0;
  let currentCol = 0;

  for (const b of sorted) {
    if (currentCol >= 2) {
      currentRow++;
      currentCol = 0;
    }
    result.push({
      ...b,
      row: currentRow,
      col: currentCol,
    });
    currentCol++;
  }

  return result;
}
