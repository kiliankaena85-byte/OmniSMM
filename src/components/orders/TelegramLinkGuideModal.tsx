'use client';

import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  Monitor, 
  CheckCircle2, 
  Sparkles, 
  ChevronRight, 
  Copy, 
  Check, 
  AlertCircle,
  MoreHorizontal,
  MoreVertical,
  MousePointer,
  Share2,
  Image as ImageIcon,
  Layers,
  ClipboardPaste,
  ShieldCheck,
  Zap,
  Info,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { LinkGuideService, PlatformDeviceGuide } from '@/services/catalog/link-guide.service';

interface TelegramLinkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyLink?: (link: string) => void;
  tenantVariant?: 'classic' | 'neon' | 'custom';
}

export function TelegramLinkGuideModal({
  isOpen,
  onClose,
  onApplyLink,
  tenantVariant = 'classic'
}: TelegramLinkGuideModalProps) {
  const guideData = LinkGuideService.getTelegramPhotoViewsGuide();
  const [selectedDevice, setSelectedDevice] = useState<'ios' | 'android' | 'desktop'>('ios');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [testLink, setTestLink] = useState('');

  if (!isOpen) return null;

  const currentDeviceGuide: PlatformDeviceGuide = 
    guideData.devices.find(d => d.device === selectedDevice) || guideData.devices[0];

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) setTestLink(text);
      }
    } catch {
      // Fallback
    }
  };

  const handleTestLinkValidation = () => {
    if (!testLink.trim()) return null;
    const lower = testLink.toLowerCase().trim();
    if (lower.includes('t.me/') || lower.includes('telegram.me/')) {
      const isSingle = lower.includes('?single');
      const parts = lower.split('/');
      const lastPart = parts[parts.length - 1]?.split('?')[0];
      const isPost = !isNaN(Number(lastPart));

      if (isPost) {
        return {
          valid: true,
          postId: lastPart,
          isSingle,
          message: `Ссылка корректна! Сообщение #${lastPart} ${isSingle ? '(конкретное фото)' : '(основной пост)'}`
        };
      }
      return {
        valid: true,
        message: 'Ссылка на канал/публикацию распознана'
      };
    }
    return {
      valid: false,
      message: 'Укажите ссылку формата https://t.me/channel/123'
    };
  };

  const validationResult = handleTestLinkValidation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-card text-card-foreground border border-border/80 rounded-[2.5rem] p-5 sm:p-8 max-h-[94vh] overflow-y-auto shadow-2xl space-y-6 relative transition-all bg-card/98">
        
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4 sticky top-0 bg-card/90 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl shrink-0 bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="w-5 h-5 shrink-0" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                  Как скопировать ссылку на фото в Telegram
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  SMMPLAN GUIDE
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Нажмите на шаги, чтобы увидеть расположение кнопки в приложении Telegram
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── DEVICE SWITCHER TABS ── */}
        <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-secondary/40 border border-border/50">
          {guideData.devices.map(dev => {
            const isActive = selectedDevice === dev.device;
            return (
              <button
                key={dev.device}
                type="button"
                onClick={() => {
                  setSelectedDevice(dev.device);
                  setActiveStepIndex(0);
                }}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer min-h-[46px] ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                }`}
              >
                <span className="text-base">{dev.icon}</span>
                <span className="font-extrabold">{dev.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── MAIN INTERACTIVE GRID: HIGH-FIDELITY PHONE + INTERACTIVE STEPS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          
          {/* 📱 LEFT: B2B TELEGRAM PHONE SCREEN WITH EXPLICIT DEMO BADGE (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-[290px] sm:max-w-[315px] rounded-[2.8rem] p-4 bg-neutral-950 border-[5px] border-neutral-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] text-white font-sans relative overflow-hidden ring-1 ring-neutral-700/50">
              
              {/* Dynamic Island / Status Bar */}
              <div className="flex items-center justify-between px-3 pt-0.5 pb-2 text-[10px] text-neutral-400 font-mono">
                <span>09:41</span>
                <div className="w-20 h-4 bg-black rounded-full flex items-center justify-center gap-1.5 border border-neutral-800">
                  <div className="w-2 h-2 rounded-full bg-neutral-800" />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-950" />
                </div>
                <span>5G 100%</span>
              </div>

              {/* 🏷️ EXPLICIT DEMO BADGE */}
              <div className="flex items-center justify-between px-2 py-1 mb-1.5 rounded-xl bg-blue-950/80 border border-blue-500/30 text-[9px] text-blue-200">
                <span className="font-bold flex items-center gap-1">
                  <Info className="w-3 h-3 text-blue-400 shrink-0" />
                  НАГЛЯДНЫЙ ДЕМО-ОБРАЗЕЦ
                </span>
                <span className="text-[8px] font-mono text-blue-400">Шаблон</span>
              </div>

              {/* Telegram Channel Header Bar */}
              <div className="flex items-center justify-between px-2 py-2 border-b border-neutral-800/80 bg-neutral-900/60 rounded-2xl mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 via-indigo-600 to-blue-700 flex items-center justify-center text-xs font-black text-white shadow-md">
                    PRO
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold text-xs block leading-tight text-neutral-100">Бизнес & Маркетинг PRO</span>
                      <span className="text-blue-400 text-[10px]">✓</span>
                    </div>
                    <span className="text-[9px] text-neutral-400 font-medium">65 000 подписчиков</span>
                  </div>
                </div>

                {/* Top Action Menu */}
                {selectedDevice === 'ios' ? (
                  <div className={`p-1.5 rounded-xl transition-all ${activeStepIndex === 1 ? 'bg-primary text-white scale-110 ring-2 ring-primary/80 animate-pulse' : 'text-neutral-400'}`}>
                    <MoreHorizontal className="w-4 h-4" />
                  </div>
                ) : selectedDevice === 'android' ? (
                  <div className={`p-1.5 rounded-xl transition-all ${activeStepIndex === 1 ? 'bg-primary text-white scale-110 ring-2 ring-primary/80 animate-pulse' : 'text-neutral-400'}`}>
                    <MoreVertical className="w-4 h-4" />
                  </div>
                ) : (
                  <MousePointer className="w-4 h-4 text-neutral-400" />
                )}
              </div>

              {/* Telegram Post Body with Simulated Photo */}
              <div className="space-y-2">
                <div className={`rounded-2xl p-2.5 bg-neutral-900 border transition-all duration-300 ${
                  activeStepIndex === 0 
                    ? 'border-primary ring-2 ring-primary/50 shadow-lg shadow-primary/20' 
                    : 'border-neutral-800'
                }`}>
                  
                  {/* Photo Canvas Simulation */}
                  <div 
                    onClick={() => setActiveStepIndex(1)}
                    className="relative rounded-xl overflow-hidden bg-gradient-to-tr from-slate-900 via-blue-950 to-indigo-950 h-36 flex flex-col items-center justify-center p-3 text-center border border-neutral-700/80 cursor-pointer group"
                  >
                    <ImageIcon className="w-9 h-9 text-blue-400/90 mb-1.5 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-black text-white leading-snug">
                      Пример публикации #150
                    </span>
                    <span className="text-[9px] text-neutral-300 mt-0.5 font-medium">
                      (Тапните для увеличения)
                    </span>

                    {/* Cursor pointer highlight on Step 1 */}
                    {activeStepIndex === 0 && (
                      <div className="absolute inset-0 bg-primary/25 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="px-3.5 py-1.5 rounded-full bg-primary text-white font-black text-[11px] shadow-2xl animate-bounce flex items-center gap-1">
                          👆 Нажмите на фото
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-neutral-300 mt-2 leading-tight">
                    📊 Аналитика за текущий квартал: конверсия выросла на 34%.
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[9px] text-neutral-500 mt-1 font-mono">
                    <span>14:20</span>
                    <span className="text-blue-400">✓✓</span>
                  </div>
                </div>

                {/* Simulated Telegram Context Menu Popup on Step 2 and 3 */}
                {activeStepIndex >= 1 && (
                  <div className="rounded-2xl p-2 bg-neutral-800/95 backdrop-blur-md border border-neutral-700 shadow-2xl space-y-1 animate-in zoom-in-95 duration-200">
                    <div className="text-[9px] font-bold text-neutral-400 px-2 py-0.5 uppercase tracking-wider">
                      Действия с медиафайлом
                    </div>
                    
                    <div className="px-2.5 py-1.5 rounded-xl text-[10px] text-neutral-400 flex items-center justify-between">
                      <span>Сохранить в галерею</span>
                    </div>

                    {/* TARGET HIGHLIGHTED BUTTON */}
                    <div 
                      onClick={() => setActiveStepIndex(2)}
                      className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-between cursor-pointer transition-all duration-200 ${
                        activeStepIndex === 2 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-500/40 ring-2 ring-white scale-102' 
                          : 'bg-primary text-white shadow-md animate-pulse'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Copy className="w-3.5 h-3.5" />
                        <span>Скопировать ссылку</span>
                      </div>
                      <span className="text-[9px] bg-black/30 px-1.5 py-0.5 rounded font-mono font-bold">
                        {selectedDevice === 'ios' ? '?single' : 'URL'}
                      </span>
                    </div>

                    <div className="px-2.5 py-1.5 rounded-xl text-[10px] text-neutral-400 flex items-center justify-between">
                      <span>Поделиться...</span>
                      <Share2 className="w-3 h-3" />
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Home Indicator */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-28 h-1 bg-neutral-700 rounded-full" />
              </div>
            </div>

            <span className="text-[10px] text-muted-foreground font-medium mt-3 text-center flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary" />
              Это интерактивный пример. В приложении выберите <strong>ваш</strong> пост.
            </span>
          </div>

          {/* 📋 RIGHT: DETAILED STEP CARDS (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary shrink-0" />
                Как найти ссылку в вашем Telegram:
              </span>
              <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-secondary text-foreground font-bold border border-border/50 shadow-sm">
                {currentDeviceGuide.badge}
              </span>
            </div>

            <div className="space-y-3">
              {currentDeviceGuide.steps.map((step, idx) => {
                const isCurrent = activeStepIndex === idx;
                return (
                  <div 
                    key={step.stepNumber}
                    onClick={() => setActiveStepIndex(idx)}
                    className={`p-4 sm:p-4.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                      isCurrent
                        ? 'bg-primary/5 border-primary shadow-md shadow-primary/5 ring-1 ring-primary'
                        : 'bg-card border-border/70 hover:border-border hover:bg-secondary/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 shadow-sm ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground'
                        }`}>
                          {step.stepNumber}
                        </span>
                        <div className="space-y-1">
                          <h4 className="text-xs sm:text-sm font-black text-foreground flex items-center gap-2">
                            <span>{step.title}</span>
                            {isCurrent && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                          </h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {step.instruction}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-xl bg-secondary text-foreground shrink-0 border border-border/40 hidden sm:inline">
                        {step.buttonHighlight}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 🖼️ ALBUM / MEDIAGROUP DUAL-ORDER SYNCHRONIZATION BOX */}
            <div className="p-4 sm:p-5 rounded-2xl border bg-amber-500/10 border-amber-500/30 text-foreground space-y-2.5 text-xs shadow-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Важно для медиагрупп и альбомов (2+ фото/видео)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Правило 2 заказов
                </span>
              </div>
              
              <p className="text-xs text-muted-foreground leading-relaxed">
                В Telegram разные устройства считывают просмотры по-разному: <strong className="text-foreground">Desktop/Web</strong> считает по первому фото, а <strong className="text-foreground">iOS и Android</strong> — по последнему.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-background/80 border border-border/70 space-y-0.5">
                  <span className="text-[10px] font-bold text-primary block">1. Первый заказ:</span>
                  <span className="font-mono text-[11px] text-foreground font-semibold">https://t.me/канал/101</span>
                  <span className="text-[10px] text-muted-foreground block">Синхронизирует Desktop / Web</span>
                </div>

                <div className="p-2.5 rounded-xl bg-background/80 border border-border/70 space-y-0.5">
                  <span className="text-[10px] font-bold text-amber-500 block">2. Второй заказ:</span>
                  <span className="font-mono text-[11px] text-foreground font-semibold">https://t.me/канал/105</span>
                  <span className="text-[10px] text-muted-foreground block">Синхронизирует iOS / Android</span>
                </div>
              </div>

              <div className="text-[11px] text-amber-700 dark:text-amber-300 font-medium bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 flex items-center gap-1.5">
                <span>⚡</span>
                <span>Оформите 2 отдельных заказа (на 1-е и последнее медиа), чтобы просмотры отображались одинаково у всех подписчиков!</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── LIVE LINK VALIDATOR & CLIPBOARD PASTE ── */}
        <div className="p-4 sm:p-5 rounded-3xl bg-secondary/40 border border-border/60 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Проверьте ссылку на ваш пост:</span>
            </label>

            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer bg-primary/10 px-2.5 py-1 rounded-xl transition-all"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Вставить из буфера</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Вставьте ссылку на ваш пост, например: https://t.me/mychannel/150"
              value={testLink}
              onChange={e => setTestLink(e.target.value)}
              className="flex-1 px-4 py-3 rounded-2xl bg-background border border-border focus:border-primary focus:outline-none text-foreground font-mono text-xs shadow-inner"
            />
            {onApplyLink && testLink && validationResult?.valid && (
              <button
                type="button"
                onClick={() => {
                  onApplyLink(testLink);
                  onClose();
                }}
                className="px-5 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer shrink-0 shadow-md bg-primary text-primary-foreground shadow-primary/20"
              >
                Применить в заказ
              </button>
            )}
          </div>

          {validationResult && (
            <div className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-bold ${
              validationResult.valid 
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                : 'bg-danger/10 border border-danger/20 text-danger'
            }`}>
              {validationResult.valid ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{validationResult.message}</span>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="pt-3 border-t border-border flex items-center justify-between sticky bottom-0 bg-card/90 backdrop-blur-md z-20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium hidden sm:flex">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>SMMPLAN ENGINE • Автоматическая маршрутизация заказов</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-7 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer min-h-[44px] shadow-md bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
          >
            Понятно, продолжить
          </button>
        </div>
      </div>
    </div>
  );
}
