'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Zap, Loader2, ChevronDown, Plus, Settings2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { upsertTemplate } from '@/actions/support/template';
import TemplateManagerModal, { Template } from '@/components/support/TemplateManagerModal';

const CATEGORIES: Record<string, string> = {
  ALL: 'Все',
  LEGAL: '⚖️ 152-ФЗ',
  PAYMENT: '💳 Оплата',
  ORDER: '📦 Заказы',
  GENERAL: '📋 Общие',
  ACCOUNT: '👤 Аккаунт',
};


export interface SupportTemplateDTO {
  id: string;
  shortcut: string | null;
  label: string;
  text: string;
  category?: string;
  sort?: number;
  isActive?: boolean;
  useCount?: number;
}

export function ChatTemplateManager({
  templatesList,
  setTemplatesList,
  onSelectTemplate,
  onOpenStateChange,
}: {
  templatesList: SupportTemplateDTO[];
  setTemplatesList: React.Dispatch<React.SetStateAction<SupportTemplateDTO[]>>;
  onSelectTemplate: (t: SupportTemplateDTO) => void;
  onOpenStateChange?: (isOpen: boolean) => void;
}) {
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showManageModal, setShowManageModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newTemplateLabel, setNewTemplateLabel] = useState('');
  const [newTemplateShortcut, setNewTemplateShortcut] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('GENERAL');
  const [newTemplateText, setNewTemplateText] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpenDropdown) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpenDropdown(false);
        if (onOpenStateChange) onOpenStateChange(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpenDropdown, onOpenStateChange]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!isOpenDropdown) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpenDropdown(false);
        if (onOpenStateChange) onOpenStateChange(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpenDropdown, onOpenStateChange]);

  const toggleDropdown = () => {
    const next = !isOpenDropdown;
    setIsOpenDropdown(next);
    if (onOpenStateChange) onOpenStateChange(next);
  };

  const filteredTemplates = useMemo(() => {
    return templatesList.filter(t => {
      const cat = (t.category || 'GENERAL').toUpperCase();
      const matchCat = selectedCategory === 'ALL' || cat === selectedCategory;
      if (!matchCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        (t.label && t.label.toLowerCase().includes(q)) ||
        (t.shortcut && t.shortcut.toLowerCase().includes(q)) ||
        (t.text && t.text.toLowerCase().includes(q))
      );
    });
  }, [templatesList, selectedCategory, searchQuery]);

  const handleCreateTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateLabel.trim() || !newTemplateShortcut.trim() || !newTemplateText.trim()) {
      toast.error('Пожалуйста, заполните все обязательные поля');
      return;
    }

    setCreatingTemplate(true);
    try {
      const formData = new FormData();
      formData.append('shortcut', newTemplateShortcut.trim().toLowerCase());
      formData.append('label', newTemplateLabel.trim());
      formData.append('text', newTemplateText.trim());
      formData.append('category', newTemplateCategory);
      formData.append('isActive', 'true');

      await upsertTemplate(formData);

      const newT = {
        id: Math.random().toString(),
        label: newTemplateLabel.trim(),
        text: newTemplateText.trim(),
        shortcut: newTemplateShortcut.trim().toLowerCase(),
        category: newTemplateCategory,
        useCount: 0,
      };

      setTemplatesList((prev) => [...prev, newT]);
      toast.success('Умный шаблон успешно создан!');
      setShowCreateModal(false);

      setNewTemplateLabel('');
      setNewTemplateShortcut('');
      setNewTemplateText('');
    } catch (err: unknown) {
      toast.error('Ошибка создания шаблона: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCreatingTemplate(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={toggleDropdown}
        className={`flex items-center gap-1.5 px-3 h-11 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
          isOpenDropdown
            ? 'bg-primary/15 border-primary/40 text-primary shadow-xs'
            : 'bg-card border-border/80 text-foreground hover:bg-muted/50 hover:border-border'
        }`}
        title="Выпадающее меню шаблонов ответов"
        aria-label="Выпадающее меню шаблонов ответов"
        aria-expanded={isOpenDropdown}
      >
        <Zap className="w-3.5 h-3.5 text-primary" />
        <span>Шаблоны</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isOpenDropdown ? 'rotate-180 text-primary' : ''}`} />
      </button>

      {/* Dropdown Menu Popover */}
      <AnimatePresence>
        {isOpenDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 w-96 sm:w-[420px] max-w-[calc(100vw-2rem)] bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col ring-1 ring-border/10"
          >
            {/* Header with Search */}
            <div className="p-3 border-b border-border/60 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  Выпадающее меню шаблонов
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {filteredTemplates.length} из {templatesList.length}
                </span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Быстрый поиск шаблона..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs border border-border/80 rounded-xl pl-8 pr-2.5 py-1.5 outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
                  autoFocus
                />
              </div>
            </div>

            {/* Category Pills Filter with wrap (Zero Clipping) */}
            <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-border/40 bg-muted/10">
              {Object.entries(CATEGORIES).map(([catKey, catLabel]) => {
                const isSelected = selectedCategory === catKey;
                const count = catKey === 'ALL' 
                  ? templatesList.length 
                  : templatesList.filter(t => t.category === catKey).length;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedCategory(catKey)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <span>{catLabel}</span>
                    {count > 0 && (
                      <span className={`text-[9px] px-1 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Template List Items */}
            <div className="max-h-64 overflow-y-auto divide-y divide-border/30 p-1">
              {filteredTemplates.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Шаблоны не найдены
                </div>
              ) : (
                filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onSelectTemplate(t);
                      setIsOpenDropdown(false);
                      if (onOpenStateChange) onOpenStateChange(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-muted/50 transition-all flex flex-col gap-1 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {t.label}
                      </span>
                      {t.shortcut && (
                        <code className="text-[9px] font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                          /{t.shortcut}
                        </code>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
                      {t.text}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-2 border-t border-border/60 bg-muted/30 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsOpenDropdown(false);
                  if (onOpenStateChange) onOpenStateChange(false);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Создать шаблон</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpenDropdown(false);
                  if (onOpenStateChange) onOpenStateChange(false);
                  setShowManageModal(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Управление ({templatesList.length})</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fast Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border"
            >
              <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
                <h3 className="font-bold text-foreground text-sm">✨ Новый умный шаблон</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTemplateSubmit} className="p-5 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-muted-foreground">Название (Label)</label>
                  <input
                    type="text"
                    required
                    value={newTemplateLabel}
                    onChange={(e) => setNewTemplateLabel(e.target.value)}
                    placeholder="Например: 🛡️ 152-ФЗ Удаление"
                    className="w-full px-3 py-2 border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-background text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-muted-foreground">Шорткат</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-2.5 text-xs font-bold text-muted-foreground">/</span>
                      <input
                        type="text"
                        required
                        value={newTemplateShortcut}
                        onChange={(e) => setNewTemplateShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                        placeholder="delete_self"
                        className="w-full pl-5 pr-2.5 py-2 border border-border rounded-xl text-xs font-mono focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-background text-foreground"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-muted-foreground">Категория</label>
                    <select
                      value={newTemplateCategory}
                      onChange={(e) => setNewTemplateCategory(e.target.value)}
                      className="w-full px-2.5 py-2 border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-background text-foreground"
                    >
                      <option value="GENERAL">📋 Общие</option>
                      <option value="ORDER">📦 Заказы</option>
                      <option value="PAYMENT">💳 Оплата</option>
                      <option value="LEGAL">⚖️ 152-ФЗ</option>
                      <option value="ACCOUNT">👤 Аккаунт</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-muted-foreground">Текст ответа</label>
                  <textarea
                    required
                    rows={4}
                    value={newTemplateText}
                    onChange={(e) => setNewTemplateText(e.target.value)}
                    placeholder="Используйте переменные: {user_name}, {order_id}, {service_name}, {order_status}, {ticket_id}, {current_date}"
                    className="w-full px-3 py-2 border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-background text-foreground resize-none leading-relaxed"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {['{user_name}', '{order_id}', '{service_name}', '{ticket_id}', '{current_date}'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setNewTemplateText(prev => prev + tag)}
                        className="text-[9px] font-mono font-bold bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground px-1.5 py-0.5 rounded transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-2 text-xs font-semibold border border-border hover:bg-muted rounded-xl transition-colors text-foreground"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={creatingTemplate}
                    className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    {creatingTemplate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Создать шаблон</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Template Manager Modal */}
      <TemplateManagerModal
        open={showManageModal}
        onClose={() => setShowManageModal(false)}
        templates={templatesList as Template[]}
      />
    </div>
  );
}
