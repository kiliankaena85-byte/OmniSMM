'use client';

import React, { useState } from "react";
import Link from "next/link";
import { 
  Building2, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  ArrowLeft, 
  ArrowRight, 
  FileText, 
  Headphones, 
  Percent 
} from "lucide-react";
import { 
  PlanButton, 
  PlanCard, 
  PlanBadge, 
  PlanTable, 
  PlanTableHeader, 
  PlanTableHeadCell, 
  PlanTableRow, 
  PlanTableCell 
} from "@/components/ui";

const TIERS = [
  {
    name: "Старт (API Lite)",
    spend: "от 10 000 ₽ / мес",
    discount: "5%",
    badge: "Для начинающих",
    features: [
      "Доступ к REST API v2",
      "Приоритетный шлюз отправки заказов",
      "Поддержка в Telegram",
      "Чеки 54-ФЗ для физлиц",
    ],
  },
  {
    name: "Партнер (Pro Reseller)",
    spend: "от 50 000 ₽ / мес",
    discount: "15%",
    badge: "Самый популярный",
    popular: true,
    features: [
      "Выделенные провайдерские каналы",
      "Скидка 15% на весь каталог",
      "Персональный технический менеджер",
      "Закрывающие документы для юрлиц (ЭДО)",
      "Гарантия SLA по refill 99.8%",
    ],
  },
  {
    name: "Корпоративный (Enterprise / Agency)",
    spend: "от 200 000 ₽ / мес",
    discount: "30%",
    badge: "Максимальный опт",
    features: [
      "Индивидуальные тарифные сетки",
      "Скидка до 30% от розницы",
      "Прямой выделенный WebSocket шлюз",
      "Оплата по расчетному счету (с НДС/без НДС)",
      "Индивидуальный договор поставки",
    ],
  },
];

export default function WholesalePage() {
  const [monthlySpend, setMonthlySpend] = useState(50000);

  const calculateSavings = (spend: number) => {
    let discount = 0.05;
    if (spend >= 200000) discount = 0.30;
    else if (spend >= 50000) discount = 0.15;
    return Math.round(spend * discount);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative">
      {/* Stripe-style Blueprint Grid Backdrop */}
      <div className="absolute top-0 inset-x-0 h-[700px] z-0 pointer-events-none overflow-hidden premium-grid-backdrop opacity-40" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border/80 h-16 flex items-center shadow-sm">
        <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">
              SMMplan <span className="text-xs text-primary font-black px-2 py-0.5 rounded bg-primary/10 ml-1 uppercase">Wholesale</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/api-docs">
              <PlanButton variant="outline" size="sm">
                API Документация
              </PlanButton>
            </Link>
            <Link href="/">
              <PlanButton variant="primary" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                На главную
              </PlanButton>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10 w-full">
        {/* Title Hero */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="flex justify-center">
            <PlanBadge variant="primary" size="md">
              Оптовая программа для реселлеров и агентств
            </PlanBadge>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
            Оптовые цены и прямые шлюзы SMM
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Полноценная API-инфраструктура для бизнеса. Закрывающие документы через ЭДО, стабильный Uptime 99.98% и прогрессивная шкала скидок до 30%.
          </p>
        </div>

        {/* Pricing Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {TIERS.map((tier) => (
            <PlanCard
              key={tier.name}
              variant={tier.popular ? "interactive" : "bordered"}
              padding="lg"
              className={`flex flex-col relative h-full ${
                tier.popular ? "border-primary ring-2 ring-primary/20 shadow-lg" : ""
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <PlanBadge variant="primary" size="sm">
                    {tier.badge}
                  </PlanBadge>
                </div>
              )}

              <div className="mb-6 space-y-2">
                <h3 className="text-xl font-black text-foreground">{tier.name}</h3>
                <p className="text-xs text-muted-foreground">{tier.spend}</p>
                <div className="text-3xl font-black text-primary pt-2 flex items-baseline gap-1">
                  <span>Скидка {tier.discount}</span>
                  <span className="text-xs text-muted-foreground font-normal">на все услуги</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-foreground/90">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link href="/dashboard" className="w-full">
                <PlanButton
                  variant={tier.popular ? "primary" : "outline"}
                  size="md"
                  className="w-full"
                >
                  Подключить статус
                </PlanButton>
              </Link>
            </PlanCard>
          ))}
        </div>

        {/* Interactive Savings Calculator */}
        <PlanCard variant="bordered" padding="xl" className="mb-16 bg-muted/20">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h3 className="text-2xl font-black text-foreground flex items-center justify-center gap-2">
              <Percent className="w-6 h-6 text-primary" />
              Калькулятор оптовой экономии
            </h3>
            <p className="text-sm text-muted-foreground">
              Укажите ваш примерный ежемесячный бюджет на закупку трафика:
            </p>

            <div className="space-y-4 pt-2">
              <div className="text-4xl font-black text-primary tabular-nums">
                {monthlySpend.toLocaleString("ru-RU")} ₽ / мес
              </div>
              <input
                type="range"
                min={10000}
                max={500000}
                step={5000}
                value={monthlySpend}
                onChange={(e) => setMonthlySpend(Number(e.target.value))}
                className="w-full accent-primary h-2 bg-border rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>10 000 ₽</span>
                <span>250 000 ₽</span>
                <span>500 000 ₽</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Ваша чистая экономия:</span>
              <span className="text-xl font-black text-emerald-600 tabular-nums">
                +{calculateSavings(monthlySpend).toLocaleString("ru-RU")} ₽ в месяц
              </span>
            </div>
          </div>
        </PlanCard>

        {/* API Guarantees Table */}
        <PlanCard variant="bordered" padding="lg" className="mb-12">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Юридические и финансовые гарантии для юрлиц
          </h3>
          <PlanTable>
            <PlanTableHeader>
              <tr>
                <PlanTableHeadCell>Опция</PlanTableHeadCell>
                <PlanTableHeadCell>Формат</PlanTableHeadCell>
                <PlanTableHeadCell>Подробности</PlanTableHeadCell>
              </tr>
            </PlanTableHeader>
            <tbody>
              <PlanTableRow>
                <PlanTableCell className="font-semibold">Документооборот</PlanTableCell>
                <PlanTableCell>Диадок / СБИС (ЭДО)</PlanTableCell>
                <PlanTableCell>Ежемесячное автоматическое подписание УПД и актов сверки</PlanTableCell>
              </PlanTableRow>
              <PlanTableRow>
                <PlanTableCell className="font-semibold">Фискализация</PlanTableCell>
                <PlanTableCell>54-ФЗ / Чеки</PlanTableCell>
                <PlanTableCell>Мгновенная отправка электронных чеков через ОФД</PlanTableCell>
              </PlanTableRow>
              <PlanTableRow>
                <PlanTableCell className="font-semibold">Выделенный SLA</PlanTableCell>
                <PlanTableCell>99.98% Доступность</PlanTableCell>
                <PlanTableCell>Финансовая компенсация при простое шлюза более 15 минут</PlanTableCell>
              </PlanTableRow>
            </tbody>
          </PlanTable>
        </PlanCard>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border/80 py-8 text-center text-xs text-muted-foreground mt-20">
        <p>© {new Date().getFullYear()} SMMplan API Wholesale. Все права защищены.</p>
      </footer>
    </div>
  );
}
