'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2, Layers, ShieldCheck, Target, AlertTriangle, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { updateServiceAction, createServiceAction } from '@/actions/admin/catalog/services';
import { applyBeautifulRounding, SAFETY_FLOOR_MARKUP } from '@/lib/financial-constants';
import { IconPicker } from '@/components/admin/icon-picker/IconPicker';
import { ProviderServiceSearchModal } from '@/components/admin/catalog/provider-service-search-modal';
import {
  TargetTypeEnum,
  inferTargetTypeFromName,
  inferTargetTypeFromCategory,
  isTargetTypeCompatible,
} from '@/utils/target-type';

interface NetworkOption {
  id: string;
  name: string;
  slug: string;
  categories: {
    id: string;
    name: string;
    slug: string;
  }[];
}

interface ProviderOption {
  id: string;
  name: string;
  balanceCurrency: string;
}

export interface InitialServiceData {
  id?: string;
  name: string;
  description: string | null;
  icon?: string | null;
  categoryId: string;
  rate: number;
  markup: number;
  minQty: number;
  maxQty: number;
  providerId: string | null;
  externalId: string | null;
  targetType?: string | null;
  isActive: boolean;
  isDripFeedEnabled?: boolean;
  isRefillEnabled?: boolean;
  isCancelEnabled?: boolean;
  linkPlaceholder?: string | null;
  linkHint?: string | null;
}

interface ServiceEditFormProps {
  initialData: InitialServiceData;
  networks: NetworkOption[];
  providers: ProviderOption[];
  exchangeRateUsd: number;
  returnUrl?: string;
}

const TARGET_TYPE_OPTIONS = [
  { value: TargetTypeEnum.POST, label: '📝 Пост / Публикация / Фото' },
  { value: TargetTypeEnum.CHANNEL, label: '📢 Канал / Группа / Подписчики' },
  { value: TargetTypeEnum.PROFILE, label: '👤 Профиль / Аккаунт' },
  { value: TargetTypeEnum.VIDEO, label: '🎬 Видео / Reels / Shorts / Стримы' },
  { value: TargetTypeEnum.STORY, label: '⏱️ Сториз / Истории' },
  { value: TargetTypeEnum.CHANNEL_POSTS, label: '🤖 Авто-посты / Будущие публикации' },
  { value: TargetTypeEnum.POLL, label: '📊 Опросы / Голосования' },
  { value: TargetTypeEnum.COMMENTS, label: '💬 Комментарии / Отзывы' },
  { value: TargetTypeEnum.BOT, label: '🤖 Боты / Рефералы' },
  { value: TargetTypeEnum.CUSTOM, label: '⚙️ Свой / Произвольный' },
];

function getSafeReturnUrl(rawUrl: string | null | undefined, fallback: string = '/admin/catalog'): string {
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;
  const trimmed = rawUrl.trim();
  if (
    trimmed.startsWith('/admin') &&
    !trimmed.startsWith('//') &&
    !trimmed.includes('\\') &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
  ) {
    return trimmed;
  }
  return fallback;
}

