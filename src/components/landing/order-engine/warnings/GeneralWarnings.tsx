import React from "react";
import { Info, Zap } from "lucide-react";

export function CategoryInfoWarning({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="w-full bg-warning/10 border border-warning/20 text-warning-text rounded-xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in zoom-in-95 duration-200">
      <Info className="w-5 h-5 shrink-0 mt-0.5 text-warning-text animate-pulse" />
      <div className="text-sm">
        <p className="font-bold">Внимание: Информация о категории</p>
        <p className="mt-1 opacity-90 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

export function ServiceInfoWarning({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="w-full bg-warning/10 border border-warning/20 text-warning-text rounded-xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in zoom-in-95 duration-200">
      <Info className="w-5 h-5 shrink-0 mt-0.5 text-warning-text animate-pulse" />
      <div className="text-sm">
        <p className="font-bold">Внимание: Специфика услуги</p>
        <p className="mt-1 opacity-90 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

export function PlatformMismatchWarning({ isMismatch, platform, networkName }: { isMismatch: boolean; platform: string; networkName: string }) {
  if (!isMismatch) return null;
  return (
    <div className="w-full bg-danger/10 border border-danger/20 text-danger rounded-xl p-4 flex items-start gap-3 shadow-sm">
      <Zap className="w-5 h-5 shrink-0 mt-0.5 text-danger" />
      <div className="text-sm">
        <p className="font-bold">Несовпадение соцсети</p>
        <p className="mt-1 opacity-90">Ссылка от <strong>{platform}</strong>, но выбрана соцсеть <strong>{networkName}</strong>. Исправьте ссылку или измените соцсеть.</p>
      </div>
    </div>
  );
}

export function VkMediaWarning({ isVkPhotoOrVideo }: { isVkPhotoOrVideo: boolean }) {
  if (!isVkPhotoOrVideo) return null;
  return (
    <div className="w-full bg-warning/10 border border-warning/20 text-warning-text rounded-xl p-4 flex items-start gap-3 shadow-sm">
      <Info className="w-5 h-5 shrink-0 mt-0.5 text-warning-text" />
      <div className="text-sm">
        <p className="font-bold">Ссылка на медиафайл VK</p>
        <p className="mt-1 opacity-90">Чтобы продвинуть весь пост, скопируйте ссылку на саму запись (формата <code>vk.com/wall...</code>) вместо фото/видео.</p>
      </div>
    </div>
  );
}

export function LiveStreamWarning({ isLiveStream }: { isLiveStream: boolean }) {
  if (!isLiveStream) return null;
  return (
    <div className="w-full bg-danger/10 border border-danger/20 text-danger rounded-xl p-4 flex items-start gap-3">
      <Zap className="w-5 h-5 shrink-0 mt-0.5 text-danger" />
      <div className="text-sm">
        <p className="font-bold">Прямой эфир</p>
        <p className="mt-1 opacity-90">Стрим должен быть активен. При срыве трансляции гарантия сгорает.</p>
      </div>
    </div>
  );
}
