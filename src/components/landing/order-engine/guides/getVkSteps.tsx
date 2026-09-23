import React from "react";
import { StepDef, ContentType, DeviceType } from "./types";

export function getVkSteps(contentType: ContentType, device: DeviceType): StepDef[] {
  const steps: StepDef[] = [];
  
  if (contentType === "profile") {
    steps.push(
      {
        title: "Зайдите на стену профиля/группы",
        desc: "Откройте нужную личную страницу или паблик в VK.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <circle cx="75" cy="40" r="14" fill="currentColor" className="text-muted/30" />
          </svg>
        )
      },
      {
        title: "Нажмите меню «⋯» в углу экрана",
        desc: device === "mobile"
          ? "В правом верхнем углу страницы тапните по значку трех точек."
          : "В правой верхней колонке под аватаром сообщества или в шапке нажмите на меню управления.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <g transform="translate(170, 30)">
              <circle cx="0" cy="0" r="10" className="fill-primary/20 animate-ping" />
              <circle cx="-4" cy="0" r="1.5" fill="#ffffff" />
              <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
              <circle cx="4" cy="0" r="1.5" fill="#ffffff" />
            </g>
          </svg>
        )
      },
      {
        title: "«Скопировать ссылку»",
        desc: "В меню выберите пункт «Скопировать ссылку» (или «Поделиться -> Скопировать»).",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="52" y="90" width="136" height="78" rx="12" fill="currentColor" className="text-card" />
            <rect x="60" y="112" width="120" height="20" rx="6" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="1" />
            <text x="68" y="125" className="fill-primary font-bold text-[8px]">Скопировать ссылку</text>
          </svg>
        )
      }
    );
  } else if (contentType === "post") {
    steps.push(
      {
        title: "Откройте запись на стене",
        desc: "**КРИТИЧНО**: Не копируйте ссылку на фото во вложении! Тапните по самому тексту или дате поста, чтобы открыть только эту запись на стене.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="60" y="30" width="120" height="70" rx="8" fill="currentColor" className="text-card" />
            {/* Highlight post text block */}
            <rect x="66" y="38" width="80" height="6" rx="2" fill="currentColor" className="text-primary/30" />
            <g transform="translate(100, 41)">
              <circle cx="0" cy="0" r="10" className="fill-primary/20 animate-ping" />
            </g>
          </svg>
        )
      },
      {
        title: "Нажмите меню «⋯» или «Поделиться»",
        desc: "В правом верхнем углу поста нажмите три точки (или кнопку Поделиться внизу).",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="60" y="30" width="120" height="70" rx="8" fill="currentColor" className="text-card" />
            <g transform="translate(165, 42)">
              <circle cx="0" cy="0" r="8" className="fill-primary/20 animate-pulse" />
              <circle cx="-3" cy="0" r="1" fill="#ffffff" />
              <circle cx="0" cy="0" r="1" fill="#ffffff" />
              <circle cx="3" cy="0" r="1" fill="#ffffff" />
            </g>
          </svg>
        )
      },
      {
        title: "«Скопировать ссылку»",
        desc: "Выберите пункт «Скопировать ссылку». Убедитесь, что ссылка имеет формат `vk.com/wall-XXXX_YYYY`.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="52" y="90" width="136" height="78" rx="12" fill="currentColor" className="text-card" />
            <rect x="60" y="112" width="120" height="20" rx="6" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="1" />
            <text x="120" y="125" textAnchor="middle" className="fill-primary font-bold text-[8px]">Скопировать ссылку</text>
          </svg>
        )
      }
    );
  } else if (contentType === "story") {
    steps.push(
      {
        title: "Откройте нужную историю",
        desc: "Откройте историю нужного сообщества или человека в мобильном приложении VK.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="#0b0b10" stroke="currentColor" className="text-border/40" strokeWidth="1" />
            <rect x="54" y="14" width="132" height="152" rx="12" fill="currentColor" className="text-muted/15" />
          </svg>
        )
      },
      {
        title: "Нажмите стрелку «Поделиться»",
        desc: "В правом нижнем углу экрана нажмите на значок изогнутой стрелочки (Поделиться).",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="#0b0b10" stroke="currentColor" className="text-border/40" strokeWidth="1" />
            <g transform="translate(165, 145)">
              <circle cx="0" cy="0" r="10" className="fill-primary/20 animate-ping" />
              {/* curved VK share arrow shape */}
              <path d="M -4,2 L 2,-4 L 2,-1 C 5,-1 7,2 7,5 C 6,3 4,3 2,3 L 2,6 Z" fill="currentColor" className="text-primary" />
            </g>
          </svg>
        )
      },
      {
        title: "«Скопировать ссылку»",
        desc: "В меню экспорта выберите «Скопировать ссылку». Ссылка готова к заказу!",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="#0b0b10" stroke="currentColor" className="text-border/40" strokeWidth="1" />
            <rect x="52" y="90" width="136" height="78" rx="12" fill="currentColor" className="text-card" />
            <rect x="60" y="112" width="120" height="20" rx="6" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="1" />
            <text x="68" y="125" className="fill-primary font-bold text-[8px]">Скопировать ссылку</text>
          </svg>
        )
      }
    );
  } else if (contentType === "comment") {
    steps.push(
      {
        title: "Найдите нужный комментарий",
        desc: "Перейдите к обсуждению под постом. Найдите комментарий, на который хотите продвинуть лайки.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            {/* Comment Box silhouette */}
            <rect x="60" y="60" width="120" height="40" rx="6" fill="currentColor" className="text-card" />
            <circle cx="72" cy="74" r="6" fill="currentColor" className="text-muted/30" />
            <rect x="83" y="72" width="60" height="4" rx="1" fill="currentColor" className="text-muted-foreground/30" />
          </svg>
        )
      },
      {
        title: "Нажмите на дату/время публикации",
        desc: device === "mobile"
          ? "В приложении VK быстро тапните по самому телу комментария (или зажмите его) и выберите «Поделиться -> Скопировать ссылку»."
          : "В веб-версии наведите курсор на **время публикации** комментария (например, «3 часа назад») и нажмите правую кнопку мыши.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="60" y="60" width="120" height="40" rx="6" fill="currentColor" className="text-card" />
            {/* Timestamp glow area */}
            <rect x="83" y="80" width="40" height="4" rx="1.5" className="text-primary/20 stroke-primary" fill="currentColor" strokeWidth="0.5" />
            <g transform="translate(100, 82)">
              <circle cx="0" cy="0" r="8" className="fill-primary/20 animate-ping" />
            </g>
          </svg>
        )
      },
      {
        title: "«Скопировать адрес ссылки»",
        desc: "Выберите пункт «Скопировать адрес ссылки». Ссылка содержит параметр `?reply=...`. **Не удаляйте его**, он нужен системе для распознавания конкретного ответа!",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="52" y="90" width="136" height="78" rx="12" fill="currentColor" className="text-card" />
            <rect x="60" y="112" width="120" height="20" rx="6" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="1" />
            <text x="120" y="125" textAnchor="middle" className="fill-primary font-bold text-[6px]">Скопировать адрес ссылки</text>
          </svg>
        )
      }
    );
  } else if (contentType === "photo") {
    steps.push(
      {
        title: "Откройте публикацию или альбом",
        desc: "Перейдите к посту на стене или откройте раздел альбомов сообщества, содержащий нужное изображение.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="60" y="30" width="55" height="50" rx="4" fill="currentColor" className="text-muted/20" />
            <rect x="125" y="30" width="55" height="50" rx="4" fill="currentColor" className="text-muted/20" />
            <rect x="60" y="90" width="55" height="50" rx="4" fill="currentColor" className="text-muted/20" />
            <rect x="125" y="90" width="55" height="50" rx="4" fill="currentColor" className="text-muted/20" />
          </svg>
        )
      },
      {
        title: "Разверните фото на весь экран",
        desc: "Кликните на изображение, чтобы открыть его в полноэкранном режиме просмотра (theater mode).",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="#09090c" stroke="currentColor" className="text-border/40" strokeWidth="1" />
            <rect x="54" y="24" width="132" height="132" fill="currentColor" className="text-muted/15" />
            <g transform="translate(120, 90)">
              <circle cx="0" cy="0" r="10" className="fill-primary/20 animate-pulse" />
              <circle cx="0" cy="0" r="3" className="fill-primary" />
            </g>
          </svg>
        )
      },
      {
        title: "Скопируйте ссылку на фото",
        desc: "На телефоне: нажмите «Поделиться» -> «Скопировать ссылку». На ПК: просто скопируйте URL из адресной строки браузера. Ссылка должна иметь вид vk.com/photo-XXXX_YYYY.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="60" y="25" width="120" height="12" rx="3" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="0.5" />
            <text x="120" y="33" textAnchor="middle" className="fill-primary font-bold text-[6px]">vk.com/photo-123_456</text>
            <rect x="52" y="90" width="136" height="78" rx="12" fill="currentColor" className="text-card" />
            <rect x="60" y="112" width="120" height="20" rx="6" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="1" />
            <text x="68" y="125" className="fill-primary font-bold text-[8px]">Скопировать ссылку</text>
          </svg>
        )
      }
    );
  }
  return steps;
}
