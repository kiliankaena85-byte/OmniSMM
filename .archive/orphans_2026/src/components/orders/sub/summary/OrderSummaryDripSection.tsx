import React from 'react';
import type { PublicService } from '@/actions/order/catalog';
import { DripFeedSettings } from '@/components/orders/DripFeedSettings';

interface OrderSummaryDripSectionProps {
  selectedService: PublicService | null;
  dripFeedEnabled: boolean;
  setDripFeedEnabled: (val: boolean) => void;
  runs: number;
  setRuns: (val: number) => void;
  dripInterval: number;
  setDripInterval: (val: number) => void;
  isSmartDrip: boolean;
  setIsSmartDrip: (val: boolean) => void;
  smartDripDays: number;
  setSmartDripDays: (val: number) => void;
  quantity: number;
  setQuantity: (val: number) => void;
  validationErrors?: Record<string, string>;
}

export function OrderSummaryDripSection({
  selectedService,
  dripFeedEnabled,
  setDripFeedEnabled,
  runs,
  setRuns,
  dripInterval,
  setDripInterval,
  isSmartDrip,
  setIsSmartDrip,
  smartDripDays,
  setSmartDripDays,
  quantity,
  setQuantity,
  validationErrors,
}: OrderSummaryDripSectionProps) {
  return (
    <>
      {/* Drip feed */}
      <DripFeedSettings
        enabled={dripFeedEnabled}
        setEnabled={(val) => {
          setDripFeedEnabled(val);
          if (val) {
            setIsSmartDrip(false);
            if (selectedService) {
              const minReq = selectedService.minQty * runs;
              if (quantity < minReq) {
                setQuantity(minReq);
              }
            }
          }
        }}
        runs={runs}
        setRuns={(val) => {
          setRuns(val);
          if (selectedService) {
            const minReq = selectedService.minQty * val;
            if (quantity < minReq) {
              setQuantity(minReq);
            }
          }
        }}
        interval={dripInterval}
        setInterval={setDripInterval}
      />
      {dripFeedEnabled && validationErrors?.dripfeed && (
        <p className="text-xs text-destructive font-semibold mt-1">{validationErrors.dripfeed}</p>
      )}

      {/* Smart Drip feed */}
      {selectedService?.smartConfig?.isEnabled && (
        <div className="p-4 bg-primary/5 border border-primary/25 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-black text-foreground flex items-center gap-1.5 select-none">
                🤖 Растянуть доставку (Smart Drip)
              </span>
              <span className="text-[10px] text-muted-foreground block select-none">
                Случайными порциями по плавному графику (+
                {Math.round(selectedService.smartConfig.markup * 100)}% к цене)
              </span>
            </div>
            <div className="w-11 h-11 flex items-center justify-end shrink-0">
              <input
                type="checkbox"
                checked={isSmartDrip}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsSmartDrip(checked);
                  if (checked) {
                    setDripFeedEnabled(false); // Reset normal dripfeed
                    if (selectedService) {
                      const minReq = selectedService.minQty * smartDripDays;
                      if (quantity < minReq) {
                        setQuantity(minReq);
                      }
                    }
                  }
                }}
                className="w-5 h-5 accent-primary rounded cursor-pointer"
                aria-label="Включить Smart Drip"
              />
            </div>
          </div>

          {isSmartDrip && (
            <div className="space-y-2 pt-1 animate-in fade-in duration-200">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                <span>Период распределения:</span>
                <span className="text-primary font-bold">{smartDripDays} дней</span>
              </div>
              <div className="flex gap-2">
                {[3, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setSmartDripDays(d);
                      if (selectedService) {
                        const minReq = selectedService.minQty * d;
                        if (quantity < minReq) {
                          setQuantity(minReq);
                        }
                      }
                    }}
                    aria-label={`${d} дней`}
                    className={`flex-1 h-11 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${
                      smartDripDays === d
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {d === 7 ? `${d}д (Реком.)` : `${d}д`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {isSmartDrip && validationErrors?.dripfeed && (
        <p className="text-xs text-destructive font-semibold mt-1">{validationErrors.dripfeed}</p>
      )}
    </>
  );
}
