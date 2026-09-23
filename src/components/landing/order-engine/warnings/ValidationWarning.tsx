import React from "react";
import { Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { OrderEngine } from "@/hooks/useOrderEngine";

interface SwapSuggestion {
  text: string;
  categoryId: string;
  categoryName: string;
}

interface ValidationWarningProps {
  engine: OrderEngine;
  validationMessage: string | null;
  swapSuggestion: SwapSuggestion | null;
}

export function ValidationWarning({ engine, validationMessage, swapSuggestion }: ValidationWarningProps) {
  if (!validationMessage) return null;

  return (
    <div className="w-full bg-warning/10 border border-warning/20 text-warning-text rounded-xl p-4 flex flex-col gap-3 shadow-sm animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-start gap-3">
        <Zap className="w-5 h-5 shrink-0 mt-0.5 text-warning-text animate-pulse" />
        <div className="text-sm">
          <p className="font-bold">Неверный формат ссылки</p>
          <p className="mt-1 opacity-90">
            Авто-проверка: <span className="underline">{validationMessage}</span>. 
            Если ссылка верная, вы можете оформить заказ в обход проверки.
          </p>
        </div>
      </div>

      {swapSuggestion && (
        <div className="bg-warning/5 border border-warning/20/40 rounded-xl p-3.5 flex flex-col gap-2.5 ml-8 mt-1 border-dashed">
          <p className="text-xs font-semibold text-warning-text leading-relaxed">
            💡 <strong>ИИ-Помощник:</strong> {swapSuggestion.text}
          </p>
          <div>
            <Button
              size="sm"
              type="button"
              onClick={() => {
                engine.setCategoryId(swapSuggestion.categoryId);
                engine.setSelectedService(null);
                toast.success(`Категория переключена на «${swapSuggestion.categoryName}»!`);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-lg text-xs py-1.5 px-3.5 h-8.5 active:scale-95 transition-all shadow-sm shadow-primary/10 cursor-pointer"
            >
              Переключить на «{swapSuggestion.categoryName}»
            </Button>
          </div>
        </div>
      )}

      <div className="ml-8 flex items-center gap-2">
        {engine.isLinkOverridden ? (
          <div className="flex items-center gap-1.5 text-success font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Обход валидатора успешно активирован!
          </div>
        ) : (
          <Button
            size="sm"
            type="button"
            onClick={() => {
              engine.setIsLinkOverridden(true);
              toast.success("Режим обхода активирован. Теперь вы можете продолжить оформление.");
            }}
            className="bg-warning/20 text-warning-text hover:bg-warning/30 border border-warning-text/20 font-bold rounded-lg text-xs py-1 px-3 h-8 active:scale-95 transition-all cursor-pointer"
          >
            Я уверен, что ссылка верная
          </Button>
        )}
      </div>
    </div>
  );
}
