'use client';

import React, { useState, useMemo } from 'react';
import { sanitizeServiceDescription } from '@/lib/sanitize';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export interface ServiceFormData {
  name: string;
  providerUrl?: string;
  costPrice: number;
  markupPercent: number;
  description: string;
}

interface ServiceFormProps {
  initialData?: Partial<ServiceFormData>;
  onSubmit?: (data: ServiceFormData & { sellingPrice: number }) => Promise<void> | void;
}

export function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function SafeDescription({ html }: { html?: string | null }) {
  if (!html) return null;
  const clean = sanitizeServiceDescription(html);
  return (
    <div
      className="text-xs text-muted-foreground leading-relaxed prose dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export function ServiceForm({ initialData, onSubmit }: ServiceFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [providerUrl, setProviderUrl] = useState(initialData?.providerUrl || '');
  const [costPrice, setCostPrice] = useState<number>(initialData?.costPrice ?? 0);
  const [markupPercent, setMarkupPercent] = useState<number>(initialData?.markupPercent ?? 20);
  const [description, setDescription] = useState(initialData?.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real-time live markup calculator
  const sellingPrice = useMemo(() => {
    const base = costPrice * (1 + markupPercent / 100);
    return Math.ceil(base);
  }, [costPrice, markupPercent]);

  const profit = sellingPrice - costPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // URL validation
    if (providerUrl.trim() && !validateUrl(providerUrl.trim())) {
      const err = 'Некорректный формат ссылки. Пример: https://example.com/service/123';
      setErrorMessage(err);
      toast.error(err);
      return;
    }

    try {
      setIsSubmitting(true);
      const sanitizedDesc = sanitizeServiceDescription(description);
      
      if (onSubmit) {
        await onSubmit({
          name,
          providerUrl: providerUrl.trim(),
          costPrice,
          markupPercent,
          description: sanitizedDesc,
          sellingPrice,
        });
      }
      toast.success('Услуга успешно сохранена');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка при сохранении';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-card border border-border p-6 rounded-2xl shadow-2xs">
      {errorMessage && (
        <div role="status" aria-live="polite" className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive font-medium">
          {errorMessage}
        </div>
      )}

      {/* Name Input */}
      <div>
        <label htmlFor="service-name" className="text-xs font-semibold text-foreground mb-1 block">
          Название услуги
        </label>
        <input
          id="service-name"
          aria-label="Название услуги"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Например: Просмотры видео Быстрые"
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />
      </div>

      {/* Provider URL Input */}
      <div>
        <label htmlFor="provider-url" className="text-xs font-semibold text-foreground mb-1 block">
          Ссылка на услугу у провайдера
        </label>
        <input
          id="provider-url"
          aria-label="Ссылка"
          type="text"
          value={providerUrl}
          onChange={(e) => setProviderUrl(e.target.value)}
          placeholder="https://example.com/service/123"
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />
      </div>

      {/* Live Real-time Markup Calculator */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/40 rounded-xl border border-border">
        <div>
          <label htmlFor="cost-price" className="text-xs font-semibold text-foreground mb-1 block">
            Цена закупки (₽)
          </label>
          <input
            id="cost-price"
            aria-label="Цена закупки"
            type="number"
            min="0"
            step="0.01"
            value={costPrice === 0 ? '' : costPrice}
            onChange={(e) => setCostPrice(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-mono font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
        </div>

        <div>
          <label htmlFor="markup-percent" className="text-xs font-semibold text-foreground mb-1 block">
            Наценка (%)
          </label>
          <input
            id="markup-percent"
            aria-label="Наценка"
            type="number"
            min="0"
            max="1000"
            value={markupPercent === 0 ? '' : markupPercent}
            onChange={(e) => setMarkupPercent(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-mono font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
        </div>

        <div className="flex flex-col justify-center bg-card p-3 rounded-xl border border-border/80">
          <label className="text-xs font-extrabold text-green-600 dark:text-green-400">
            Итоговая цена: {sellingPrice} ₽
          </label>
          <span className="text-[11px] text-muted-foreground mt-0.5">
            Прибыль: <strong className="text-foreground">{profit} ₽</strong>
          </span>
        </div>
      </div>

      {/* Description & Preview */}
      <div>
        <label htmlFor="service-description" className="text-xs font-semibold text-foreground mb-1 block">
          Описание (HTML / Markdown)
        </label>
        <textarea
          id="service-description"
          aria-label="Описание"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Краткое описание скорости, правил и гарантий..."
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs leading-relaxed focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
        />
        {description && (
          <div className="mt-2 p-3 bg-muted/20 border border-border rounded-xl">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
              Безопасный предпросмотр (XSS Clean)
            </span>
            <SafeDescription html={description} />
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 text-xs font-bold cursor-pointer"
        >
          {isSubmitting ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}
