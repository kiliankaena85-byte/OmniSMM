'use client';

import { useState, useTransition, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { upsertTemplate, deleteTemplate } from '@/actions/support/template';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Search } from 'lucide-react';

const CATEGORY_OPTIONS = [
  { value: 'GENERAL', label: '📋 Общие' },
  { value: 'ORDER', label: '📦 Заказы' },
  { value: 'PAYMENT', label: '💳 Оплата и возвраты' },
  { value: 'LEGAL', label: '⚖️ Юридические / 152-ФЗ' },
  { value: 'ACCOUNT', label: '👤 Аккаунт и доступ' },
] as const;

const SMART_TAGS = [
  '{user_name}',
  '{order_id}',
  '{service_name}',
  '{order_status}',
  '{ticket_id}',
  '{current_date}',
] as const;

export type Template = {
  id: string;
  shortcut?: string | null;
  label: string;
  text: string;
  category?: string;
  isActive?: boolean;
  useCount?: number;
  sort: number;
};

export default function TemplateManagerModal({ 
  open, 
  onClose, 
  templates 
}: { 
  open: boolean; 
  onClose: () => void; 
  templates: Template[] 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [isPending, startTransition] = useTransition();

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase().trim();
    return templates.filter(t => 
      t.label.toLowerCase().includes(q) ||
      (t.shortcut && t.shortcut.toLowerCase().includes(q)) ||
      t.text.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  if (!open) return null;

  const handleEdit = (tmpl: Template) => {
    setEditingId(tmpl.id);
    setLabel(tmpl.label);
    setText(tmpl.text);
    setShortcut(tmpl.shortcut ?? '');
    setCategory(tmpl.category ?? 'GENERAL');
  };

  const handleCreateNew = () => {
    setEditingId('new');
    setLabel('');
    setText('');
    setShortcut('');
    setCategory('GENERAL');
  };

  const handleSave = () => {
    if (!label.trim() || !text.trim()) return;

    startTransition(async () => {
      const fd = new FormData();
      if (editingId && editingId !== 'new') fd.set('id', editingId);
      fd.set('label', label);
      fd.set('text', text);
      fd.set('shortcut', shortcut);
      fd.set('category', category);
      fd.set('sort', '0');
      
      await upsertTemplate(fd);
      setEditingId(null);
    });
  };

  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  const handleDeleteTrigger = (id: string) => {
    setDeletingTemplateId(id);
  };

  const handleConfirmDelete = () => {
    if (!deletingTemplateId) return;
    const id = deletingTemplateId;
    setDeletingTemplateId(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', id);
      await deleteTemplate(fd);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/60 flex items-center justify-center p-4 backdrop-blur-sm shadow-2xl">
      <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-border shadow-2xl">
        
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span>⚡</span> Управление шаблонами ответов
          </h2>
          <Button intent="ghost" size="sm" onClick={onClose} aria-label="Закрыть" className="rounded-full w-8 h-8 p-0 text-muted-foreground hover:text-foreground transition-all duration-200">✕</Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-background space-y-4">
          
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Поиск по названию, шорткату или тексту..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-border rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-muted/30 text-foreground"
              />
            </div>
            {editingId !== 'new' && (
              <Button size="sm" onClick={handleCreateNew} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-xs shrink-0 text-xs font-bold">
                + Добавить шаблон
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {editingId === 'new' && (
              <div className="p-5 bg-card border-2 border-primary/40 rounded-2xl shadow-md relative animate-in fade-in">
                <div className="text-xs font-extrabold text-primary uppercase tracking-wider mb-3">✨ Новый шаблон</div>
                <input 
                  type="text" 
                  placeholder="Название кнопки (напр. '👋 Приветствие' или '🛡️ 152-ФЗ')" 
                  value={label} 
                  onChange={e => setLabel(e.target.value)}
                  aria-label="Метка шаблона"
                  className="w-full text-xs font-medium border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-3 bg-muted/30 text-foreground transition-all"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input 
                    type="text" 
                    placeholder="Шорткат (напр. delete_self)" 
                    value={shortcut} 
                    onChange={e => setShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    aria-label="Шорткат шаблона"
                    className="w-full text-xs font-mono border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-muted/30 text-foreground transition-all"
                  />
                  <select 
                    value={category} 
                    onChange={e => setCategory(e.target.value)}
                    aria-label="Категория шаблона"
                    className="w-full text-xs border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-muted/30 text-foreground transition-all"
                  >
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <textarea 
                  placeholder="Текст ответа..." 
                  value={text} 
                  onChange={e => setText(e.target.value)}
                  aria-label="Текст шаблона"
                  className="w-full text-xs border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[100px] resize-y bg-muted/30 text-foreground leading-relaxed transition-all"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-muted-foreground font-semibold">Вставить переменную:</span>
                  {SMART_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setText(prev => prev + tag)}
                      className="text-[9px] font-mono font-bold bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground px-1.5 py-0.5 rounded transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 justify-end mt-4">
                  <Button intent="outline" size="sm" onClick={() => setEditingId(null)} aria-label="Отменить создание" className="rounded-xl border-border text-xs">Отмена</Button>
                  <Button size="sm" onClick={handleSave} disabled={isPending || !label.trim() || !text.trim()} aria-label="Сохранить шаблон" className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold">
                    {isPending ? 'Сохранение...' : 'Сохранить шаблон'}
                  </Button>
                </div>
              </div>
            )}

            {filteredTemplates.length === 0 && editingId !== 'new' && (
              <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-card">
                {searchQuery ? 'Ничего не найдено по запросу' : 'Шаблонов пока нет. Добавьте первый!'}
              </div>
            )}

            {filteredTemplates.map(tmpl => (
              <div key={tmpl.id}>
                {editingId === tmpl.id ? (
                  <div className="p-5 bg-card border-2 border-primary/40 rounded-2xl shadow-md relative animate-in fade-in">
                    <div className="text-xs font-extrabold text-primary uppercase tracking-wider mb-3">✏️ Редактирование шаблона</div>
                    <input 
                      type="text" 
                      placeholder="Название кнопки" 
                      value={label} 
                      onChange={e => setLabel(e.target.value)}
                      aria-label="Метка шаблона"
                      className="w-full text-xs font-medium border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-3 bg-muted/30 text-foreground transition-all"
                    />
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <input 
                        type="text" 
                        placeholder="Шорткат (напр. delete_self)" 
                        value={shortcut} 
                        onChange={e => setShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                        aria-label="Шорткат шаблона"
                        className="w-full text-xs font-mono border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-muted/30 text-foreground transition-all"
                      />
                      <select 
                        value={category} 
                        onChange={e => setCategory(e.target.value)}
                        aria-label="Категория шаблона"
                        className="w-full text-xs border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-muted/30 text-foreground transition-all"
                      >
                        {CATEGORY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <textarea 
                      placeholder="Текст ответа" 
                      value={text} 
                      onChange={e => setText(e.target.value)}
                      aria-label="Текст шаблона"
                      className="w-full text-xs border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[100px] resize-y bg-muted/30 text-foreground leading-relaxed transition-all"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-muted-foreground font-semibold">Вставить переменную:</span>
                      {SMART_TAGS.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setText(prev => prev + tag)}
                          className="text-[9px] font-mono font-bold bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground px-1.5 py-0.5 rounded transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <Button intent="ghost" size="sm" onClick={() => handleDeleteTrigger(tmpl.id)} aria-label="Удалить шаблон" className="text-destructive hover:text-destructive/80 text-xs font-bold">
                        Удалить
                      </Button>
                      <div className="flex gap-2">
                        <Button intent="outline" size="sm" onClick={() => setEditingId(null)} aria-label="Отменить редактирование" className="rounded-xl border-border text-xs">Отмена</Button>
                        <Button size="sm" onClick={handleSave} disabled={isPending || !label.trim() || !text.trim()} aria-label="Сохранить изменения" className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold">
                          {isPending ? 'Сохранение...' : 'Сохранить'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="group bg-card border border-border/80 rounded-2xl p-4 shadow-xs hover:border-primary/50 hover:shadow-sm transition-all duration-200 flex flex-col justify-between items-start gap-2.5 cursor-pointer" onClick={() => handleEdit(tmpl)} role="button" aria-label={`Редактировать шаблон ${tmpl.label}`}>
                     <div className="w-full">
                       <div className="font-bold text-xs text-foreground mb-1.5 flex items-center justify-between gap-2">
                         <div className="flex items-center gap-1.5">
                           <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-[10px] font-extrabold">{tmpl.label}</span>
                           {tmpl.shortcut && (
                             <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">/{tmpl.shortcut}</code>
                           )}
                         </div>
                         <span className="text-[10px] text-muted-foreground font-medium">Использован: {tmpl.useCount ?? 0}</span>
                       </div>
                       <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{tmpl.text}</p>
                     </div>
                     <div className="text-[10px] text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                       ✏️ Кликните для редактирования
                     </div>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>

      <ConfirmModal
        isOpen={deletingTemplateId !== null}
        onClose={() => setDeletingTemplateId(null)}
        onConfirm={handleConfirmDelete}
        isDanger
        title="Удалить шаблон"
        confirmText="Удалить"
      >
        Вы действительно хотите удалить этот шаблон?
      </ConfirmModal>
    </div>
  );
}
