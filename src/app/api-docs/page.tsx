'use client';

import React, { useState } from "react";
import Link from "next/link";
import { 
  Code2, 
  Copy, 
  Check, 
  Terminal, 
  Key, 
  ShieldCheck, 
  Zap, 
  ArrowLeft, 
  ExternalLink,
  BookOpen
} from "lucide-react";
import { 
  PlanButton, 
  PlanCard, 
  PlanCardHeader, 
  PlanBadge, 
  PlanTable, 
  PlanTableHeader, 
  PlanTableHeadCell, 
  PlanTableRow, 
  PlanTableCell 
} from "@/components/ui";

const API_ENDPOINTS = [
  {
    method: "POST",
    path: "/api/v2",
    action: "services",
    description: "Получение актуального списка всех доступных услуг, минимальных/максимальных лимитов и цен",
    params: [
      { name: "key", type: "string", required: true, desc: "Ваш секретный API-токен" },
      { name: "action", type: "string", required: true, desc: "Фиксированное значение: services" },
    ],
    sampleResponse: `[
  {
    "service": 1042,
    "name": "Telegram Подписчики (Быстрый старт, РФ)",
    "type": "Default",
    "category": "Telegram",
    "rate": "0.19",
    "min": 50,
    "max": 50000,
    "refill": true,
    "cancel": false
  }
]`,
  },
  {
    method: "POST",
    path: "/api/v2",
    action: "add",
    description: "Создание нового заказа на накрутку (списание средств с баланса API)",
    params: [
      { name: "key", type: "string", required: true, desc: "Ваш секретный API-токен" },
      { name: "action", type: "string", required: true, desc: "Фиксированное значение: add" },
      { name: "service", type: "number", required: true, desc: "ID выбранной услуги" },
      { name: "link", type: "string", required: true, desc: "Ссылка на канал, группу или пост" },
      { name: "quantity", type: "number", required: true, desc: "Количество единиц" },
    ],
    sampleResponse: `{
  "order": 984512
}`,
  },
  {
    method: "POST",
    path: "/api/v2",
    action: "status",
    description: "Проверка статуса выполнения одного заказа",
    params: [
      { name: "key", type: "string", required: true, desc: "Ваш секретный API-токен" },
      { name: "action", type: "string", required: true, desc: "Фиксированное значение: status" },
      { name: "order", type: "number", required: true, desc: "ID созданного заказа" },
    ],
    sampleResponse: `{
  "charge": "19.00",
  "start_count": "1420",
  "status": "In progress",
  "remains": "350",
  "currency": "RUB"
}`,
  },
  {
    method: "POST",
    path: "/api/v2",
    action: "balance",
    description: "Запрос текущего доступного баланса на аккаунте",
    params: [
      { name: "key", type: "string", required: true, desc: "Ваш секретный API-токен" },
      { name: "action", type: "string", required: true, desc: "Фиксированное значение: balance" },
    ],
    sampleResponse: `{
  "balance": "48500.00",
  "currency": "RUB"
}`,
  },
];

