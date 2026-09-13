'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Sparkles, 
  Copy, 
  Check, 
  AlertCircle, 
  MoreHorizontal, 
  MoreVertical, 
  MousePointer, 
  Share2, 
  Image as ImageIcon,
  Zap,
  CheckCircle2,
  ClipboardPaste,
  ShieldCheck,
  ScanLine
} from 'lucide-react';
import { LinkGuideService, PlatformDeviceGuide } from '@/services/catalog/link-guide.service';

interface FluxCyberLinkDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyLink?: (link: string) => void;
}

export function FluxCyberLinkDrawer({
  isOpen,
  onClose,
  onApplyLink
}: FluxCyberLinkDrawerProps) {
  const guideData = LinkGuideService.getTelegramPhotoViewsGuide();
  const [selectedDevice, setSelectedDevice] = useState<'ios' | 'android' | 'desktop'>('ios');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [testLink, setTestLink] = useState('');

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
          message: `Хэш найден: Публикация #${lastPart} ${isSingle ? '(конкретное фото)' : '(пост)'}`
        };
      }
      return {
        valid: true,
        message: 'Канонический URL Telegram подтвержден'
      };
    }
    return {
      valid: false,
      message: 'Требуется формат https://t.me/channel/123'
    };
  };

  const validationResult = handleTestLinkValidation();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          
          {/* ── BACKDROP BLUR WITH FADE TRANSITION ── */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-2xl cursor-pointer"
            aria-label="Закрыть шторку"
          />

          {/* ── SPRING-PHYSICS BOTTOM SHEET DRAWER (DRAG TO DISMISS) ── */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(e, info) => {
              if (info.offset.y > 120 || info.velocity.y > 400) {
                onClose();
              }
            }}
            className="relative z-10 w-full max-w-5xl mx-auto bg-[#080b14]/98 border-t border-x border-purple-500/35 rounded-t-[2.5rem] sm:rounded-t-[3rem] p-5 sm:p-8 max-h-[92vh] overflow-y-auto shadow-[0_-25px_60px_rgba(168,85,247,0.25)] space-y-6 touch-pan-y"
          >
            
            {/* Ambient Background Glow matching Landing Bento */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
            <div className="absolute top-0 left-0 w-80 h-80 bg-pink-600/15 rounded-full blur-3xl pointer-events-none -translate-y-1/2 -translate-x-1/2" />

            {/* Drag Handle Bar (Visual cue for swipe down) */}
            <div className="flex justify-center -mt-2 mb-1 cursor-grab active:cursor-grabbing">
              <div className="w-16 h-1.5 bg-gradient-to-r from-purple-500/60 via-pink-500/60 to-purple-500/60 rounded-full hover:scale-105 transition-transform" />
            </div>

            {/* ── CYBER HEADER ── */}
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-4 sticky top-0 bg-[#080b14]/95 backdrop-blur-md z-20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600/30 via-pink-600/20 to-purple-800/30 border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.3)] text-purple-300 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                  <Zap className="w-6 h-6 animate-pulse shrink-0" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                      <span>Как скопировать ссылку в Telegram</span>
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm">
                        FLUX HUD
                      </span>
                    </h2>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Нажмите на шаги, чтобы увидеть, как найти кнопку в вашем приложении
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-2xl bg-neutral-900/80 border border-neutral-700/60 flex items-center justify-center text-neutral-400 hover:text-white hover:border-purple-500/50 transition-all cursor-pointer active:scale-95"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── CAPSULE DEVICE SWITCHER (LANDING STYLE) ── */}
            <div className="flex items-center justify-center gap-2 p-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 max-w-md mx-auto shadow-inner">
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
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-full font-bold text-xs transition-all duration-200 cursor-pointer min-h-[44px] ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white shadow-[0_0_25px_rgba(217,70,239,0.35)] scale-102 font-extrabold'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                    }`}
                  >
                    <span>{dev.icon}</span>
                    <span>{dev.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ── HUD CONTENT: HORIZONTAL STEP CAROUSEL + NEON PHONE SIMULATOR ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              
              {/* 📱 LEFT: CYBER PHONE SIMULATOR (5 cols) */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="w-full max-w-[280px] sm:max-w-[305px] rounded-[2.6rem] p-3.5 bg-black border-[3px] border-purple-500/40 shadow-[0_0_40px_rgba(168,85,247,0.25)] text-white font-sans relative overflow-hidden">
                  
                  {/* Dynamic Island / Status Bar */}
                  <div className="flex items-center justify-between px-3 pt-0.5 pb-2 text-[9px] text-purple-300/70 font-mono">
                    <span>09:41</span>
                    <div className="w-16 h-3.5 bg-neutral-900 rounded-full flex items-center justify-center gap-1 border border-purple-500/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
                    </div>
                    <span>FLUX 5G</span>
                  </div>

                  {/* 🏷️ EXPLICIT DEMO BADGE */}
                  <div className="flex items-center justify-between px-2 py-1 mb-1.5 rounded-xl bg-purple-950/80 border border-purple-500/30 text-[9px] text-purple-200">
                    <span className="font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-pink-400 shrink-0" />
                      НАГЛЯДНЫЙ ДЕМО-ОБРАЗЕЦ
                    </span>
                    <span className="text-[8px] font-mono text-purple-400">Шаблон</span>
                  </div>

                  {/* Telegram Channel Header */}
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-neutral-800 bg-neutral-900/80 rounded-xl mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-black text-white shadow-md">
                        FX
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-extrabold text-[11px] block leading-tight text-white">FLUX Creative Studio</span>
                          <span className="text-pink-400 text-[9px]">★</span>
                        </div>
                        <span className="text-[8px] text-purple-400 font-mono">42 800 subscribers</span>
                      </div>
                    </div>

                    {selectedDevice === 'ios' ? (
                      <div className={`p-1 rounded-lg ${activeStepIndex === 1 ? 'bg-purple-500 text-white animate-bounce ring-2 ring-pink-400' : 'text-neutral-500'}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </div>
                    ) : selectedDevice === 'android' ? (
                      <div className={`p-1 rounded-lg ${activeStepIndex === 1 ? 'bg-purple-500 text-white animate-bounce ring-2 ring-pink-400' : 'text-neutral-500'}`}>
                        <MoreVertical className="w-4 h-4" />
                      </div>
                    ) : (
                      <MousePointer className="w-4 h-4 text-neutral-500" />
                    )}
                  </div>

                  {/* Simulated Post Body */}
                  <div className="space-y-2">
                    <div className={`rounded-2xl p-2 bg-neutral-900/90 border transition-all ${
                      activeStepIndex === 0 ? 'border-purple-500 ring-2 ring-purple-500/40 shadow-lg' : 'border-neutral-800'
                    }`}>
                      
                      {/* Photo Canvas */}
                      <div 
                        onClick={() => setActiveStepIndex(1)}
                        className="relative rounded-xl overflow-hidden bg-gradient-to-tr from-purple-950 via-slate-900 to-pink-950 h-32 flex flex-col items-center justify-center p-2 text-center border border-purple-500/30 cursor-pointer"
                      >
                        <ImageIcon className="w-8 h-8 text-purple-400 mb-1 animate-pulse" />
                        <span className="text-[11px] font-black text-white">
                          Пример: Фотография #150
                        </span>
                        <span className="text-[8px] text-purple-300/80">
                          [Тапните для зума]
                        </span>

                        {activeStepIndex === 0 && (
                          <div className="absolute inset-0 bg-purple-600/30 backdrop-blur-[1px] flex items-center justify-center">
                            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-[10px] shadow-lg animate-bounce">
                              👆 Тапните по фото
                            </span>
                          </div>
                        )}
                      </div>

                      <p className="text-[9px] text-neutral-300 mt-1.5 leading-tight">
                        🔥 Эксклюзивная фотосессия для нового релиза.
                      </p>
                    </div>

                    {/* Context Menu Popup on Step 2 / 3 */}
                    {activeStepIndex >= 1 && (
                      <div className="rounded-2xl p-2 bg-neutral-900/95 border border-purple-500/40 shadow-2xl space-y-1 animate-in zoom-in-95 duration-200">
                        <div className="text-[8px] font-bold text-purple-400 px-2 uppercase tracking-wider">
                          Меню действий в Telegram
                        </div>
                        
                        {/* Highlighted Button */}
                        <div 
                          onClick={() => setActiveStepIndex(2)}
                          className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black flex items-center justify-between cursor-pointer transition-all ${
                            activeStepIndex === 2 
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-white scale-102' 
                              : 'bg-purple-600 text-white animate-pulse'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Copy className="w-3.5 h-3.5" />
                            <span>Скопировать ссылку</span>
                          </div>
                          <span className="text-[8px] bg-black/40 px-1 rounded font-mono">
                            {selectedDevice === 'ios' ? '?single' : 'URL'}
                          </span>
                        </div>

                        <div className="px-2.5 py-1 rounded-lg text-[9px] text-neutral-500 flex items-center justify-between">
                          <span>Поделиться</span>
                          <Share2 className="w-3 h-3" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Line */}
                  <div className="flex justify-center pt-2 pb-0.5">
                    <div className="w-20 h-1 bg-purple-500/40 rounded-full" />
                  </div>
                </div>

                <span className="text-[10px] text-neutral-400 font-medium mt-2 text-center">
                  💡 Это наглядный пример. В приложении выберите <strong>ваш</strong> пост.
                </span>
              </div>

              {/* 📋 RIGHT: STEP TIMELINE SLIDER (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    Как найти ссылку в вашем Telegram:
                  </span>
                  <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-purple-950/60 text-purple-300 font-bold border border-purple-500/30">
                    Шаг {activeStepIndex + 1} из {currentDeviceGuide.steps.length}
                  </span>
                </div>

                {/* Horizontal Timeline Steps */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {currentDeviceGuide.steps.map((step, idx) => {
                    const isCurrent = activeStepIndex === idx;
                    return (
                      <div
                        key={step.stepNumber}
                        onClick={() => setActiveStepIndex(idx)}
                        className={`p-4 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                          isCurrent
                            ? 'bg-gradient-to-b from-purple-900/30 to-pink-900/20 border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.2)] ring-1 ring-purple-400 scale-[1.02]'
                            : 'bg-neutral-900/60 border-neutral-800/80 hover:border-neutral-700'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
                              isCurrent
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}>
                              {step.stepNumber}
                            </span>
                            <span className="text-[9px] font-mono font-bold text-purple-400/80">
                              {step.buttonHighlight}
                            </span>
                          </div>
                          <h4 className="text-xs font-black text-white leading-snug">
                            {step.title}
                          </h4>
                          <p className="text-[11px] text-neutral-400 leading-relaxed">
                            {step.instruction}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-neutral-800 text-[9px] font-mono text-neutral-500 truncate">
                          {step.sampleUrl}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dual-Order Album Synchronization Box (Radiant Cyber) */}
                <div className="p-4 rounded-3xl bg-gradient-to-r from-purple-950/60 via-neutral-900 to-pink-950/60 border border-purple-500/40 space-y-2.5 text-xs text-purple-200 shadow-inner">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-pink-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                      <Zap className="w-3.5 h-3.5 text-pink-400" />
                      Синхронизация альбомов (2+ фото)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                      2 ЗАКАЗА
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    <strong className="text-white">Desktop</strong> считывает просмотры с 1-го фото, а <strong className="text-white">iOS/Android</strong> — с последнего. Для 100% отображения просмотров на всех устройствах:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="p-2 rounded-xl bg-black/50 border border-purple-500/30 text-purple-300">
                      <span className="text-purple-400 font-bold block text-[9px]">1. СТАРТ:</span>
                      t.me/channel/101 (Desktop)
                    </div>
                    <div className="p-2 rounded-xl bg-black/50 border border-pink-500/30 text-pink-300">
                      <span className="text-pink-400 font-bold block text-[9px]">2. ФИНИШ:</span>
                      t.me/channel/105 (iOS/Android)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── CYBER SCANNER LINK INPUT ── */}
            <div className="p-4 sm:p-5 rounded-3xl bg-neutral-900/90 border border-purple-500/40 space-y-3 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-black text-white flex items-center gap-1.5 tracking-wide">
                  <ScanLine className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Проверьте ссылку на ваш пост:</span>
                </label>

                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="text-[11px] font-bold text-purple-300 hover:text-white flex items-center gap-1 cursor-pointer bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 px-3 py-1 rounded-full transition-all active:scale-95"
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
                  className="flex-1 px-4 py-3 rounded-2xl bg-black border border-purple-500/40 focus:border-pink-500 focus:outline-none text-white font-mono text-xs shadow-inner"
                />
                {onApplyLink && testLink && validationResult?.valid && (
                  <button
                    type="button"
                    onClick={() => {
                      onApplyLink(testLink);
                      onClose();
                    }}
                    className="px-6 py-3 rounded-2xl font-black text-xs bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white shadow-[0_0_25px_rgba(217,70,239,0.4)] hover:opacity-90 transition-all cursor-pointer shrink-0 active:scale-95"
                  >
                    Применить в форму
                  </button>
                )}
              </div>

              {validationResult && (
                <div className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-bold ${
                  validationResult.valid 
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {validationResult.valid ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{validationResult.message}</span>
                </div>
              )}
            </div>

            {/* ── DRAWER FOOTER ── */}
            <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between sticky bottom-0 bg-[#080b14] z-20">
              <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono hidden sm:flex">
                <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                <span>SMMFLUX AI Engine • Защита от ошибочных ссылок</span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-8 py-3 rounded-2xl font-black text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white shadow-[0_0_25px_rgba(168,85,247,0.3)] transition-all cursor-pointer min-h-[44px] active:scale-95"
              >
                Понятно, вернуться к заказу
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
