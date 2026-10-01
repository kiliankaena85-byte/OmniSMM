'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useState, useEffect, useTransition, useCallback } from 'react';
import {
  Plus, Trash2, GripVertical, Edit3, Eye, EyeOff, Save, X,
  LayoutGrid, ArrowUp, ArrowDown, Sparkles, Link, Lock, Loader2,
} from 'lucide-react';
import {
  listTelegramButtonsAction,
  createTelegramButtonAction,
  updateTelegramButtonAction,
  deleteTelegramButtonAction,
} from '@/actions/admin/telegram-bot';
import type { TelegramButton, TelegramBotDiagnostics } from '@/types/telegram';

interface Props {
  diagnostics: TelegramBotDiagnostics | null;
  onRefresh: () => void;
}

interface ButtonFormData {
  label: string;
  emoji: string;
  command: string;
  description: string;
  row: number;
  col: number;
  isVisible: boolean;
  isNew: boolean;
  requiresAuth: boolean;
  openUrl: string;
  style: 'default' | 'primary' | 'danger';
}

const EMPTY_FORM: ButtonFormData = {
  label: '', emoji: '', command: '', description: '',
  row: 0, col: 0, isVisible: true, isNew: false,
  requiresAuth: false, openUrl: '', style: 'default',
};

const COMMAND_SUGGESTIONS = [
  { cmd: 'catalog', label: 'Каталог услуг', emoji: '\u{1F6CD}' },
  { cmd: 'orders', label: 'Мои заказы', emoji: '\u{1F4E6}' },
  { cmd: 'deposit', label: 'Пополнить', emoji: '\u{1F4B0}' },
  { cmd: 'profile', label: 'Профиль', emoji: '\u{1F464}' },
  { cmd: 'support', label: 'Поддержка', emoji: '\u{1F198}' },
  { cmd: 'referral', label: 'Рефералы', emoji: '\u{1F465}' },
  { cmd: 'balance', label: 'Баланс', emoji: '\u{1F4B3}' },
  { cmd: 'help', label: 'Помощь', emoji: '\u{2753}' },
];

