import React from "react";
import { Zap, ShieldCheck } from "lucide-react";

interface LandingSeoExpertiseProps {
  targetEntity: string;
  networkName: string;
  siteName: string;
}

export function LandingSeoExpertise({
  targetEntity,
  networkName,
  siteName,
}: LandingSeoExpertiseProps) {
  return (
    <section className="bg-card border border-border rounded-3xl p-6 md:p-10 shadow-sm space-y-6">
      <div className="space-y-3 max-w-3xl">
        <h2 className="text-xl sm:text-2xl font-black text-foreground">
          Преимущества продвижения {targetEntity} в {networkName}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Платформа {siteName} предоставляет прямой доступ к оптовым шлюзам накрутки и продвижения. Мы исключаем наценки посредников, гарантируя высокую скорость доставки и безопасность вашего профиля.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 text-xs">
        <div className="space-y-2">
          <h3 className="font-extrabold text-foreground text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary shrink-0" />
            Влияние на умную ленту и охваты
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            Алгоритмы {networkName} оценивают социальное доказательство и темп набора активности. Увеличение показателей выводит контент в рекомендации, повышая органический приток живых клиентов.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="font-extrabold text-foreground text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            Белые методы без риска блокировки
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            Мы используем плавное начисление и соблюдаем внутренние суточные лимиты платформы {networkName}. Это обеспечивает 100% естественный профиль активности без подозрительных всплесков.
          </p>
        </div>
      </div>
    </section>
  );
}
