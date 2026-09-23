'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, ShieldCheck } from 'lucide-react';
import { LinkGuideService, PlatformDeviceGuide } from '@/services/catalog/link-guide.service';
import { CyberPhoneSimulator } from './sub/CyberPhoneSimulator';
import { CyberTimelineSteps } from './sub/CyberTimelineSteps';
import { CyberLinkScanner } from './sub/CyberLinkScanner';
import { validateTelegramLink } from './sub/validateTelegramLink';

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

  const validationResult = validateTelegramLink(testLink);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-2xl cursor-pointer"
            aria-label="Закрыть шторку"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 120 || info.velocity.y > 400) {
                onClose();
              }
            }}
            className="relative z-10 w-full max-w-5xl mx-auto bg-[#080b14]/98 border-t border-x border-purple-500/35 rounded-t-[2.5rem] sm:rounded-t-[3rem] p-5 sm:p-8 max-h-[92vh] overflow-y-auto shadow-[0_-25px_60px_rgba(168,85,247,0.25)] space-y-6 touch-pan-y"
          >
            <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
            <div className="absolute top-0 left-0 w-80 h-80 bg-pink-600/15 rounded-full blur-3xl pointer-events-none -translate-y-1/2 -translate-x-1/2" />

            <div className="flex justify-center -mt-2 mb-1 cursor-grab active:cursor-grabbing">
              <div className="w-16 h-1.5 bg-gradient-to-r from-purple-500/60 via-pink-500/60 to-purple-500/60 rounded-full hover:scale-105 transition-transform" />
            </div>

            {/* Cyber Header */}
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-4 sticky top-0 bg-[#080b14]/95 backdrop-blur-md z-20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600/30 via-pink-600/20 to-purple-800/30 border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.3)] text-purple-300 flex items-center justify-center">
                  <Zap className="w-6 h-6 animate-pulse shrink-0" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <span>Как скопировать ссылку в Telegram</span>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm">
                      FLUX HUD
                    </span>
                  </h2>
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

            {/* Device Switcher */}
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

            {/* HUD Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <CyberPhoneSimulator
                selectedDevice={selectedDevice}
                activeStepIndex={activeStepIndex}
                setActiveStepIndex={setActiveStepIndex}
              />
              <CyberTimelineSteps
                currentDeviceGuide={currentDeviceGuide}
                activeStepIndex={activeStepIndex}
                setActiveStepIndex={setActiveStepIndex}
              />
            </div>

            {/* Cyber Scanner */}
            <CyberLinkScanner
              testLink={testLink}
              setTestLink={setTestLink}
              onApplyLink={onApplyLink}
              onClose={onClose}
              onPasteFromClipboard={handlePasteFromClipboard}
              validationResult={validationResult}
            />

            {/* Drawer Footer */}
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
