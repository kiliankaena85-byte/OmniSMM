import React from 'react';
import { Sparkles, Zap } from 'lucide-react';
import type { PlatformDeviceGuide } from '@/services/catalog/link-guide.service';

interface CyberTimelineStepsProps {
  currentDeviceGuide: PlatformDeviceGuide;
  activeStepIndex: number;
  setActiveStepIndex: (idx: number) => void;
}

export function CyberTimelineSteps({
  currentDeviceGuide,
  activeStepIndex,
  setActiveStepIndex,
}: CyberTimelineStepsProps) {
  return (
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
  );
}
