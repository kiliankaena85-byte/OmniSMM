import React from "react";
import { SparklesIcon, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { FluxService } from "@/types/flux";

interface FluxStepCheckoutDripAndCustomProps {
  selectedService: FluxService;
  customData: string;
  setCustomData: (val: string) => void;
  isDripFeedEnabled: boolean;
  setIsDripFeedEnabled: (val: boolean) => void;
  dripRuns: number;
  setDripRuns: (val: number) => void;
  dripInterval: number;
  setDripInterval: (val: number) => void;
  quantity: number | string;
  setQuantity: (val: number | string) => void;
  numericQuantity: number;
  effectiveQuantity: number;
  formState: { error?: string; field?: string };
  shakeKey: number;
}

export function FluxStepCheckoutDripAndCustom({
  selectedService,
  customData,
  setCustomData,
  isDripFeedEnabled,
  setIsDripFeedEnabled,
  dripRuns,
  setDripRuns,
  dripInterval,
  setDripInterval,
  quantity,
  setQuantity,
  numericQuantity,
  effectiveQuantity,
  formState,
  shakeKey,
}: FluxStepCheckoutDripAndCustomProps) {
  return (
    <>
      {/* Custom Data Field */}
      {selectedService.customDataType && selectedService.customDataType !== 'NONE' && (
        <div id="field-customData" className="mb-3">
          <label className="block text-xs font-bold text-foreground/80 uppercase tracking-wider mb-1 ml-1">
            {selectedService.customDataLabel || (selectedService.customDataType === 'TEXTAREA' ? 'Ваши комментарии / текст (по 1 строке)' : 'Вариант ответа / параметры')} <span className="text-red-500">*</span>
          </label>
          {selectedService.customDataType === 'TEXTAREA' ? (
            <textarea
              name="customData"
              rows={3}
              value={customData}
              onChange={(e) => setCustomData(e.target.value)}
              placeholder="Введите каждый комментарий с новой строки..."
              className={`w-full bg-background backdrop-blur-md text-foreground placeholder:text-muted-foreground px-3 py-2.5 sm:px-4 sm:py-3 rounded-[1.25rem] sm:rounded-[1.5rem] border border-border/80 ${formState.field === 'customData' ? '!border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-shake' : 'focus:ring-4 focus:ring-primary/10 focus:border-primary/40'} transition-all duration-300 text-base sm:text-sm font-medium outline-none shadow-sm`}
            />
          ) : (
            <input
              name="customData"
              type="text"
              value={customData}
              onChange={(e) => setCustomData(e.target.value)}
              placeholder="Введите номер варианта ответа..."
              className={`w-full bg-background backdrop-blur-md text-foreground placeholder:text-muted-foreground px-3 py-2.5 sm:px-4 sm:py-3 rounded-[1.25rem] sm:rounded-[1.5rem] border border-border/80 ${formState.field === 'customData' ? '!border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-shake' : 'focus:ring-4 focus:ring-primary/10 focus:border-primary/40'} transition-all duration-300 text-base sm:text-sm font-medium outline-none shadow-sm`}
            />
          )}
          <AnimatePresence mode="popLayout">
            {formState.error && formState.field === "customData" && (
              <motion.div 
                key={`err-customData-${shakeKey}`} 
                initial={{ opacity: 0, height: 0, marginTop: 0 }} 
                animate={{ opacity: 1, height: "auto", marginTop: 8 }} 
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold shadow-sm overflow-hidden"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span role="alert">{formState.error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Drip-Feed Controls */}
      {Boolean(selectedService.isDripFeedEnabled) && (
        <div className="mb-3 p-3.5 rounded-[1.25rem] sm:rounded-[1.5rem] bg-muted/40 border border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Запускать частями (Drip-Feed)</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer min-w-[44px] min-h-[44px] justify-center">
              <input 
                type="checkbox" 
                checked={isDripFeedEnabled} 
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setIsDripFeedEnabled(enabled);
                  if (enabled) {
                    const minQty = selectedService?.minQty || 100;
                    const currentNum = typeof quantity === 'string' ? (parseInt(quantity) || 0) : quantity;
                    if (currentNum < minQty) setQuantity(minQty);
                  }
                }} 
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-[14px] after:left-[4px] after:bg-card after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {isDripFeedEnabled && (
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/30">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Количество запусков</label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={dripRuns}
                  onChange={(e) => setDripRuns(Math.max(2, parseInt(e.target.value) || 2))}
                  className="w-full bg-background text-foreground px-3 py-2.5 rounded-xl border border-border/80 text-base sm:text-sm font-bold outline-none min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Интервал (мин)</label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={dripInterval}
                  onChange={(e) => setDripInterval(Math.max(1, parseInt(e.target.value) || 5))}
                  className="w-full bg-background text-foreground px-3 py-2.5 rounded-xl border border-border/80 text-base sm:text-sm font-bold outline-none min-h-[44px]"
                />
              </div>
              <p className="col-span-2 text-[11px] text-muted-foreground">
                Заказ выполнится за {dripRuns} запусков по {numericQuantity} шт. Всего: <strong className="text-foreground">{effectiveQuantity} шт.</strong>
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
