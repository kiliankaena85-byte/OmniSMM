'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { ChatTemplateManager, type SupportTemplateDTO } from '../ChatTemplateManager';

interface ChatTopToolbarProps {
  isStaff: boolean;
  templatesList: SupportTemplateDTO[];
  setTemplatesList: React.Dispatch<React.SetStateAction<SupportTemplateDTO[]>>;
  onSelectTemplate: (t: SupportTemplateDTO) => void;
  onAiReply: () => void;
  isAiPending: boolean;
  isInternal: boolean;
  setIsInternal: (val: boolean) => void;
  onOpenStateChange?: (isOpen: boolean) => void;
}

export function ChatTopToolbar({
  isStaff,
  templatesList,
  setTemplatesList,
  onSelectTemplate,
  onAiReply,
  isAiPending,
  isInternal,
  setIsInternal,
  onOpenStateChange,
}: ChatTopToolbarProps) {
  if (!isStaff) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 mb-2">
      <div className="flex items-center gap-1.5">
        <ChatTemplateManager 
          templatesList={templatesList}
          setTemplatesList={setTemplatesList}
          onSelectTemplate={onSelectTemplate}
          onOpenStateChange={onOpenStateChange}
        />

        <button
          type="button"
          onClick={onAiReply}
          disabled={isAiPending}
          className="flex items-center justify-center gap-1 px-3 h-11 text-xs font-semibold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all rounded-xl disabled:opacity-50 cursor-pointer"
          title="Автоматический ответ ИИ"
          aria-label="Автоматический ответ ИИ"
        >
          {isAiPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>AI Ответ</span>
        </button>
      </div>

      <label 
        aria-label="Внутренняя скрытая заметка"
        className="flex items-center gap-2 text-xs text-warning-text font-semibold cursor-pointer bg-warning/5 hover:bg-warning/15 px-3 h-11 rounded-xl border border-warning/20 transition-colors shrink-0"
      >
        <input
          type="checkbox"
          checked={isInternal}
          onChange={(e) => setIsInternal(e.target.checked)}
          className="rounded border-warning/35 text-warning focus:ring-warning w-4 h-4 cursor-pointer" 
          aria-label="Включить скрытую заметку"
        />
        <span>🔒 Заметка</span>
      </label>
    </div>
  );
}
