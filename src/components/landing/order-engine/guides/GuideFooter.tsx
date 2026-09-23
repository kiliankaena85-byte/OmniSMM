import React from "react";
import { AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { Platform, ContentType } from "./types";

interface GuideFooterProps {
  platform: Platform;
  contentType: ContentType;
}

export function GuideFooter({ platform, contentType }: GuideFooterProps) {
  let warningText = "";
  let type = "info";

  if (platform === "vk") {
    if (contentType === "post") {
      warningText = "ВНИМАНИЕ: Если вы скопируете ссылку на изображение во вложении (например, vk.com/photo-XXX_YYY) вместо поста на стене, продвижение лайков на публикацию не сработает! Обязательно кликайте на сам текст записи.";
      type = "warning";
    } else if (contentType === "comment") {
      warningText = "ДЛЯ НАКРУТКИ НА ОТВЕТ: Ссылка обязана содержать параметр ?reply=XXXX в конце. Наша система автоматически распознает его и накрутит лайки именно на этот комментарий. Не стирайте этот параметр!";
      type = "success";
    } else if (contentType === "photo") {
      warningText = "ДЛЯ НАКРУТКИ НА ФОТО: Убедитесь, что фотография находится в открытом альбоме и её настройки приватности позволяют просматривать её всем пользователям.";
      type = "warning";
    }
  } else if (platform === "telegram") {
    if (contentType === "photo") {
      warningText = "ДЛЯ АЛЬБОМОВ: Указание ссылки на конкретное фото с параметром ?single позволяет продвинуть просмотры именно на этот медиафайл. Убедитесь, что канал публичный.";
      type = "success";
    } else {
      warningText = "ДЛЯ ЗАКРЫТЫХ КАНАЛОВ: Продвижение подписчиков работает только при указании временной пригласительной ссылки вида t.me/+... Продвижение просмотров постов на закрытые каналы технически невозможна.";
      type = "warning";
    }
  } else if (platform === "instagram") {
    warningText = "УБЕДИТЕСЬ, что ваш профиль является открытым (публичным) на время выполнения заказа. Продвижение на приватные (закрытые) аккаунты или истории технически невозможна.";
    type = "warning";
  }

  if (!warningText) return null;

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center border-t border-border/40 pt-5 mt-3 gap-4">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
          type === "warning" 
            ? "bg-warning-50 dark:bg-warning-950/30 border-warning-200 dark:border-warning-800/50 text-warning-text" 
            : type === "success"
            ? "bg-success-50 dark:bg-success-950/30 border-success-200 dark:border-success-800/50 text-success"
            : "bg-primary-50 dark:bg-primary-950/30 border-primary-200 dark:border-primary-800/50 text-primary"
        }`}>
          {type === "warning" ? <AlertTriangle className="w-4.5 h-4.5" /> : <Check className="w-4.5 h-4.5" />}
        </div>
        <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
          {warningText}
        </p>
      </div>
      
      <button
        onClick={() => toast.success("Следование инструкциям гарантирует запуск заказа за 60 секунд!")}
        className="w-full sm:w-auto h-12 px-6 rounded-2xl bg-foreground hover:bg-foreground/90 text-background font-bold text-sm shadow-md transition-all duration-200 active:scale-95 shrink-0 flex items-center justify-center gap-2"
      >
        Понятно
      </button>
    </div>
  );
}
