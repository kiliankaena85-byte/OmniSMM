'use client';

import React, { useState, useEffect, useTransition, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Bug, 
  Copy, 
  Check, 
  Send, 
  AlertTriangle, 
  Monitor, 
  Globe, 
  User, 
  Terminal,
  Sparkles,
  Camera,
  Image as ImageIcon,
  Trash2,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { submitBugReportAction } from "@/actions/admin/bug-reports";

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTenant: string;
  checkoutMode: string;
}

export function BugReportModal({
  isOpen,
  onClose,
  currentTenant,
  checkoutMode,
}: BugReportModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"CRITICAL" | "NORMAL" | "LOW">("NORMAL");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [context, setContext] = useState({
    url: "",
    viewport: "",
    userAgent: "",
    role: "Определяется...",
  });

  useEffect(() => {
    if (typeof window !== "undefined" && isOpen) {
      const match = document.cookie.match(/auth_token=([^;]+)/);
      const isOwner = document.cookie.includes("owner") || window.location.pathname.startsWith("/admin");
      const userRole = isOwner ? "Владелец / Администратор" : match ? "Авторизованный клиент" : "Гость";

      setContext({
        url: window.location.pathname + window.location.search,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: navigator.userAgent,
        role: userRole,
      });

      // Слушатель вставки скриншота из буфера (Ctrl+V)
      const handlePaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = (event) => {
                const base64 = event.target?.result as string;
                setScreenshot(base64);
                toast.success("📸 Скриншот успешно вставлен из буфера обмена!");
              };
              reader.readAsDataURL(blob);
            }
          }
        }
      };

      window.addEventListener("paste", handlePaste);
      return () => window.removeEventListener("paste", handlePaste);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Захват экрана через встроенный Screen Capture API браузера
  const handleNativeScreenCapture = async () => {
    try {
      setIsCapturing(true);
      if (!navigator.mediaDevices?.getDisplayMedia) {
        toast.info("Нажмите Win+Shift+S (PrintScreen) и вставьте скриншот через Ctrl+V");
        setIsCapturing(false);
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" } as MediaTrackConstraints,
      });

      const track = stream.getVideoTracks()[0];
      const imageCapture = new (window as unknown as { ImageCapture: new (t: MediaStreamTrack) => { grabFrame: () => Promise<ImageBitmap> } }).ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      track.stop();

      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const dataUrl = canvas.toDataURL("image/png", 0.85);
        setScreenshot(dataUrl);
        toast.success("📸 Снимок экрана успешно сделан!");
      }
    } catch {
      toast.info("Вы можете просто вставить любой скриншот через Ctrl+V");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setScreenshot(event.target?.result as string);
        toast.success("🖼️ Изображение прикреплено к отчету!");
      };
      reader.readAsDataURL(file);
    }
  };

  const buildMarkdownReport = () => {
    return `### 🐛 БАГ-РЕПОРТ: ${title || "Без названия"}
**Приоритет:** ${priority === "CRITICAL" ? "🔴 КРИТИЧЕСКИЙ" : priority === "NORMAL" ? "🟡 СРЕДНИЙ" : "🟢 МИНОРНЫЙ"}
**URL:** \`${context.url || "/"}\`
**Бренд:** \`${currentTenant.toUpperCase()}\`
**Режим чекаута:** \`${checkoutMode}\`
**Роль:** ${context.role}
**Разрешение:** ${context.viewport}
**Скриншот:** ${screenshot ? "Прикреплен (Base64)" : "Отсутствует"}

#### 📝 Описание проблемы и шаги воспроизведения:
${description || "Описание не указано"}
`;
  };

  const handleCopyMarkdown = async () => {
    const md = buildMarkdownReport();
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      toast.success("📋 Markdown-отчет скопирован в буфер! Вставьте его в чат.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не удалось скопировать в буфер");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Пожалуйста, укажите заголовок бага");
      return;
    }

    startTransition(async () => {
      const res = await submitBugReportAction({
        title: title.trim(),
        description: description.trim(),
        priority,
        url: context.url,
        tenantId: currentTenant,
        role: context.role,
        viewport: context.viewport,
        userAgent: context.userAgent,
        checkoutMode,
        screenshot: screenshot || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        onClose();
        setTitle("");
        setDescription("");
        setScreenshot(null);
      } else {
        toast.error(res.error || "Ошибка при отправке");
      }
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="w-full max-w-xl bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <Bug className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Быстрый Баг-Репорт</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-mono border border-zinc-700">QA Tool</span>
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Мгновенная фиксация инцидента со скриншотом и тех-контекстом
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs custom-scrollbar">
            {/* 1. Title */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                Заголовок проблемы <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Кнопка «Оплатить» не реагирует при выборе СБП"
                className="w-full h-9 px-3 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-500 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                autoFocus
              />
            </div>

            {/* 2. Priority */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                Приоритет проблемы
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "CRITICAL", label: "🔴 Критический (Блокер)", cls: "hover:bg-red-500/10 active:bg-red-500/20", activeCls: "bg-red-500/20 text-red-300 border-red-500/50 font-bold" },
                  { id: "NORMAL", label: "🟡 Средний (Баг UI/UX)", cls: "hover:bg-amber-500/10 active:bg-amber-500/20", activeCls: "bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold" },
                  { id: "LOW", label: "🟢 Минорный (Косметика)", cls: "hover:bg-emerald-500/10 active:bg-emerald-500/20", activeCls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id as "LOW" | "NORMAL" | "CRITICAL")}
                    className={`h-8 px-2 rounded-lg border text-[11px] transition-all cursor-pointer flex items-center justify-center ${
                      priority === p.id
                        ? p.activeCls
                        : `bg-zinc-900 border-zinc-800 text-zinc-400 ${p.cls}`
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Description */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                Что пошло не так / Шаги воспроизведения
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="1. Зашел на страницу оформления&#10;2. Выбрал Telegram -> Подписчики&#10;3. Нажал оплату, форма затряслась, но заказ не создался..."
                rows={3}
                className="w-full p-3 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-500 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all resize-none"
              />
            </div>

            {/* 4. Screenshot Uploader / Pasted Area */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-400" />
                  Скриншот экрана (Ctrl+V или Снимок)
                </span>
                <span className="text-[10px] text-zinc-400 font-normal">Поддерживает вставку из буфера</span>
              </div>

              {!screenshot ? (
                <div className="border border-dashed border-zinc-750 hover:border-zinc-600 bg-zinc-900/60 rounded-xl p-3 flex items-center justify-between gap-3 transition-colors">
                  <div className="flex items-center gap-2.5 text-zinc-400">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-zinc-200">Нажмите Ctrl+V для вставки скриншота</p>
                      <p className="text-[10px] text-zinc-400">или прикрепите файл с диска</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-7 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Файл</span>
                    </button>
                    <button
                      type="button"
                      disabled={isCapturing}
                      onClick={handleNativeScreenCapture}
                      className="h-7 px-2.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3 h-3 text-blue-400" />
                      <span>{isCapturing ? "Снимок..." : "Снимок"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 group">
                  <img 
                    src={screenshot} 
                    alt="Скриншот проблемы" 
                    className="w-full max-h-40 object-contain bg-black/40 p-1" 
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setScreenshot(null)}
                      className="p-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white shadow-lg transition-colors cursor-pointer"
                      title="Удалить скриншот"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Auto-gathered technical context */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-emerald-400" />
                  Авто-собранный тех-контекст:
                </span>
                <span className="text-emerald-400">Captured ✓</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="flex items-center gap-1.5 text-zinc-400 truncate">
                  <Globe className="w-3 h-3 text-zinc-500 shrink-0" />
                  <span className="truncate" title={context.url}>URL: <strong className="text-zinc-200">{context.url || "/"}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400 truncate">
                  <Monitor className="w-3 h-3 text-zinc-500 shrink-0" />
                  <span>Экран: <strong className="text-zinc-200">{context.viewport}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400 truncate">
                  <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                  <span>Бренд: <strong className="text-zinc-200 uppercase">{currentTenant}</strong> ({checkoutMode})</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400 truncate">
                  <User className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">Роль: <strong className="text-zinc-200">{context.role}</strong></span>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 text-[11px]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Скопировано!" : "Копировать для чата"}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white font-semibold transition-all cursor-pointer text-xs"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-9 px-5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-red-600/25 transition-all cursor-pointer active:scale-95 text-xs disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPending ? "Сохранение..." : "Отправить баг-репорт"}</span>
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