export default function ApiDocsPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState(
    process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/v2` : '/api/v2'
  );

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      setApiBaseUrl(`${origin}/api/v2`);
    }
  }, []);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
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
              <Code2 className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">
              SMMplan <span className="text-xs text-primary font-black px-2 py-0.5 rounded bg-primary/10 ml-1 uppercase">API v2</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <PlanButton variant="outline" size="sm" rightIcon={<Key className="w-3.5 h-3.5" />}>
                Получить API Ключ
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
        <div className="mb-12 space-y-4">
          <div className="flex items-center gap-2">
            <PlanBadge variant="primary">Developer Hub</PlanBadge>
            <PlanBadge variant="success">Стандарт REST / SMM v2</PlanBadge>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
            Документация REST API для реселлеров
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-3xl leading-relaxed">
            Подключите свой сайт, Telegram-бота или CRM-систему к нашему шлюзу. Мгновенная маршрутизация заказов, автоматический возврат средств при сбоях и поддержка стандартного протокола SMM v2.
          </p>
        </div>

        {/* Quick Start Card */}
        <PlanCard variant="bordered" padding="lg" className="mb-12 bg-muted/20">
          <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
            <div className="space-y-2">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Terminal className="w-5 h-5 text-primary" />
                Базовый URL эндпоинта
              </h3>
              <p className="text-sm text-muted-foreground">
                Все запросы отправляются методом <code>POST</code> с передачей параметров в формате <code>application/x-www-form-urlencoded</code> или <code>multipart/form-data</code>.
              </p>
            </div>
            <div className="bg-card border border-border px-4 py-2.5 rounded-xl font-mono text-sm font-bold text-primary flex items-center gap-3 shrink-0 shadow-sm">
              <span>{apiBaseUrl}</span>
              <button 
                onClick={() => handleCopy(apiBaseUrl, 999)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Копировать URL"
              >
                {copiedIndex === 999 ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </PlanCard>

        {/* Endpoints List */}
        <div className="space-y-10">
          <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-primary" />
            Доступные методы API
          </h2>

          {API_ENDPOINTS.map((endpoint, idx) => (
            <PlanCard key={endpoint.action} variant="bordered" padding="lg" className="space-y-6">
              <PlanCardHeader
                title={`Действие: action = ${endpoint.action}`}
                description={endpoint.description}
                badge={<PlanBadge variant="method" method="POST" />}
              />

              {/* Params Table */}
              <div>
                <h4 className="text-xs uppercase font-black text-muted-foreground tracking-wider mb-3">
                  Входящие параметры (POST Body)
                </h4>
                <PlanTable>
                  <PlanTableHeader>
                    <tr>
                      <PlanTableHeadCell>Параметр</PlanTableHeadCell>
                      <PlanTableHeadCell>Тип</PlanTableHeadCell>
                      <PlanTableHeadCell>Обязательный</PlanTableHeadCell>
                      <PlanTableHeadCell>Описание</PlanTableHeadCell>
                    </tr>
                  </PlanTableHeader>
                  <tbody>
                    {endpoint.params.map((p) => (
                      <PlanTableRow key={p.name}>
                        <PlanTableCell className="font-mono font-bold text-primary">{p.name}</PlanTableCell>
                        <PlanTableCell className="font-mono text-xs text-muted-foreground">{p.type}</PlanTableCell>
                        <PlanTableCell>
                          {p.required ? (
                            <PlanBadge variant="destructive" size="sm">Да</PlanBadge>
                          ) : (
                            <PlanBadge variant="neutral" size="sm">Опционально</PlanBadge>
                          )}
                        </PlanTableCell>
                        <PlanTableCell className="text-sm">{p.desc}</PlanTableCell>
                      </PlanTableRow>
                    ))}
                  </tbody>
                </PlanTable>
              </div>

              {/* Response Code Block */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs uppercase font-black text-muted-foreground tracking-wider">
                    Пример ответа (JSON)
                  </h4>
                  <button
                    onClick={() => handleCopy(endpoint.sampleResponse, idx)}
                    className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Скопировано</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Копировать</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-muted/40 border border-border/80 rounded-xl p-4 font-mono text-xs sm:text-sm text-foreground overflow-x-auto">
                  <code>{endpoint.sampleResponse}</code>
                </pre>
              </div>
            </PlanCard>
          ))}
        </div>

        {/* CTA Bottom Banner */}
        <PlanCard variant="bordered" padding="xl" className="mt-16 bg-primary/5 border-primary/20 text-center space-y-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto border border-primary/20">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold text-foreground">Готовы настроить интеграцию?</h3>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Перейдите в личный кабинет для генерации персонального API-ключа. Техническая поддержка разработчиков отвечает в Telegram в режиме реального времени.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link href="/dashboard">
              <PlanButton variant="primary" size="md">
                Сгенерировать API Ключ
              </PlanButton>
            </Link>
            <Link href="/support">
              <PlanButton variant="outline" size="md">
                Связаться с поддержкой
              </PlanButton>
            </Link>
          </div>
        </PlanCard>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border/80 py-8 text-center text-xs text-muted-foreground mt-20">
        <p>© {new Date().getFullYear()} SMMplan Infrastructure. Все права защищены.</p>
      </footer>
    </div>
  );
}
