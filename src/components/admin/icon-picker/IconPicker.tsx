'use client';

import React, { useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  X, 
  Sparkles, 
  Layers, 
  Code2, 
  Check, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { 
  ALL_ICONS, 
  BRAND_ICONS, 
  METRIC_ICONS, 
  FEATURE_ICONS, 
  ICONS_BY_ID,
  searchIconRegistry, 
  suggestIconsFromName,
  IconDefinition 
} from '@/lib/icons/icon-registry';
import { UniversalIcon } from '@/components/ui/UniversalIcon';
import { sanitizeSvg, isSvgMarkup } from '@/lib/icons/safe-svg';

export interface IconPickerProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  context?: 'network' | 'category' | 'service';
  suggestName?: string;
  disabled?: boolean;
}

type TabType = 'suggested' | 'brands' | 'metrics' | 'features' | 'custom';

export function IconPicker({
  value,
  onChange,
  label = 'Иконка',
  context = 'category',
  suggestName = '',
  disabled = false,
}: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('suggested');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom SVG state
  const [customSvgInput, setCustomSvgInput] = useState('');
  const [customSvgError, setCustomSvgError] = useState<string | null>(null);

  // Auto-suggestions based on current typing name
  const liveSuggestions = useMemo(() => {
    return suggestIconsFromName(suggestName, context);
  }, [suggestName, context]);

  // Current selected icon label
  const currentIconDef = useMemo(() => {
    if (!value) return null;
    return ICONS_BY_ID.get(value) || null;
  }, [value]);

  // Filtered icons by tab & search query
  const displayedIcons = useMemo(() => {
    if (searchQuery.trim()) {
      return searchIconRegistry(searchQuery);
    }
    switch (activeTab) {
      case 'suggested': {
        const combined = [...liveSuggestions];
        // Fill up with popular items
        const popular = context === 'network' ? BRAND_ICONS : (context === 'service' ? FEATURE_ICONS : METRIC_ICONS);
        for (const p of popular) {
          if (!combined.some(c => c.id === p.id)) {
            combined.push(p);
          }
        }
        return combined.slice(0, 24);
      }
      case 'brands':
        return BRAND_ICONS;
      case 'metrics':
        return METRIC_ICONS;
      case 'features':
        return FEATURE_ICONS;
      default:
        return ALL_ICONS;
    }
  }, [activeTab, searchQuery, liveSuggestions, context]);

  const handleSelectIcon = (iconId: string) => {
    onChange(iconId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleApplyCustomSvg = () => {
    setCustomSvgError(null);
    const sanitized = sanitizeSvg(customSvgInput);
    if (!sanitized.success || !sanitized.sanitized) {
      setCustomSvgError(sanitized.error || 'Некорректный SVG код');
      return;
    }
    onChange(`custom:${sanitized.sanitized}`);
    setIsOpen(false);
    setCustomSvgInput('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
          <span>{label}</span>
          {value && (
            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">
              {value.startsWith('custom:') ? 'Свой SVG' : value}
            </span>
          )}
        </label>
      )}

      {/* Main trigger card */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-3 px-3 py-2 border rounded-xl bg-card hover:bg-accent/40 transition-all text-left w-full group ${
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          } ${value ? 'border-primary/40 shadow-xs' : 'border-border/70 hover:border-border'}`}
        >
          <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 border border-border/50 text-foreground group-hover:scale-105 transition-transform">
            {value ? (
              <UniversalIcon icon={value} size={20} />
            ) : (
              <Sparkles className="w-4 h-4 text-muted-foreground/60" />
            )}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium text-foreground truncate">
              {currentIconDef ? currentIconDef.label : (value ? (value.startsWith('custom:') ? 'Пользовательский SVG' : value) : 'Выбрать визуальную иконку')}
            </span>
            <span className="text-[11px] text-muted-foreground truncate">
              {value ? 'Нажмите, чтобы изменить' : 'Кликните для выбора из каталога или вставки SVG'}
            </span>
          </div>

          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors shrink-0"
              title="Сбросить иконку"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </button>
      </div>

      {/* Quick 1-Click Suggestions Chips */}
      {liveSuggestions.length > 0 && !value && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 shrink-0">
            <Sparkles className="w-2.5 h-2.5 text-primary" />
            Подсказка:
          </span>
          {liveSuggestions.map((sug) => (
            <button
              key={sug.id}
              type="button"
              onClick={() => onChange(sug.id)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all hover:scale-105"
            >
              <UniversalIcon icon={sug.id} size={12} />
              <span>{sug.label.split('/')[0].trim()}</span>
            </button>
          ))}
        </div>
      )}

      {/* Icon Selection Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden border border-border/80 shadow-2xl bg-card">
          <DialogHeader className="p-4 pb-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Каталог SVG & Векторных иконок
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Выберите иконку из встроенного SMM-реестра или вставьте собственный код SVG.
            </DialogDescription>
          </DialogHeader>

          {/* Search & Tabs bar */}
          <div className="px-4 pt-3 pb-2 flex flex-col gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию, действию, тегам (рус/eng)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 text-xs h-9 bg-muted/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Navigation Tabs */}
            {!searchQuery && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('suggested')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
                    activeTab === 'suggested' 
                      ? 'bg-primary text-primary-foreground shadow-xs' 
                      : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  ✨ Рекомендуемые
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('brands')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
                    activeTab === 'brands' 
                      ? 'bg-primary text-primary-foreground shadow-xs' 
                      : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🌐 Соцсети & Бренды
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('metrics')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
                    activeTab === 'metrics' 
                      ? 'bg-primary text-primary-foreground shadow-xs' 
                      : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  📊 Метрики & Действия
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('features')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
                    activeTab === 'features' 
                      ? 'bg-primary text-primary-foreground shadow-xs' 
                      : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  ⚡ Свойства тарифов
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('custom')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
                    activeTab === 'custom' 
                      ? 'bg-primary text-primary-foreground shadow-xs' 
                      : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  ✍️ Свой SVG
                </button>
              </div>
            )}
          </div>

          {/* Tab Content */}
          <div className="px-4 py-2 min-h-[280px] max-h-[340px] overflow-y-auto">
            {activeTab === 'custom' && !searchQuery ? (
              <div className="flex flex-col gap-3 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40">
                  <Code2 className="w-4 h-4 text-primary shrink-0" />
                  <span>Вставьте код <code>&lt;svg ...&gt;...&lt;/svg&gt;</code>. Код будет автоматически проверен и очищен от вредоносных скриптов (OWASP).</span>
                </div>

                <textarea
                  rows={5}
                  value={customSvgInput}
                  onChange={(e) => {
                    setCustomSvgInput(e.target.value);
                    setCustomSvgError(null);
                  }}
                  placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">...</svg>'
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-primary/40 resize-none"
                />

                {customSvgError && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{customSvgError}</span>
                  </div>
                )}

                {isSvgMarkup(customSvgInput) && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 border border-border/50 rounded-lg">
                    <span className="text-xs text-muted-foreground">Превью:</span>
                    <div className="w-8 h-8 rounded-md bg-card border border-border flex items-center justify-center p-1 text-primary">
                      <UniversalIcon icon={`custom:${customSvgInput}`} size={22} />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyCustomSvg}
                    disabled={!customSvgInput.trim()}
                  >
                    Применить свой SVG
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                {displayedIcons.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <HelpCircle className="w-8 h-8 opacity-40 mb-2" />
                    <p className="text-xs">Иконки по запросу &laquo;{searchQuery}&raquo; не найдены</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1">Попробуйте ввести синоним (например, «лайк», «пост», «чат», «fast»)</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 py-1">
                    {displayedIcons.map((icon) => {
                      const isSelected = value === icon.id;
                      return (
                        <button
                          key={icon.id}
                          type="button"
                          onClick={() => handleSelectIcon(icon.id)}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center gap-1.5 group relative hover:scale-105 cursor-pointer ${
                            isSelected 
                              ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary' 
                              : 'border-border/60 bg-card/60 hover:bg-accent/50 hover:border-border text-foreground'
                          }`}
                          title={`${icon.label} (${icon.id})`}
                        >
                          <div className="w-7 h-7 flex items-center justify-center">
                            <UniversalIcon icon={icon.id} size={22} />
                          </div>
                          <span className="text-[10px] leading-tight text-foreground/80 line-clamp-1 group-hover:text-foreground font-medium">
                            {icon.label.split('/')[0].trim()}
                          </span>

                          {isSelected && (
                            <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-3 border-t border-border/50 bg-muted/20 flex justify-between items-center sm:justify-between">
            <span className="text-[11px] text-muted-foreground">
              {value ? `Выбрано: ${value.startsWith('custom:') ? 'Свой SVG' : value}` : 'Иконка не выбрана'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
