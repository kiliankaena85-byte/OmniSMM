import React from 'react';
import { 
  Sparkles, 
  Copy, 
  MoreHorizontal, 
  MoreVertical, 
  MousePointer, 
  Share2, 
  Image as ImageIcon 
} from 'lucide-react';

interface CyberPhoneSimulatorProps {
  selectedDevice: 'ios' | 'android' | 'desktop';
  activeStepIndex: number;
  setActiveStepIndex: (idx: number) => void;
}

export function CyberPhoneSimulator({
  selectedDevice,
  activeStepIndex,
  setActiveStepIndex,
}: CyberPhoneSimulatorProps) {
  return (
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
  );
}
