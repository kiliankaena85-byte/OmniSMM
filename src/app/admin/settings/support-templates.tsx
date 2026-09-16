'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { upsertTemplate, deleteTemplate } from '@/actions/support/template';
import { toast } from 'sonner';
import { useState, useTransition } from 'react';
import { Loader2, Plus, Edit2, Trash2, Tag, Zap, Activity, HelpCircle, AlertTriangle, Eye, Copy, Check } from 'lucide-react';
import type { SupportTemplate } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type TemplateWithUseCount = SupportTemplate;

interface SupportTemplatesSettingsProps {
  initialTemplates: TemplateWithUseCount[];
}

export function SupportTemplatesSettings({ initialTemplates }: SupportTemplatesSettingsProps) {
  const [templates, setTemplates] = useState<TemplateWithUseCount[]>(initialTemplates);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithUseCount | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<TemplateWithUseCount | null>(null);
  const [label, setLabel] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [text, setText] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [isActive, setIsActive] = useState(true);
  const [sort, setSort] = useState(0);
  const [isPending, startTransition] = useTransition();

  const handleEditClick = (t: TemplateWithUseCount) => {
    setEditingTemplate(t);
    setLabel(t.label);
    setShortcut(t.shortcut || '');
    setText(t.text);
    setCategory(t.category || 'GENERAL');
    setIsActive(t.isActive !== false);
    setSort(t.sort || 0);
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      try {
        window.scrollTo(0, 0);
      } catch {
        // ignore
      }
    }
  };

  const handleCancel = () => {
    setEditingTemplate(null);
    setLabel('');
    setShortcut('');
    setText('');
    setCategory('GENERAL');
    setIsActive(true);
    setSort(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !text.trim()) {
      toast.error('Пожалуйста, заполните Название и Текст шаблона');
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        if (editingTemplate) {
          formData.append('id', editingTemplate.id);
        }
        formData.append('label', label.trim());
        formData.append('text', text.trim());
        formData.append('shortcut', shortcut.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''));
        formData.append('category', category);
        formData.append('isActive', isActive ? 'true' : 'false');
        formData.append('sort', sort.toString());

        const res = await upsertTemplate(formData);
        if (!res.success || !res.data) {
          toast.error(res.error || 'Ошибка сохранения шаблона');
          return;
        }

        toast.success(editingTemplate ? 'Шаблон успешно обновлен' : 'Шаблон успешно создан');
        
        // Refresh local lists with verified DB object (guaranteeing valid CUID)
        const savedTemplate = res.data;
        const updatedTemplates = [...templates];
        if (editingTemplate) {
          const idx = updatedTemplates.findIndex(item => item.id === savedTemplate.id);
          if (idx !== -1) {
            updatedTemplates[idx] = savedTemplate;
          } else {
            updatedTemplates.push(savedTemplate);
          }
        } else {
          updatedTemplates.push(savedTemplate);
        }
        
        // sort by sort field
        updatedTemplates.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        setTemplates(updatedTemplates);
        
        handleCancel();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
        toast.error('Ошибка сохранения шаблона: ' + errorMessage);
      }
    });
  };

  const handleDelete = (template: TemplateWithUseCount) => {
    setTemplateToDelete(template);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    const id = templateToDelete.id;
    setTemplateToDelete(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('id', id);
        const res = await deleteTemplate(formData);
        if (!res.success) {
          toast.error(res.error || 'Ошибка удаления шаблона');
          return;
        }
        toast.success('Шаблон удален');
        setTemplates(prev => prev.filter(t => t.id !== id));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
        toast.error('Ошибка удаления: ' + errorMessage);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-24">
      {/* Delete Confirmation Modal */}
      <Dialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <div className="flex items-center gap-3 text-rose-500 pb-2">
              <AlertTriangle className="w-6 h-6" />
              <DialogTitle className="text-lg font-bold">Удаление шаблона</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Вы уверены, что хотите удалить шаблон <strong className="text-foreground">«{templateToDelete?.label}»</strong>?
              <br /><br />
              Операторы поддержки больше не смогут вызывать его по шорткату <code className="text-primary font-mono font-bold">/{templateToDelete?.shortcut || 'нет'}</code>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-4">
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={() => setTemplateToDelete(null)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmDelete}
              className="font-bold bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
            >
              Удалить шаблон
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CRUD Form card */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="rounded-2xl border-border shadow-sm bg-card">
          <CardHeader className="border-b border-border/60 bg-muted/20 p-6">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span>{editingTemplate ? 'Редактировать шаблон' : 'Создать умный шаблон'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  Название (для оператора)
                  <span title="Понятное название шаблона в выпадающем списке оператора">
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </span>
                </Label>
                <Input
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Например: Задержка выполнения заказа"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  Шорткат (вызов по /шорткат)
                  <span title="Короткая команда для мгновенной подстановки текста в тикете, например /delay">
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </span>
                </Label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm font-mono font-bold text-slate-400">/</span>
                  <Input
                    required
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="delay"
                    className="pl-6 font-mono"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Только латиница, цифры, дефис и подчеркивание.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Категория</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-medium text-foreground"
                >
                  <option value="GENERAL">📋 Общие</option>
                  <option value="ORDER">📦 Заказы</option>
                  <option value="PAYMENT">💳 Оплата и возвраты</option>
                  <option value="LEGAL">⚖️ Юридические / 152-ФЗ</option>
                  <option value="ACCOUNT">👤 Аккаунт и доступ</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Порядок сортировки</Label>
                <Input
                  type="number"
                  value={sort}
                  onChange={(e) => setSort(parseInt(e.target.value || '0', 10))}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Текст ответа</Label>
                <textarea
                  required
                  rows={6}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Используйте переменные: {user_name}, {order_id}, {service_name}, {order_status}, {ticket_id}, {user_email}, {domain}, {current_date}"
                  className="flex min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {[
                    { tag: '{user_name}', title: 'Имя клиента' },
                    { tag: '{order_id}', title: 'ID заказа' },
                    { tag: '{service_name}', title: 'Название услуги' },
                    { tag: '{order_status}', title: 'Статус заказа' },
                    { tag: '{ticket_id}', title: 'ID тикета' },
                    { tag: '{user_email}', title: 'Email клиента' },
                    { tag: '{domain}', title: 'Текущий домен' },
                    { tag: '{current_date}', title: 'Текущая дата' },
                  ].map(({ tag, title }) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setText(prev => prev + tag)}
                      title={title}
                      className="text-[9px] font-mono font-bold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Preview if text has variables */}
              {text && text.includes('{') && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border/60 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <Eye className="w-3 h-3 text-primary" />
                    <span>Пример отображения для клиента:</span>
                  </div>
                  <p className="text-[11px] text-foreground font-normal leading-relaxed whitespace-pre-wrap">
                    {text
                      .replace(/{user_name}/g, 'Алексей')
                      .replace(/{order_id}/g, '#10492')
                      .replace(/{service_name}/g, 'Telegram Подписчики Премиум')
                      .replace(/{order_status}/g, 'В работе')
                      .replace(/{ticket_id}/g, 'TK-842')
                      .replace(/{user_email}/g, 'client@example.com')
                      .replace(/{domain}/g, 'smmplan.pro')
                      .replace(/{current_date}/g, new Date().toLocaleDateString('ru-RU'))}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Checkbox
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(!!checked)}
                />
                <Label htmlFor="isActive" className="text-xs font-bold text-foreground cursor-pointer select-none">
                  Активный шаблон (доступен операторам)
                </Label>
              </div>

              <div className="flex gap-2 pt-4 justify-end">
                {editingTemplate && (
                  <Button type="button" intent="outline" onClick={handleCancel} disabled={isPending}>
                    Отмена
                  </Button>
                )}
                <Button type="submit" disabled={isPending} className="font-semibold px-5">
                  {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  <span>{editingTemplate ? 'Сохранить изменения' : 'Создать'}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Templates list card */}
      <div className="lg:col-span-2">
        <Card className="rounded-2xl border-border shadow-sm bg-card overflow-hidden">
          <CardHeader className="border-b border-border/60 bg-muted/20 p-6 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              <span>Список шаблонов ответов</span>
            </CardTitle>
            <span className="text-[10px] font-bold bg-muted text-muted-foreground px-2 py-1 rounded-full uppercase tracking-wider">
              {templates.length} шаблонов
            </span>
          </CardHeader>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/10">
                  <th className="px-6 py-4">Сорт</th>
                  <th className="px-6 py-4">Название / Команда</th>
                  <th className="px-6 py-4">Текст шаблона</th>
                  <th className="px-6 py-4">Категория</th>
                  <th className="px-6 py-4">Статус</th>
                  <th className="px-6 py-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                      Шаблоны отсутствуют. Добавьте первый шаблон в левой панели.
                    </td>
                  </tr>
                ) : (
                  templates.map(t => (
                    <tr key={t.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-mono text-muted-foreground">{t.sort || 0}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-foreground">{t.label}</span>
                          {t.shortcut ? (
                            <span className="text-[10px] font-mono font-bold text-primary">/{t.shortcut}</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">без шортката</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-[200px] truncate text-muted-foreground font-normal" title={t.text}>
                        {t.text}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          t.category === 'LEGAL' ? 'bg-primary/10 text-primary border border-primary/20' :
                          t.category === 'PAYMENT' ? 'bg-success/10 text-success border border-success/20' :
                          t.category === 'ORDER' ? 'bg-info/10 text-info border border-info/20' :
                          t.category === 'ACCOUNT' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200' :
                          'bg-muted text-muted-foreground border border-border/40'
                        }`}>
                          {t.category === 'LEGAL' ? '⚖️ 152-ФЗ' :
                           t.category === 'PAYMENT' ? '💳 Оплата' :
                           t.category === 'ORDER' ? '📦 Заказы' :
                           t.category === 'ACCOUNT' ? '👤 Аккаунт' : '📋 Общие'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          t.isActive !== false
                            ? 'bg-success/10 text-success border border-success/20'
                            : 'bg-muted text-muted-foreground/60 border border-border/20'
                        }`}>
                          {t.isActive !== false ? 'Активен' : 'Отключен'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditClick(t)}
                            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-primary transition-colors rounded-lg"
                            title="Редактировать"
                            aria-label="Редактировать шаблон"
                          >
                            <Edit2 className="w-3.5 h-3.5 pointer-events-none" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(t)}
                            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-destructive transition-colors rounded-lg"
                            title="Удалить"
                            aria-label="Удалить шаблон"
                          >
                            <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
