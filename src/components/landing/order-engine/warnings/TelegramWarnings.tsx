import React, { useState } from "react";
import { Info, HelpCircle, Zap } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";

interface TelegramAlbumWarningProps {
  engine: OrderEngine;
  isTelegramViews: boolean;
}

export function TelegramAlbumWarning({ engine, isTelegramViews }: TelegramAlbumWarningProps) {
  const [showTgInstructions, setShowTgInstructions] = useState(false);

  if (!isTelegramViews) return null;

  return (
    <div className="w-full bg-primary/10 border border-primary/20 text-primary rounded-xl p-4 flex flex-col gap-3 shadow-sm animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-primary animate-pulse" />
        <div className="text-sm">
          <p className="font-bold">Telegram-альбом (медиагруппа)</p>
          <p className="mt-1 opacity-90 leading-relaxed">
            Укажите две ссылки: на <strong>первое</strong> медиа (в поле выше) и на <strong>последнее</strong> медиа (в поле ниже). Просмотры пойдут на весь альбом (2 заказа, цена ×2).
          </p>
        </div>
      </div>
      <div className="ml-8 text-xs">
        <button 
          type="button"
          onClick={() => setShowTgInstructions(!showTgInstructions)}
          className="font-semibold text-primary hover:opacity-85 flex items-center gap-1.5 transition-colors duration-200 cursor-pointer h-9 min-h-[36px]"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          {showTgInstructions ? "Скрыть инструкцию" : "Как скопировать ссылки?"}
        </button>
      </div>
      {showTgInstructions && (
        <div className="ml-8 p-3 rounded-xl bg-primary/5 text-xs text-primary leading-relaxed space-y-1.5 border border-primary/10 animate-in fade-in slide-in-from-top-1 duration-200">
          <p>1. <strong>Первая ссылка:</strong> правый клик или долгий тап по посту ➔ «Копировать ссылку» (вставьте в поле выше).</p>
          <p>2. <strong>Вторая ссылка:</strong> откройте последнее фото альбома во весь экран ➔ ⋮ в углу ➔ «Копировать ссылку» (вставьте в поле ниже).</p>
        </div>
      )}
      <div className="ml-8">
        <input 
          type="url" 
          value={engine.mediaGroupUrl} 
          onChange={e => engine.setMediaGroupUrl(e.target.value)} 
          placeholder="Ссылка на последнее медиа (необязательно)"
          className="w-full h-10 px-3 rounded-lg border border-primary/20 bg-card text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
        />
        {engine.mediaGroupUrl.trim().length > 5 && (
          <p className="mt-1.5 text-xs text-primary font-medium">
            ✓ Будет создано 2 заказа. Итоговая стоимость ×2.
          </p>
        )}
      </div>
    </div>
  );
}

export function PrivateTelegramWarning({ isPrivatePost, isPrivateChannel }: { isPrivatePost: boolean; isPrivateChannel: boolean }) {
  if (isPrivatePost) {
    return (
      <div className="w-full bg-warning/10 border border-warning/20 text-warning-text rounded-xl p-4 flex items-start gap-3 shadow-sm">
        <Zap className="w-5 h-5 shrink-0 mt-0.5 text-warning-text" />
        <div className="text-sm">
          <p className="font-bold">Закрытый канал</p>
          <p className="mt-1 opacity-90">Приватные ссылки не поддерживаются. Сделайте канал <strong>«Публичным»</strong> и вставьте ссылку вида <code>t.me/имя/номер</code>.</p>
        </div>
      </div>
    );
  }
  
  if (isPrivateChannel) {
    return (
      <div className="w-full bg-warning/10 border border-warning/20 text-warning-text rounded-xl p-4 flex items-start gap-3">
        <Zap className="w-5 h-5 shrink-0 mt-0.5 text-warning-text" />
        <div className="text-sm">
          <p className="font-bold">Приватный канал</p>
          <p className="mt-1 opacity-90">Нужна ссылка-приглашение (<code>t.me/+ссылка</code>). Иначе заказ будет отменен.</p>
        </div>
      </div>
    );
  }
  
  return null;
}
