import React from "react";
import { Sparkles } from "lucide-react";

interface MobileStep1UrlHintProps {
  urlHint?: string | null;
  hasLinkError: boolean;
  url: string;
  setUrl: (url: string, shouldInfer?: boolean) => void;
}

export function MobileStep1UrlHint({
  urlHint,
  hasLinkError,
  url,
  setUrl,
}: MobileStep1UrlHintProps) {
  if (!urlHint || hasLinkError) return null;

  return (
    <div className="flex flex-col gap-2 p-3 bg-content2/80 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-foreground/90 font-medium leading-relaxed">
          {urlHint}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-6">
        <span className="text-[11px] text-muted-foreground font-semibold">Добавить адрес:</span>
        {['t.me/', 'vk.com/', 'instagram.com/'].map((prefix) => (
          <button
            key={prefix}
            type="button"
            onClick={() => {
              const raw = url.replace(/^@/, '').trim();
              setUrl(`${prefix}${raw}`, true);
            }}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-primary/10 hover:bg-primary/20 text-primary active:scale-95 transition-all cursor-pointer min-h-[32px]"
          >
            +{prefix}
          </button>
        ))}
      </div>
    </div>
  );
}
