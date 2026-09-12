import React from "react";

interface MobileStep1CatalogActionsProps {
  onOpenGuide?: () => void;
  onOpenCatalog?: () => void;
  setActiveStep: (step: 1 | 2 | 3 | 4) => void;
}

export function MobileStep1CatalogActions({
  onOpenGuide,
  onOpenCatalog,
  setActiveStep,
}: MobileStep1CatalogActionsProps) {
  return (
    <div className="flex flex-col gap-2 pt-1.5">
      <div className="flex justify-between items-center px-1">
        <button
          type="button"
          onClick={onOpenGuide}
          aria-label="Где взять ссылку для заказа? Гайд по ссылкам"
          className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all min-h-[44px] px-2 -ml-2"
        >
          <span>❓</span>
          <span className="underline">Где взять ссылку?</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          if (onOpenCatalog) {
            onOpenCatalog();
          } else {
            setActiveStep(2);
          }
        }}
        className="text-xs font-bold text-primary hover:underline h-11 min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 w-full border border-dashed border-primary/30 rounded-xl bg-primary/5 active:scale-95 transition-all cursor-pointer"
      >
        <span>📂</span>
        <span>Или выбрать услугу вручную из каталога →</span>
      </button>
    </div>
  );
}