export function ServiceEditForm({
  initialData,
  networks,
  providers,
  exchangeRateUsd,
  returnUrl,
}: ServiceEditFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTarget = returnUrl || searchParams.get('returnUrl');
  const effectiveReturnUrl = getSafeReturnUrl(rawTarget, '/admin/catalog');
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialData.name);
  const [description, setDescription] = useState(initialData.description || '');
  const [icon, setIcon] = useState<string | null>(initialData.icon || null);
  const [categoryId, setCategoryId] = useState(initialData.categoryId);
  const [targetType, setTargetType] = useState<string>(
    initialData.targetType || inferTargetTypeFromName(initialData.name)
  );
  const [linkPlaceholder, setLinkPlaceholder] = useState(initialData.linkPlaceholder || '');
  const [linkHint, setLinkHint] = useState(initialData.linkHint || '');
  const [providerId, setProviderId] = useState(initialData.providerId || '');
  const [externalId, setExternalId] = useState(initialData.externalId || '');
  const [rate, setRate] = useState(initialData.rate || 0.01);
  const [markupPercent, setMarkupPercent] = useState(
    initialData.markup > 0 ? Math.round((initialData.markup - 1) * 100) : 700
  );
  const [minQty, setMinQty] = useState(initialData.minQty || 10);
  const [maxQty, setMaxQty] = useState(initialData.maxQty || 10000);
  const [isActive, setIsActive] = useState(initialData.isActive);
  const [isRefillEnabled, setIsRefillEnabled] = useState(Boolean(initialData.isRefillEnabled));
  const [isCancelEnabled, setIsCancelEnabled] = useState(Boolean(initialData.isCancelEnabled));

  // Determine if service is bound to an upstream API provider (e.g. VexBoost)
  const isProviderBound = Boolean(initialData.providerId || providerId);

  // Anti-Contradiction & Semantic Badge Detection
  const lowerName = name.toLowerCase();
  const hasRefillContradiction = (lowerName.includes('без гарант') || lowerName.includes('no refill') || lowerName.includes('no-refill')) && isRefillEnabled;
  const hasMissingRefillWarning = (lowerName.includes('гарантия 30') || lowerName.includes('с гарантией') || lowerName.includes('30d refill')) && !isRefillEnabled;

  const previewBadge = useMemo(() => {
    if (lowerName.includes('без гарант') || lowerName.includes('no refill') || lowerName.includes('no-refill')) {
      return lowerName.includes('быстр') ? 'БЫСТРЫЕ' : (rate < 0.1 ? 'ХИТ' : '');
    }
    if (isRefillEnabled) return 'ГАРАНТИЯ';
    if (lowerName.includes('премиум')) return 'ПРЕМИУМ';
    if (lowerName.includes('эконом')) return 'ЭКОНОМ';
    if (lowerName.includes('живые')) return 'ЖИВЫЕ';
    if (lowerName.includes('стандарт')) return 'СТАНДАРТ';
    if (lowerName.includes('быстр') || lowerName.includes('instant')) return 'БЫСТРЫЕ';
    if (rate < 0.1) return 'ХИТ';
    return '';
  }, [lowerName, isRefillEnabled, rate]);

  // Find active category
  const selectedCat = useMemo(() => {
    return networks.flatMap(n => n.categories).find(c => c.id === categoryId);
  }, [networks, categoryId]);

  // Check category compatibility
  const isTypeCompatible = useMemo(() => {
    if (!selectedCat) return true;
    const catType = inferTargetTypeFromCategory(selectedCat.name);
    return isTargetTypeCompatible(targetType, catType);
  }, [selectedCat, targetType]);

  // Calculations
  const markupMultiplier = 1 + markupPercent / 100;
  const costPer1000Rub = rate * exchangeRateUsd;
  const rawPricePer1000Rub = costPer1000Rub * markupMultiplier;
  const retailPricePer1000Rub = applyBeautifulRounding(rawPricePer1000Rub);
  const retailPricePerUnitRub = Number((retailPricePer1000Rub / 1000).toFixed(4));
  const isBelowSafety = markupMultiplier < 1 + SAFETY_FLOOR_MARKUP;

  const isCreateMode = !initialData.id;
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // When an external service is selected from the provider API search modal
  const handleSelectProviderService = (svc: any) => {
    if (!svc) return;
    if (svc.service) {
      setExternalId(String(svc.service));
    }
    if (!name && svc.name) {
      setName(svc.name);
    }
    if (svc.rate) {
      setRate(parseFloat(svc.rate) || 0.01);
    }
    if (svc.min) {
      setMinQty(parseInt(String(svc.min), 10) || 10);
    }
    if (svc.max) {
      setMaxQty(parseInt(String(svc.max), 10) || 10000);
    }
    if (svc.targetType) {
      setTargetType(svc.targetType);
    } else if (svc.name) {
      setTargetType(inferTargetTypeFromName(svc.name));
    }
    if (svc.refill !== undefined) {
      setIsRefillEnabled(Boolean(svc.refill));
    }
    if (svc.cancel !== undefined) {
      setIsCancelEnabled(Boolean(svc.cancel));
    }
    toast.success(`Данные услуги #${svc.service} успешно загружены из API провайдера`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      try {
        if (isCreateMode) {
          const res = await createServiceAction({
            name,
            description: description || null,
            icon,
            categoryId,
            targetType,
            providerId: providerId || null,
            externalId: externalId || null,
            rate,
            markup: markupMultiplier,
            minQty,
            maxQty,
            isActive,
            isRefillEnabled,
            isCancelEnabled,
            isDripFeedEnabled: true,
            qualityTier: 'STANDARD',
            linkPlaceholder: linkPlaceholder || null,
            linkHint: linkHint || null,
          });

          if (res.success) {
            toast.success('Услуга успешно создана!');
            router.push(effectiveReturnUrl);
            router.refresh();
          } else {
            toast.error(res.error || 'Ошибка при создании услуги');
          }
        } else {
          const res = await updateServiceAction(initialData.id!, {
            name,
            description: description || null,
            icon,
            categoryId,
            targetType,
            providerId: providerId || null,
            externalId: externalId || null,
            rate,
            markup: markupMultiplier,
            minQty,
            maxQty,
            isActive,
            isRefillEnabled,
            isCancelEnabled,
            isDripFeedEnabled: true,
            qualityTier: 'STANDARD',
            linkPlaceholder: linkPlaceholder || null,
            linkHint: linkHint || null,
          });

          if (res.success) {
            toast.success('Услуга успешно обновлена');
            router.push(effectiveReturnUrl);
            router.refresh();
          } else {
            toast.error(res.error || 'Ошибка при сохранении');
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Сетевая ошибка');
      }
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Link
              href={effectiveReturnUrl}
              className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Вернуться в каталог"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {isCreateMode ? 'Добавление новой услуги' : 'Редактирование услуги'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isCreateMode
                  ? 'Ручное добавление услуги в каталог платформы и привязка к API провайдера'
                  : `ID: #${initialData.id?.slice(-6)} • Изменение параметров и наценки`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCreateMode && initialData.id && (
              <Link
                href={`/admin/services/${initialData.id}/routing`}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20"
              >
                <span>⚡</span> Маршрутизация & Резерв
              </Link>
            )}
            <Button
              type="button"
              onClick={() => router.push(effectiveReturnUrl)}
              disabled={isPending}
              className="text-xs bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="text-xs font-bold gap-1.5 cursor-pointer"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isCreateMode ? 'Создать услугу' : 'Сохранить изменения'}
            </Button>
          </div>
        </div>

      {/* Main Settings Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-5">
          {/* Basic Info */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-2xs">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Основные параметры
            </h2>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Название на витрине</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>

            {/* Visual Icon Picker */}
            <div>
              <IconPicker
                label="Визуальная иконка тарифа / услуги"
                context="service"
                value={icon}
                onChange={setIcon}
                suggestName={name}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground block">Категория</label>
                  <Link href="/admin/catalog/categories" target="_blank" className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium">
                    <Plus className="w-3 h-3" /> Создать категорию
                  </Link>
                </div>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                >
                  {networks.map(net => (
                    <optgroup key={net.id} label={net.name}>
                      {net.categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {net.name} → {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  Тип цели (Target Type)
                </label>
                <select
                  value={targetType}
                  onChange={e => setTargetType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                >
                  {TARGET_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Compatibility Warning */}
            {!isTypeCompatible && selectedCat && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Внимание:</strong> Выбранный тип цели (<code>{targetType}</code>) может не соответствовать категории «{selectedCat.name}». Рекомендуется проверить совместимость.
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Пример ссылки (Override Placeholder)</label>
                <input
                  type="text"
                  value={linkPlaceholder}
                  onChange={e => setLinkPlaceholder(e.target.value)}
                  placeholder="Например: https://t.me/channel_name"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Текст подсказки (Override Hint)</label>
                <input
                  type="text"
                  value={linkHint}
                  onChange={e => setLinkHint(e.target.value)}
                  placeholder="Например: Укажите ссылку на открытый канал"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Описание для покупателя</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Краткое описание скорости, гарантии и правил..."
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs leading-relaxed focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
              />
            </div>
          </div>

          {/* Limits & Options */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-2xs">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Лимиты и опции
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground block">Мин. заказ (шт)</label>
                  {isProviderBound && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                      🔒 API Sync
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={minQty}
                  onChange={e => setMinQty(Number(e.target.value))}
                  min={1}
                  disabled={isProviderBound}
                  readOnly={isProviderBound}
                  required
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-medium outline-none transition-all ${
                    isProviderBound
                      ? 'bg-muted/40 text-muted-foreground border-border/70 cursor-not-allowed border-dashed font-mono'
                      : 'border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground block">Макс. заказ (шт)</label>
                  {isProviderBound && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                      🔒 API Sync
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={maxQty}
                  onChange={e => setMaxQty(Number(e.target.value))}
                  min={1}
                  disabled={isProviderBound}
                  readOnly={isProviderBound}
                  required
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-medium outline-none transition-all ${
                    isProviderBound
                      ? 'bg-muted/40 text-muted-foreground border-border/70 cursor-not-allowed border-dashed font-mono'
                      : 'border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary'
                  }`}
                />
              </div>
            </div>

            {isProviderBound && (
              <p className="text-[11px] text-muted-foreground">
                ℹ️ Лимиты объёма передаются напрямую от поставщика по API (VexBoost/SMM) и обновляются автоматически при синхронизации.
              </p>
            )}

            <div className="grid grid-cols-3 gap-3 pt-2">
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span className="text-xs font-semibold text-foreground">Активна</span>
              </label>

              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                hasRefillContradiction ? 'border-destructive/50 bg-destructive/10' : 'border-border bg-muted/20 hover:bg-muted/40'
              }`}>
                <input
                  type="checkbox"
                  checked={isRefillEnabled}
                  onChange={e => setIsRefillEnabled(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span className={`text-xs font-semibold ${hasRefillContradiction ? 'text-destructive font-bold' : 'text-foreground'}`}>
                  Гарантия (Refill)
                </span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={isCancelEnabled}
                  onChange={e => setIsCancelEnabled(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span className="text-xs font-semibold text-foreground">Отмена (Cancel)</span>
              </label>
            </div>

            {/* Semantic Contradiction Warning */}
            {hasRefillContradiction && (
              <div className="flex items-start gap-2.5 p-3.5 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive animate-in fade-in duration-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Критическое противоречие:</strong> В названии услуги указано «Без гарантии» / «No Refill», но включен чекбокс «Гарантия (Refill)». На клиентском сайте бейдж «ГАРАНТИЯ» будет автоматически заблокирован во избежание юридических рисков и претензий клиентов (ЗоЗПП РФ ст. 10/12). Отключите чекбокс «Гарантия» или измените название.
                </div>
              </div>
            )}

            {hasMissingRefillWarning && (
              <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Подсказка:</strong> В названии указана гарантия, но чекбокс «Гарантия (Refill)» выключен. Рекомендуется включить его, чтобы клиенты получили возможность автодокрутки.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Sidebar & Live Card Preview */}
        <div className="space-y-5">
          {/* Live Card Preview */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>👁️</span> Вид в каталоге
              </h2>
              {previewBadge ? (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border ${
                  previewBadge === 'ГАРАНТИЯ' 
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                    : previewBadge === 'ХИТ'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : 'bg-primary/10 text-primary border-primary/20'
                }`}>
                  Бейдж: {previewBadge}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Без бейджа</span>
              )}
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-bold text-foreground line-clamp-2">
                  {name || 'Название услуги'}
                </div>
                {previewBadge && (
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25">
                    {previewBadge}
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between text-xs pt-1">
                <span className="text-muted-foreground text-[11px]">Цена розница:</span>
                <span className="font-extrabold text-foreground font-mono">{retailPricePerUnitRub} ₽ / шт</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-2xs">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>💰</span> Ценообразование
            </h2>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-foreground block">Тариф провайдера ($ за 1000)</label>
                {isProviderBound && (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                    🔒 API Sync
                  </span>
                )}
              </div>
              <input
                type="number"
                step="0.0001"
                value={rate}
                onChange={e => setRate(Number(e.target.value))}
                min={0}
                disabled={isProviderBound}
                readOnly={isProviderBound}
                required
                className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-medium outline-none transition-all ${
                  isProviderBound
                    ? 'bg-muted/40 text-muted-foreground border-border/70 cursor-not-allowed border-dashed'
                    : 'border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary'
                }`}
              />
              <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                Себестоимость: {costPer1000Rub.toFixed(2)} ₽ / 1000 шт
                {isProviderBound && ' · обновляется автоматически по API'}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-foreground">Наценка (%)</label>
                <span className="text-xs font-bold text-primary font-mono">{markupPercent}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={500}
                step={5}
                value={markupPercent}
                onChange={e => setMarkupPercent(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              {isBelowSafety && (
                <p className="text-[11px] text-destructive mt-1 font-medium">
                  ⚠️ Наценка ниже безопасного минимума ({Math.round(SAFETY_FLOOR_MARKUP * 100)}%)
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Розница за 1000:</span>
                <span className="font-bold text-foreground font-mono">{retailPricePer1000Rub.toFixed(2)} ₽</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Прибыль (с 1000 шт):</span>
                <span className="font-bold text-green-600 dark:text-green-400 font-mono">
                  +{(retailPricePer1000Rub - costPer1000Rub).toFixed(2)} ₽
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                <span className="font-semibold text-foreground">Розница за 1 шт:</span>
                <span className="font-extrabold text-primary font-mono text-sm">{retailPricePerUnitRub} ₽</span>
              </div>
            </div>
          </div>

          {/* Provider Binding */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-2xs">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>🔌</span> Провайдер API
            </h2>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Провайдер</label>
              <select
                value={providerId}
                onChange={e => setProviderId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              >
                <option value="">Без провайдера</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-foreground block">ID услуги у провайдера</label>
                {providerId && providerId !== '' && (
                  <Button
                    type="button"
                    intent="outline"
                    size="sm"
                    onClick={() => setIsSearchModalOpen(true)}
                    className="h-6 px-2 text-[11px] font-bold text-primary flex items-center gap-1 cursor-pointer bg-primary/5 hover:bg-primary/10 border-primary/20"
                    title="Найти услугу в кэше API провайдера и заполнить форму"
                  >
                    <Search className="w-3 h-3" />
                    <span>Выбрать из API</span>
                  </Button>
                )}
              </div>
              <input
                type="text"
                value={externalId}
                onChange={e => setExternalId(e.target.value)}
                placeholder="Например: 1234"
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-mono font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>

            {initialData.id && (
              <div className="pt-3 border-t border-border/60">
                <Link
                  href={`/admin/services/${initialData.id}/routing`}
                  className="flex items-center justify-between p-3 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/20 text-primary text-xs font-semibold transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">⚡</span>
                    <span>Резервные маршруты (Failover)</span>
                  </span>
                  <span className="text-[11px] underline group-hover:translate-x-0.5 transition-transform">Настроить &rarr;</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>

    {/* Provider API Cache Search Modal */}
    <ProviderServiceSearchModal
      isOpen={isSearchModalOpen}
      onOpenChange={setIsSearchModalOpen}
      providerId={providerId || null}
      onSelect={handleSelectProviderService}
    />
  </>
  );
}
