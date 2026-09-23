'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { SupportTemplateDTO } from '../ChatTemplateManager';

interface ChatTemplatesDropdownProps {
  show: boolean;
  templates: SupportTemplateDTO[];
  activeIndex: number;
  onSelect: (t: SupportTemplateDTO) => void;
}

export function ChatTemplatesDropdown({
  show,
  templates,
  activeIndex,
  onSelect,
}: ChatTemplatesDropdownProps) {
  return (
    <AnimatePresence>
      {show && templates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute bottom-full left-3 mb-2 w-[calc(100%-1.5rem)] md:w-96 bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl z-[90] overflow-hidden py-1.5 ring-1 ring-border/10"
        >
          <div className="px-3.5 py-1.5 border-b border-border/60 flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
            <span>⚡ Быстрые шаблоны ответов ({templates.length})</span>
            <span className="text-[9px] font-normal normal-case opacity-70">↑↓ навигация, Enter выбор</span>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-border/30">
            {templates.map((t, idx) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t)}
                className={`w-full text-left px-3.5 py-2.5 flex flex-col transition-all cursor-pointer ${
                  idx === activeIndex ? 'bg-primary/10 text-primary border-l-2 border-primary font-medium pl-3' : 'hover:bg-muted/40 text-foreground'
                }`}
              >
                <div className="flex justify-between items-center w-full gap-2">
                  <span className="text-xs font-bold truncate">{t.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.category && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground uppercase">
                        {t.category === 'LEGAL' ? '⚖️ 152-ФЗ' :
                         t.category === 'PAYMENT' ? '💳 Оплата' :
                         t.category === 'ORDER' ? '📦 Заказ' : '📋 Общие'}
                      </span>
                    )}
                    {t.shortcut && (
                      <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        /{t.shortcut}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground truncate w-full mt-0.5 opacity-90">{t.text}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
