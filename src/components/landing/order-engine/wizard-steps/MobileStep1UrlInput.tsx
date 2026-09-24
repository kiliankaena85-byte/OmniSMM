import React from "react";
import { CheckCircle2, ClipboardPaste, Link2 } from "lucide-react";
import { toast } from "sonner";

interface MobileStep1UrlInputProps {
  url: string;
  setUrl: (url: string, shouldInfer?: boolean) => void;
  setEmail: (email: string) => void;
  isFocused: boolean;
  setIsFocused: (focused: boolean) => void;
  hasLinkError: boolean;
  localUrlError: string | null;
  setLocalUrlError: (error: string | null) => void;
  isEmailDetected: boolean;
  proceedFromStep1: () => void;
  placeholder?: string;
  label?: string;
}

export function MobileStep1UrlInput({
  url,
  setUrl,
  setEmail,
  isFocused,
  setIsFocused,
  hasLinkError,
  localUrlError,
  setLocalUrlError,
  isEmailDetected,
  proceedFromStep1,
  placeholder,
  label,
}: MobileStep1UrlInputProps) {
  const [isPasted, setIsPasted] = React.useState(false);

  const handlePasteFromClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().length > 0) {
          const trimmed = text.trim();
          const lines = trimmed.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
          const isMultiLine = lines.length > 1;

          setUrl(lines[0] || trimmed, true);
          if (localUrlError) setLocalUrlError(null);
          setIsPasted(true);
          setTimeout(() => setIsPasted(false), 1500);

          if (isMultiLine) {
            toast.warning("Оставлена 1 первая ссылка. Пожалуйста, оформляйте заказы по одному.", { duration: 6000 });
          }
        }
      }
    } catch {
      // Non-blocking clipboard permission fallback
    }
  };

  return (
    <div className={`relative w-full group rounded-2xl transition-all duration-300 ${isFocused ? 'p-[2px] scale-[1.01]' : 'p-[1px] scale-100'}`}>
      <div
        className={`absolute inset-0 rounded-2xl transition-opacity duration-300 pointer-events-none ${
          hasLinkError ? "warning-border-shimmer opacity-100" : "google-border-shimmer opacity-100"
        }`}
      />
      <div
        className={`absolute inset-0 rounded-2xl transition-all duration-300 pointer-events-none blur-md ${
          hasLinkError
            ? "warning-border-shimmer opacity-40"
            : isFocused
            ? "google-border-shimmer opacity-60 scale-[1.02]"
            : "google-border-shimmer opacity-20 group-hover:opacity-35"
        }`}
      />
      <div className="relative flex items-center w-full bg-content1 rounded-2xl p-0.5 z-10">
        <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <input
          id="standard-url-input"
          type="text"
          inputMode="url"
          autoComplete="url"
          value={url}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={e => {
            setUrl(e.target.value);
            if (localUrlError) setLocalUrlError(null);
          }}
          onPaste={e => {
            e.preventDefault();
            const text = e.clipboardData?.getData('text');
            if (text && text.trim().length > 0) {
              const trimmed = text.trim();
              const lines = trimmed.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
              const isMultiLine = lines.length > 1;

              setUrl(lines[0] || trimmed, true);
              if (localUrlError) setLocalUrlError(null);

              if (isMultiLine) {
                toast.warning("Оставлена 1 первая ссылка. Пожалуйста, оформляйте заказы по одному.", { duration: 6000 });
              }
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (isEmailDetected) {
                setEmail(url.trim());
                setUrl("");
                if (localUrlError) setLocalUrlError(null);
                toast.success("Email сохранен! Теперь вставьте ссылки на продвижение.");
                return;
              }
              proceedFromStep1();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder={placeholder || "https://t.me/channel или vk.com/..."}
          aria-label={label || "Введите ссылку для продвижения"}
          aria-describedby={hasLinkError ? "mobile-step1-url-error" : undefined}
          className={`w-full h-12 pl-10.5 ${url.trim().length > 0 ? 'pr-12' : 'pr-14 sm:pr-28'} rounded-2xl bg-transparent text-base font-semibold text-foreground placeholder:text-muted-foreground/50 outline-none border-none transition-all`}
        />
        {url.trim().length === 0 ? (
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-10 px-2 sm:px-3.5 min-h-[44px] min-w-[44px] rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
          >
            {isPasted ? (
              <><CheckCircle2 className="w-4 h-4" /><span className="hidden sm:inline">Вставлено!</span></>
            ) : (
              <><ClipboardPaste className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">Вставить</span></>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setUrl('');
              if (localUrlError) setLocalUrlError(null);
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 min-w-[44px] min-h-[44px] rounded-xl bg-content2 hover:bg-content3 flex items-center justify-center text-muted-foreground hover:text-foreground text-sm font-bold cursor-pointer transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-primary"
            title="Очистить ссылку"
            aria-label="Очистить ссылку"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
