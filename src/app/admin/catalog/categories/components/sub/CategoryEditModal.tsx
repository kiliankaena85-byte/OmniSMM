'use client';

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createCategory, updateCategory } from "@/actions/admin/catalog/categories";
import { cyrillicToSlug } from "@/utils/slugify";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from '@/components/ui/button';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { IconPicker } from '@/components/admin/icon-picker/IconPicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { PREDEFINED_TAGS, NetworkItem, CategoryItem } from './types';

interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCategory: CategoryItem | null;
  initialNetworkId?: string;
  networks: NetworkItem[];
  categories: CategoryItem[];
}

export function CategoryEditModal({
  isOpen,
  onClose,
  editingCategory,
  initialNetworkId,
  networks,
  categories,
}: CategoryEditModalProps) {
  const router = useRouter();

  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catIcon, setCatIcon] = useState<string | null>(null);
  const [catNetworkId, setCatNetworkId] = useState("");
  const [catSort, setCatSort] = useState("0");
  const [catRequireWarning, setCatRequireWarning] = useState(false);
  const [catWarningMessage, setCatWarningMessage] = useState("");
  const [catAnalyzerTags, setCatAnalyzerTags] = useState("");
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  useEffect(() => {
    if (editingCategory) {
      setCatName(editingCategory.name);
      setCatSlug(editingCategory.slug || "");
      setCatIcon(editingCategory.icon || null);
      setCatNetworkId(editingCategory.networkId || networks[0]?.id || "");
      setCatSort(String(editingCategory.sort));
      setCatRequireWarning(editingCategory.requireWarning ?? false);
      setCatWarningMessage(editingCategory.warningMessage || "");
      setCatAnalyzerTags(editingCategory.analyzerTags || "");
      setCatError(null);
    } else {
      setCatName("");
      setCatSlug("");
      setCatIcon(null);
      setCatNetworkId(initialNetworkId || networks[0]?.id || "");
      setCatSort("0");
      setCatRequireWarning(false);
      setCatWarningMessage("");
      setCatAnalyzerTags("");
      setCatError(null);
    }
  }, [editingCategory, initialNetworkId, networks, isOpen]);

  const duplicateCategoryWarning = useMemo(() => {
    if (!catName.trim() || !catNetworkId) return null;
    const cleanInput = catName.trim().toLowerCase();
    const existing = categories.find(c => 
      c.networkId === catNetworkId && 
      c.name.trim().toLowerCase() === cleanInput &&
      (!editingCategory || c.id !== editingCategory.id)
    );
    if (!existing) return null;
    const netName = networks.find(n => n.id === catNetworkId)?.name || 'этой соцсети';
    return `Внимание: в ${netName} уже существует категория «${existing.name}» (${existing._count?.services || 0} услуг).`;
  }, [catName, catNetworkId, categories, editingCategory, networks]);

  const selectedNetworkSlug = useMemo(() => {
    return networks.find(n => n.id === catNetworkId)?.slug?.toLowerCase() || '';
  }, [catNetworkId, networks]);

  const toggleTag = (tagId: string) => {
    const currentTags = catAnalyzerTags.split(',').map(t => t.trim()).filter(Boolean);
    if (currentTags.includes(tagId)) {
      setCatAnalyzerTags(currentTags.filter(t => t !== tagId).join(', '));
    } else {
      setCatAnalyzerTags([...currentTags, tagId].join(', '));
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName || !catNetworkId) {
      setCatError("Заполните все обязательные поля");
      return;
    }
    if (catRequireWarning && !catWarningMessage.trim()) {
      setCatError("Текст предупреждения обязателен при включенной опции");
      return;
    }

    try {
      setCatLoading(true);
      setCatError(null);
      const payload = {
        name: catName.trim(),
        slug: catSlug.trim().toLowerCase() || undefined,
        networkId: catNetworkId,
        sort: parseInt(catSort, 10) || 0,
        requireWarning: catRequireWarning,
        warningMessage: catRequireWarning ? catWarningMessage.trim() : null,
        analyzerTags: catAnalyzerTags.trim() || null,
        icon: catIcon
      };

      if (editingCategory) {
        const res = await updateCategory(editingCategory.id, payload);
        if (!res.success) throw new Error(res.error);
        toast.success("Категория успешно обновлена");
      } else {
        const res = await createCategory(payload);
        if (!res.success) throw new Error(res.error);
        toast.success("Категория успешно создана");
      }

      onClose();
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Произошла ошибка";
      setCatError(msg);
    } finally {
      setCatLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px] bg-background border border-border rounded-2xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">
            {editingCategory ? "📝 Редактировать категорию" : "➕ Новая категория"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Настройте название категории, слаг URL, визуальную иконку, привязку к соцсети и теги анализатора.
          </DialogDescription>
        </DialogHeader>

        {catError && (
          <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-xl border border-destructive/20">
            {catError}
          </div>
        )}

        <form onSubmit={handleSaveCategory} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-muted-foreground">Название категории</label>
            <input
              type="text"
              required
              value={catName}
              onChange={e => {
                const val = e.target.value;
                setCatName(val);
                if (!editingCategory) setCatSlug(cyrillicToSlug(val));
              }}
              placeholder="Например: Подписчики"
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {duplicateCategoryWarning && (
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-warning/10 border border-warning/20 text-warning text-[11px] font-semibold mt-1.5 animate-in fade-in duration-200">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{duplicateCategoryWarning}</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-muted-foreground">Слаг (URL-адрес)</label>
              <span className="text-[10px] text-muted-foreground font-mono">
                /services/{selectedNetworkSlug || 'network'}/<span className="text-primary font-bold">{catSlug || 'slug'}</span>
              </span>
            </div>
            <input
              type="text"
              value={catSlug}
              onChange={e => setCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
              placeholder="subscribers"
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          <div className="pt-1 pb-1">
            <IconPicker
              label="Визуальная иконка категории"
              context="category"
              value={catIcon}
              onChange={setCatIcon}
              suggestName={catName}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-muted-foreground">Соцсеть</label>
              <Select value={catNetworkId} onValueChange={val => setCatNetworkId(val || '')}>
                <SelectTrigger className="w-full h-9 border border-border bg-background text-foreground text-xs rounded-xl cursor-pointer px-3">
                  <SelectValue placeholder="-- Выберите соцсеть --">
                    {(value: string) => networks.find(n => n.id === value)?.name ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {networks.map(n => (
                    <SelectItem key={n.id} value={n.id} label={n.name} className="text-xs cursor-pointer">
                      <span className="flex items-center gap-2">
                        <SocialIcon slug={n.slug} size={14} />
                        {n.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-muted-foreground">Сортировка</label>
              <input
                type="number"
                required
                value={catSort}
                onChange={e => setCatSort(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2 border-t border-border/40 pt-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={catRequireWarning}
                onChange={e => setCatRequireWarning(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs font-bold text-foreground">Показывать предупреждение клиенту</span>
            </label>

            {catRequireWarning && (
              <input
                type="text"
                required={catRequireWarning}
                value={catWarningMessage}
                onChange={e => setCatWarningMessage(e.target.value)}
                placeholder="Предупреждение: Просмотры идут только на 1-е фото..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            )}
          </div>

          <div className="space-y-2 border-t border-border/40 pt-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-muted-foreground">
                Теги анализатора ссылок (Автовыбор при вводе ссылки)
              </label>
              {selectedNetworkSlug && (
                <span className="text-[10px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded">
                  ⭐ Рекомендовано для сети
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PREDEFINED_TAGS
                .slice()
                .sort((a, b) => {
                  const aRec = a.networks?.some(s => selectedNetworkSlug.includes(s)) ? 1 : 0;
                  const bRec = b.networks?.some(s => selectedNetworkSlug.includes(s)) ? 1 : 0;
                  return bRec - aRec;
                })
                .map(tag => {
                  const isActive = catAnalyzerTags.split(',').map(t => t.trim()).filter(Boolean).includes(tag.id);
                  const isRecommended = selectedNetworkSlug && tag.networks?.some(s => selectedNetworkSlug.includes(s));
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all border cursor-pointer flex items-center gap-1 ${
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : isRecommended
                          ? 'bg-primary/5 text-primary border-primary/30 hover:bg-primary/10'
                          : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                      }`}
                    >
                      {isRecommended && !isActive && <span className="text-[9px]">⭐</span>}
                      <span>{tag.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <Button type="button" intent="outline" size="sm" onClick={onClose} className="cursor-pointer">
              Отмена
            </Button>
            <Button type="submit" intent="primary" size="sm" disabled={catLoading} className="cursor-pointer">
              {catLoading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {editingCategory ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
