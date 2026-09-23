'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useState, useEffect, useTransition, useCallback } from 'react';
import {
  Plus, Trash2, Edit3, Save, X, FileText, Eye, Copy,
  Search, Filter, Tag, Code, Loader2,
} from 'lucide-react';
import {
  listTelegramTemplatesAction,
  createTelegramTemplateAction,
  updateTelegramTemplateAction,
  deleteTelegramTemplateAction,
} from '@/actions/admin/telegram-bot';
import type { TelegramTemplate, TemplateCategory, ParseMode } from '@/types/telegram';
import { TEMPLATE_VARIABLES } from '@/types/telegram';

interface FormData {
  name: string;
  slug: string;
  description: string;
  body: string;
  parseMode: ParseMode;
  category: TemplateCategory;
  isActive: boolean;
}

const EMPTY_FORM: FormData = {
  name: '', slug: '', description: '', body: '',
  parseMode: 'HTML', category: 'general', isActive: true,
};

const CATEGORIES: { value: TemplateCategory; label: string; color: string }[] = [
  { value: 'general', label: 'Общие', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  { value: 'order', label: 'Заказы', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { value: 'payment', label: 'Оплата', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { value: 'support', label: 'Поддержка', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { value: 'notification', label: 'Уведомления', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { value: 'error', label: 'Ошибки', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
];

export function TemplateManager() {
  const [templates, setTemplates] = useState<TelegramTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTelegramTemplatesAction(filterCategory);
      if (Array.isArray(res)) setTemplates(res);
      else if (res && !res.success) toast.error(res.error || 'Ошибка загрузки шаблонов');
    } catch (err) { toast.error(String(err)); }
    finally { setLoading(false); }
  }, [filterCategory]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createTelegramTemplateAction(form);
      toast[res.success ? 'success' : 'error'](res.success ? res.message! : res.error!);
      if (res.success) { setForm(EMPTY_FORM); setShowCreate(false); loadTemplates(); }
    });
  };

  const handleUpdate = () => {
    if (!editingId) return;
    startTransition(async () => {
      const res = await updateTelegramTemplateAction({ id: editingId, ...form });
      toast[res.success ? 'success' : 'error'](res.success ? res.message! : res.error!);
      if (res.success) { setEditingId(null); loadTemplates(); }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Удалить шаблон "${name}"?`)) return;
    startTransition(async () => {
      const res = await deleteTelegramTemplateAction(id);
      toast[res.success ? 'success' : 'error'](res.success ? res.message! : res.error!);
      if (res.success) loadTemplates();
    });
  };

  const startEdit = (t: TelegramTemplate) => {
    setEditingId(t.id);
    setForm({ name: t.name, slug: t.slug, description: t.description, body: t.body, parseMode: t.parseMode, category: t.category, isActive: t.isActive });
  };

  const filtered = templates.filter(t =>
    !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.slug.includes(searchQuery.toLowerCase())
  );

  const editingVars = TEMPLATE_VARIABLES[form.category] || [];
  const isEditing = editingId !== null;

  return (
    <div className="space-y-6">
      {/* Filters & Search */}
      <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="p-1 px-2.5 bg-pink-500/10 text-pink-400 rounded-md text-[10px] font-bold">TMPL</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Шаблоны сообщений ({templates.length})</h3>
          </div>
          <Button type="button" intent="secondary" size="sm" onClick={() => { setShowCreate(true); setForm(EMPTY_FORM); }} className="font-bold text-xs h-8 gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Создать
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Поиск по имени или slug..." className="pl-9 text-xs" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            <button type="button" onClick={() => setFilterCategory('all')} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${filterCategory === 'all' ? 'bg-primary/10 text-primary border-primary/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>
              Все
            </button>
            {CATEGORIES.map(c => (
              <button key={c.value} type="button" onClick={() => setFilterCategory(c.value)} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${filterCategory === c.value ? c.color : 'border-border text-muted-foreground hover:bg-muted'}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Templates List */}
      <div className="space-y-3">
        {loading ? (
          <Card className="rounded-2xl p-8 text-center"><p className="text-xs text-muted-foreground">Загрузка шаблонов...</p></Card>
        ) : filtered.length === 0 ? (
          <Card className="rounded-2xl p-8 text-center"><p className="text-xs text-muted-foreground">Шаблоны не найдены</p></Card>
        ) : (
          filtered.map(t => {
            const cat = CATEGORIES.find(c => c.value === t.category);
            const isPreview = previewId === t.id;
            return (
              <Card key={t.id} className={`rounded-2xl border overflow-hidden transition-colors ${!t.isActive ? 'opacity-50' : ''}`}>
                <div className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-foreground">{t.name}</h4>
                      <code className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{t.slug}</code>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${cat?.color || ''}`}>{cat?.label}</span>
                      <span className="text-[9px] font-mono text-muted-foreground">v{t.version}</span>
                      <span className="text-[9px] font-mono text-muted-foreground">{t.parseMode}</span>
                    </div>
                    {t.description && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{t.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono line-clamp-2">{t.body.substring(0, 120)}{t.body.length > 120 ? '...' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => { navigator.clipboard.writeText(t.body); toast.success('Скопировано'); }} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer" title="Копировать"><Copy className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => setPreviewId(isPreview ? null : t.id)} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer" title="Предпросмотр"><Eye className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer" title="Редактировать"><Edit3 className="w-3.5 h-3.5 text-blue-400" /></button>
                    <button type="button" onClick={() => handleDelete(t.id, t.name)} className="p-1.5 rounded-lg hover:bg-rose-500/10 cursor-pointer" title="Удалить"><Trash2 className="w-3.5 h-3.5 text-rose-400" /></button>
                  </div>
                </div>
                {isPreview && (
                  <div className="px-4 pb-4 border-t border-border/40 pt-3">
                    <div className="p-3 rounded-xl bg-zinc-950 text-zinc-200">
                      <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans">{t.body.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')}</pre>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Create / Edit Form */}
      {(showCreate || isEditing) && (
        <Card className="rounded-3xl border border-primary/30 shadow-lg bg-card p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">{isEditing ? 'Редактировать шаблон' : 'Новый шаблон'}</h3>
            <button type="button" onClick={() => { setShowCreate(false); setEditingId(null); setForm(EMPTY_FORM); }} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Название *</Label>
              <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Приветствие нового клиента" maxLength={128} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Slug *</Label>
              <Input value={form.slug} onChange={(e) => setForm(p => ({ ...p, slug: e.target.value.replace(/[^a-z0-9_]/g, '').toLowerCase() }))} placeholder="welcome_new" className="font-mono text-xs" maxLength={64} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Описание</Label>
              <Input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Краткое описание шаблона" maxLength={512} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Категория</Label>
              <select value={form.category} onChange={(e) => setForm(p => ({ ...p, category: e.target.value as TemplateCategory }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Parse Mode</Label>
              <select value={form.parseMode} onChange={(e) => setForm(p => ({ ...p, parseMode: e.target.value as ParseMode }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none">
                <option value="HTML">HTML</option>
                <option value="Markdown">Markdown</option>
                <option value="MarkdownV2">MarkdownV2</option>
              </select>
            </div>
          </div>

          {/* Variable Chips for Selected Category */}
          <div className="space-y-2">
            <span className="text-[10px] text-muted-foreground">Переменные для категории "{CATEGORIES.find(c => c.value === form.category)?.label}":</span>
            <div className="flex flex-wrap gap-1.5">
              {editingVars.map(v => (
                <button key={v.name} type="button" onClick={() => setForm(p => ({ ...p, body: p.body + ' ' + v.name }))} className="text-[10px] font-mono font-bold bg-muted/60 hover:bg-muted text-primary px-2 py-1 rounded-lg border border-border transition-colors cursor-pointer" title={v.description}>
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Тело шаблона *</Label>
              <span className={`text-[10px] font-mono ${form.body.length > 8000 ? 'text-rose-400' : 'text-muted-foreground'}`}>{form.body.length} / 8000</span>
            </div>
            <Textarea value={form.body} onChange={(e) => setForm(p => ({ ...p, body: e.target.value }))} rows={12} className="font-mono text-xs leading-relaxed" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setEditingId(null); setForm(EMPTY_FORM); }} className="text-xs">Отмена</Button>
            <Button type="button" onClick={isEditing ? handleUpdate : handleCreate} disabled={isPending || !form.name || !form.slug || !form.body} className="font-bold text-xs gap-1.5 cursor-pointer">
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isEditing ? 'Обновить' : 'Создать'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
