import React from "react";
import { JsonLd } from "@/components/seo/JsonLd";

interface LandingSeoHowToProps {
  targetEntity: string;
  networkName: string;
  siteName: string;
}

export function LandingSeoHowTo({
  targetEntity,
  networkName,
  siteName,
}: LandingSeoHowToProps) {
  // HowTo Schema for Search Snippets
  const howToData = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": `Как заказать ${targetEntity} в ${networkName}`,
    "description": `Пошаговая инструкция по безопасному оформлению заказа ${targetEntity} в ${networkName} на платформе ${siteName}.`,
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Укажите ссылку",
        "text": `Вставьте публичную ссылку на ваш открытый профиль, канал или публикацию в ${networkName}. Пароли и доступы не требуются.`
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "Выберите количество",
        "text": `Укажите необходимое количество единиц (от 1 штуки). Система автоматически рассчитает итоговую стоимость по оптовому тарифу.`
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "Оплатите заказ",
        "text": `Совершите оплату через СБП, банковскую карту РФ или баланс. Выполнение заказа начнется автоматически в течение 1 минуты.`
      }
    ]
  };

  return (
    <section className="space-y-6">
      <JsonLd data={howToData} />

      <div className="text-center max-w-xl mx-auto space-y-2">
        <span className="text-xs font-bold text-primary uppercase tracking-wider">Простой процесс</span>
        <h2 className="text-2xl sm:text-3xl font-black text-foreground">
          Как заказать {targetEntity} за 3 шага
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-3 relative">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary font-black flex items-center justify-center text-lg">
            1
          </div>
          <h3 className="font-extrabold text-foreground text-base">Скопируйте ссылку</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Откройте {networkName}, скопируйте публичную ссылку на профиль, группу, канал или конкретный пост. Аккаунт должен быть открытым.
          </p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-3 relative">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary font-black flex items-center justify-center text-lg">
            2
          </div>
          <h3 className="font-extrabold text-foreground text-base">Выберите объем</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Вставьте ссылку в форму выше и укажите нужное количество. Стоимость пересчитается мгновенно с учетом скидки за объем.
          </p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-3 relative">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary font-black flex items-center justify-center text-lg">
            3
          </div>
          <h3 className="font-extrabold text-foreground text-base">Оплатите без комиссии</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Выберите оплату через СБП, картой МИР или электронным кошельком. Запуск начнется автоматически сразу после подтверждения.
          </p>
        </div>
      </div>
    </section>
  );
}
