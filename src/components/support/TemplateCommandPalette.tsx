'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';

interface TemplateCommandPaletteProps {
  templates: Array<{
    id: string;
    label: string;
    text: string;
    shortcut?: string | null;
    category?: string;
    useCount?: number;
  }>;
  onSelect: (template: { id: string; label: string; text: string }) => void;
  onClose: () => void;
  onCreateNew: () => void;
  isOpen: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: '📋 Общие',
  ORDER: '📦 Заказы',
  ORDERS: '📦 Заказы',
  PAYMENT: '💳 Оплата и возвраты',
  LEGAL: '⚖️ Юридические / 152-ФЗ',
  ACCOUNT: '👤 Аккаунт и доступ',
};

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function TemplateCommandPalette({
  templates,
  onSelect,
  onClose,
  onCreateNew,
  isOpen,
}: TemplateCommandPaletteProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  /* Close on outside click */
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  /* Close on Escape */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  /* Group templates by category */
  const grouped = useMemo(() => {
    const map = new Map<string, typeof templates>();
    for (const t of templates) {
      const key = (t.category ?? 'GENERAL').toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [templates]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 w-80 md:w-96 z-50 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
      aria-label="Палитра шаблонов"
    >
      <Command
        onKeyDown={handleKeyDown}
        className="rounded-xl border border-border bg-card shadow-xl"
      >
        <CommandInput placeholder="Поиск шаблона…" aria-label="Поиск шаблона" />

        <CommandList className="max-h-[400px] overflow-y-auto">
          <CommandEmpty>Шаблоны не найдены</CommandEmpty>

          {[...grouped.entries()].map(([category, items]) => (
            <CommandGroup
              key={category}
              heading={CATEGORY_LABELS[category] ?? category}
            >
              {items.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.label} ${t.text}`}
                  onSelect={() => onSelect({ id: t.id, label: t.label, text: t.text })}
                  className="flex items-center gap-2 transition-all duration-200"
                  aria-label={`Шаблон: ${t.label}`}
                >
                  <span className="truncate font-medium text-foreground">
                    {t.label}
                  </span>

                  {t.shortcut && (
                    <kbd className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {t.shortcut}
                    </kbd>
                  )}

                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {truncate(t.text)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>

        <CommandSeparator />

        <button
          type="button"
          onClick={onCreateNew}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-primary transition-all duration-200 hover:bg-muted"
          aria-label="Создать новый шаблон"
        >
          <Plus className="size-4" />
          <span>+ Создать шаблон</span>
        </button>
      </Command>
    </div>
  );
}