export function ButtonManager({ diagnostics, onRefresh }: Props) {
  const [buttons, setButtons] = useState<TelegramButton[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ButtonFormData>(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadButtons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTelegramButtonsAction();
      if (Array.isArray(res)) setButtons(res);
      else if (res && !res.success) toast.error(res.error || 'Ошибка загрузки кнопок');
    } catch (err) { toast.error(String(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadButtons(); }, [loadButtons]);

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createTelegramButtonAction(form);
      toast[res.success ? 'success' : 'error'](res.success ? res.message! : res.error!);
      if (res.success) {
        setForm(EMPTY_FORM);
        setShowCreate(false);
        loadButtons();
        onRefresh();
      }
    });
  };

  const handleUpdate = () => {
    if (!editingId) return;
    startTransition(async () => {
      const res = await updateTelegramButtonAction({ id: editingId, ...form });
      toast[res.success ? 'success' : 'error'](res.success ? res.message! : res.error!);
      if (res.success) { setEditingId(null); loadButtons(); }
    });
  };

  const handleDelete = (id: string, label: string) => {
    if (!confirm(`Удалить кнопку "${label}"?`)) return;
    startTransition(async () => {
      const res = await deleteTelegramButtonAction(id);
      toast[res.success ? 'success' : 'error'](res.success ? res.message! : res.error!);
      if (res.success) { loadButtons(); onRefresh(); }
    });
  };

  const startEdit = (btn: TelegramButton) => {
    setEditingId(btn.id);
    setForm({
      label: btn.label, emoji: btn.emoji, command: btn.command,
      description: btn.description, row: btn.row, col: btn.col,
      isVisible: btn.isVisible, isNew: btn.isNew,
      requiresAuth: btn.requiresAuth, openUrl: btn.openUrl || '', style: btn.style,
    });
  };

  const toggleVisibility = (btn: TelegramButton) => {
    startTransition(async () => {
      const res = await updateTelegramButtonAction({ id: btn.id, isVisible: !btn.isVisible });
      if (res.success) loadButtons(); else toast.error(res.error!);
    });
  };

  const moveButton = (btn: TelegramButton, direction: 'up' | 'down') => {
    const idx = buttons.findIndex(b => b.id === btn.id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= buttons.length) return;
    const updated = [...buttons];
    const temp = { sortOrder: updated[idx].sortOrder };
    updated[idx] = { ...updated[idx], sortOrder: updated[targetIdx].sortOrder };
    updated[targetIdx] = { ...updated[targetIdx], sortOrder: temp.sortOrder };
    setButtons(updated);
  };

  // Group buttons by row for visual layout
  const rows = buttons.reduce<Record<number, TelegramButton[]>>((acc, btn) => {
    if (!acc[btn.row]) acc[btn.row] = [];
    acc[btn.row].push(btn);
    return acc;
  }, {});
  const sortedRows = Object.keys(rows).sort((a, b) => Number(a) - Number(b));

  const isEditing = editingId !== null;

  return (
    <div className="space-y-6">
      {/* Layout Preview */}
      <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <span className="p-1 px-2.5 bg-cyan-500/10 text-cyan-400 rounded-md text-[10px] font-bold">LAYOUT</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Раскладка кнопок ({buttons.length})</h3>
          </div>
          <Button type="button" intent="secondary" size="sm" onClick={() => { setShowCreate(true); setForm(EMPTY_FORM); }} className="font-bold text-xs h-8 gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Добавить
          </Button>
        </div>

        {/* Visual Telegram Keyboard Preview */}
        <div className="max-w-md mx-auto p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <p className="text-[10px] text-zinc-500 font-mono text-center mb-3">Предпросмотр клавиатуры Telegram</p>
          {sortedRows.length === 0 && (
            <p className="text-zinc-600 text-xs text-center py-8">Нет кнопок. Нажмите "Добавить" для создания.</p>
          )}
          {sortedRows.map((rowKey) => (
            <div key={rowKey} className="grid grid-cols-2 gap-1.5">
              {rows[Number(rowKey)]
                .sort((a, b) => a.col - b.col)
                .map((btn) => (
                  <div
                    key={btn.id}
                    className={`p-2.5 rounded-xl text-white text-[11px] font-bold text-center border shadow-xs transition-opacity cursor-default ${
                      !btn.isVisible ? 'opacity-30' :
                      btn.style === 'primary' ? 'bg-blue-600 border-blue-500' :
                      btn.style === 'danger' ? 'bg-rose-600 border-rose-500' :
                      'bg-zinc-800 border-zinc-700'
                    }`}
                  >
                    {btn.emoji} {btn.label}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </Card>

      {/* Button List (Sortable Table-like) */}
      <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
          <span className="p-1 px-2.5 bg-purple-500/10 text-purple-400 rounded-md text-[10px] font-bold">MANAGE</span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Управление кнопками</h3>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Загрузка...</div>
        ) : (
          <div className="space-y-2">
            {buttons.sort((a, b) => a.sortOrder - b.sortOrder).map((btn, idx) => (
              <div key={btn.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                editingId === btn.id ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/20'
              }`}>
                <div className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => moveButton(btn, 'up')} disabled={idx === 0} className="p-0.5 hover:text-primary disabled:opacity-20 cursor-pointer"><ArrowUp className="w-3 h-3" /></button>
                  <button type="button" onClick={() => moveButton(btn, 'down')} disabled={idx === buttons.length - 1} className="p-0.5 hover:text-primary disabled:opacity-20 cursor-pointer"><ArrowDown className="w-3 h-3" /></button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{btn.emoji}</span>
                    <span className="text-xs font-bold text-foreground truncate">{btn.label}</span>
                    <code className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">/{btn.command}</code>
                    {btn.isNew && <Sparkles className="w-3 h-3 text-amber-400" />}
                    {btn.requiresAuth && <Lock className="w-3 h-3 text-rose-400" />}
                    {btn.openUrl && <Link className="w-3 h-3 text-blue-400" />}
                    {!btn.isVisible && <span className="text-[9px] font-bold text-zinc-500 uppercase">hidden</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    Ряд {btn.row}, Кол {btn.col} • {btn.description || 'Без описания'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => toggleVisibility(btn)} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer" title={btn.isVisible ? 'Скрыть' : 'Показать'}>
                    {btn.isVisible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-500" />}
                  </button>
                  <button type="button" onClick={() => startEdit(btn)} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer" title="Редактировать">
                    <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                  <button type="button" onClick={() => handleDelete(btn.id, btn.label)} className="p-1.5 rounded-lg hover:bg-rose-500/10 cursor-pointer" title="Удалить">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create / Edit Form Modal-like Card */}
      {(showCreate || isEditing) && (
        <Card className="rounded-3xl border border-primary/30 shadow-lg bg-card p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              {isEditing ? 'Редактировать кнопку' : 'Новая кнопка'}
            </h3>
            <button type="button" onClick={() => { setShowCreate(false); setEditingId(null); setForm(EMPTY_FORM); }} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Эмодзи</Label>
              <Input value={form.emoji} onChange={(e) => setForm(p => ({ ...p, emoji: e.target.value }))} placeholder="\u{1F6CD}" className="text-center text-xl" maxLength={8} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Название *</Label>
              <Input value={form.label} onChange={(e) => setForm(p => ({ ...p, label: e.target.value }))} placeholder="Каталог услуг" maxLength={64} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Команда *</Label>
              <Input value={form.command} onChange={(e) => setForm(p => ({ ...p, command: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }))} placeholder="catalog" className="font-mono text-xs" maxLength={128} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Стиль</Label>
              <select value={form.style} onChange={(e) => setForm(p => ({ ...p, style: e.target.value as ButtonFormData['style'] }))}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none">
                <option value="default">Default</option>
                <option value="primary">Primary (синий)</option>
                <option value="danger">Danger (красный)</option>
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={form.isVisible} onCheckedChange={(c) => setForm(p => ({ ...p, isVisible: !!c }))} />
                  <span className="text-[10px] text-muted-foreground">Видимая</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={form.requiresAuth} onCheckedChange={(c) => setForm(p => ({ ...p, requiresAuth: !!c }))} />
                  <span className="text-[10px] text-muted-foreground">Требует авторизацию</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ряд (0-9)</Label>
              <Input type="number" min={0} max={9} value={form.row} onChange={(e) => setForm(p => ({ ...p, row: Number(e.target.value) }))} className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Колонка (0-2)</Label>
              <Input type="number" min={0} max={2} value={form.col} onChange={(e) => setForm(p => ({ ...p, col: Number(e.target.value) }))} className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">URL (для inline кнопок)</Label>
              <Input value={form.openUrl} onChange={(e) => setForm(p => ({ ...p, openUrl: e.target.value }))} placeholder="https://..." className="font-mono text-xs" />
            </div>

            <div className="sm:col-span-3 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Описание</Label>
              <Input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Внутреннее описание кнопки" maxLength={256} />
            </div>
          </div>

          {/* Quick Suggestions */}
          {!isEditing && (
            <div className="space-y-2">
              <span className="text-[10px] text-muted-foreground">Быстрые пресеты:</span>
              <div className="flex flex-wrap gap-1.5">
                {COMMAND_SUGGESTIONS.map((s) => (
                  <button key={s.cmd} type="button" onClick={() => setForm(p => ({ ...p, label: s.label, emoji: s.emoji, command: s.cmd }))}
                    className="text-[10px] font-bold bg-muted/60 hover:bg-muted text-foreground px-2 py-1 rounded-lg border border-border transition-colors cursor-pointer">
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setEditingId(null); setForm(EMPTY_FORM); }} className="text-xs">
              Отмена
            </Button>
            <Button type="button" onClick={isEditing ? handleUpdate : handleCreate} disabled={isPending || !form.label || !form.command} className="font-bold text-xs gap-1.5 cursor-pointer">
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isEditing ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
