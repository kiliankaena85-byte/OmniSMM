import React from 'react';

export function OrderSummaryEmptyState() {
  return (
    <div className="hidden lg:block bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-8 space-y-6 lg:sticky lg:top-6 shadow-sm transition-all duration-300">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[9px] font-black uppercase tracking-widest">
          ✨ Панель управления
        </div>
        <h3 className="text-base font-extrabold text-foreground tracking-tight">Мастер оформления заказа</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Добро пожаловать в интеллектуальную систему заказов SMMplan. Мы упростили процесс до трёх простых шагов.
        </p>
      </div>

      <div className="h-px bg-border/50" />

      {/* Steps Guide */}
      <div className="space-y-4">
        {[
          { step: '1', title: 'Укажите ссылку', desc: 'Вставьте ссылку на ваш канал, группу или публикацию. Система сама определит социальную сеть.' },
          { step: '2', title: 'Выберите тариф', desc: 'Кликните по любой карточке тарифа слева. Обращайте внимание на скорость и гарантию.' },
          { step: '3', title: 'Подтвердите параметры', desc: 'Укажите количество, введите промокод при наличии и выберите удобный способ оплаты.' }
        ].map((s, idx) => (
          <div key={idx} className="flex gap-4 group">
            <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-black flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              {s.step}
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-foreground block tracking-wide">{s.title}</span>
              <span className="text-[11px] text-muted-foreground leading-relaxed block">{s.desc}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="h-px bg-border/50" />

      {/* Safe Block */}
      <div className="p-4 bg-primary/5 border border-primary/15 rounded-xl space-y-2">
        <span className="text-xs font-bold text-primary block">🛡️ Безопасность и гарантии</span>
        <ul className="space-y-1.5 text-[11px] text-muted-foreground list-disc pl-3.5 leading-relaxed font-medium">
          <li><strong>3D-Secure 2.0</strong>: Все транзакции картами надежно защищены шифрованием.</li>
          <li><strong>Автозапуск</strong>: Заказы уходят в работу автоматически сразу после успешного платежа.</li>
          <li><strong>Защита Escrow</strong>: Возврат неиспользованного баланса за отмененные заказы на ваш кошелек.</li>
        </ul>
      </div>

      {/* Monochromatic trusted badges */}
      <div className="flex items-center justify-between gap-2 px-2 flex-wrap pt-2 opacity-50">
        {['МИР', 'СБП', 'ЮKassa', 'Visa', 'MasterCard', 'Crypto'].map((logo, i) => (
          <span key={i} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground select-none">
            {logo}
          </span>
        ))}
      </div>
    </div>
  );
}
