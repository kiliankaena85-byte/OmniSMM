'use client';

import React, { useState } from 'react';
import { ArrowRight, Layers, ShieldCheck, Database, Zap, Cpu, AlertTriangle, Headphones, Lock, Send, Settings, Sliders, Globe } from 'lucide-react';
import { DiagramType } from './types';

interface InteractiveDiagramProps {
  type: DiagramType;
}

export function InteractiveDiagram({ type }: InteractiveDiagramProps) {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  if (type === 'TOPOLOGY') {
    return (
      <div className="my-4 p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold text-foreground">Схема 1: Топология слоев OmniSMM 1.0 (Clean Architecture)</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">Next.js 16</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-center">
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-1">
            <span className="text-[10px] font-black uppercase text-blue-600 block">Presentation</span>
            <span className="text-xs font-bold text-foreground block">App Router UI</span>
            <span className="text-[10px] text-muted-foreground block">HeroUI v3 + Tailwind 4</span>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-1">
            <span className="text-[10px] font-black uppercase text-indigo-600 block">Application</span>
            <span className="text-xs font-bold text-foreground block">Server Actions</span>
            <span className="text-[10px] text-muted-foreground block">src/actions/* (RBAC Guard)</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
            <span className="text-[10px] font-black uppercase text-emerald-600 block">Domain</span>
            <span className="text-xs font-bold text-foreground block">Level 1 Services</span>
            <span className="text-[10px] text-muted-foreground block">WalletOps, Catalog, BullMQ</span>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
            <span className="text-[10px] font-black uppercase text-amber-600 block">Infrastructure</span>
            <span className="text-xs font-bold text-foreground block">Prisma 5 & Redis</span>
            <span className="text-[10px] text-muted-foreground block">Postgres 16 (BigInt Ledger)</span>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'ORDER_FLOW') {
    return (
      <div className="my-4 p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-foreground">Схема 2: Конвейер исполнения заказа (ACID & Failover)</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">ACID Safe</span>
        </div>

        <div className="flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto py-2">
          {[
            { step: 1, title: 'Preflight', desc: 'SSRF & TargetType' },
            { step: 2, title: 'WalletOps', desc: 'LedgerEntry (BigInt)' },
            { step: 3, title: 'BullMQ', desc: 'Transactional Outbox' },
            { step: 4, title: 'Provider API', desc: 'Remote Order #ID' },
          ].map((item, idx) => (
            <React.Fragment key={item.step}>
              <div
                onClick={() => setActiveStep(item.step)}
                className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer min-w-[110px] sm:flex-1 text-center select-none ${
                  activeStep === item.step
                    ? 'bg-emerald-500/15 border-emerald-500 text-foreground ring-1 ring-emerald-500/30'
                    : 'bg-muted/30 border-border/60 hover:bg-muted/60 text-foreground'
                }`}
              >
                <div className="text-[10px] font-black text-emerald-600 uppercase">Шаг {item.step}</div>
                <div className="text-xs font-bold truncate">{item.title}</div>
                <div className="text-[10px] text-muted-foreground truncate">{item.desc}</div>
              </div>
              {idx < 3 && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'LEDGER_AUDIT') {
    return (
      <div className="my-4 p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-teal-500" />
            <span className="text-xs font-bold text-foreground">Схема 3: Бухгалтерский Леджер двойной записи</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-600 border border-teal-500/20">Immutable</span>
        </div>

        <div className="p-3 bg-muted/40 rounded-xl border border-border/60 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border/40 pb-1">
            <span>Операция</span>
            <span>Дебет (+)</span>
            <span>Кредит (-)</span>
            <span>Баланс (Копейки)</span>
          </div>
          <div className="flex items-center justify-between font-bold text-emerald-600">
            <span>DEPOSIT (ЮKassa)</span>
            <span>+1 000.00 ₽</span>
            <span>—</span>
            <span>100 000 копеек</span>
          </div>
          <div className="flex items-center justify-between font-bold text-rose-600">
            <span>ORDER_HOLD (#1643)</span>
            <span>—</span>
            <span>-250.00 ₽</span>
            <span>75 000 копеек</span>
          </div>
          <div className="flex items-center justify-between font-bold text-amber-600">
            <span>REFUND_PARTIAL</span>
            <span>+50.00 ₽</span>
            <span>—</span>
            <span>80 000 копеек</span>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'SUPPORT_ESCALATION') {
    return (
      <div className="my-4 p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex items-center gap-2">
            <Headphones className="w-4 h-4 text-violet-500" />
            <span className="text-xs font-bold text-foreground">Схема 5: Трехуровневая эскалация саппорта и SLA 15 минут</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-600 border border-violet-500/20">SLA 15m Target</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-violet-600">Линия 1 • Дежурный</span>
              <span className="text-[10px] font-mono text-muted-foreground">SLA ≤ 5 мин</span>
            </div>
            <p className="text-xs font-bold text-foreground">Оператор саппорта</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Первичная диагностика, Dual-Core готовые скрипты, проверка приватности каналов и ReDoS-ссылок.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-amber-600">Линия 2 • Старший</span>
              <span className="text-[10px] font-mono text-muted-foreground">SLA ≤ 15 мин</span>
            </div>
            <p className="text-xs font-bold text-foreground">Старший смены / Финансы</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Финансовые споры, ручной частичный возврат (Partial Refund), сверка чеков ЮKassa и рефаллинг.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-rose-600">Линия 3 • Эскалация</span>
              <span className="text-[10px] font-mono text-muted-foreground">P0 Alert TG</span>
            </div>
            <p className="text-xs font-bold text-foreground">Администратор / DevOps</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Аварии шлюзов поставщиков, Circuit Breaker OPEN, пополнение балансов провайдеров, блокировки фрода.
            </p>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px]">
              <strong className="text-foreground">Скрытые заметки 🔒:</strong> Внутренняя переписка доступна только персоналу и не видна клиенту.
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20">
            <Send className="w-3 h-3" />
            <span>Telegram Alert при простое &gt; 15м</span>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'SYSTEM_SETTINGS') {
    return (
      <div className="my-4 p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-foreground">Схема 6: Контур системной безопасности и настроек OmniSMM</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">Zero-Trust & Vault</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-center">
          <div className="p-3 rounded-xl bg-slate-500/5 border border-slate-500/20 space-y-1">
            <div className="flex justify-center"><Lock className="w-4 h-4 text-slate-500" /></div>
            <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 block">Vault & Secrets</span>
            <span className="text-xs font-bold text-foreground block">AES-256 Storage</span>
            <span className="text-[10px] text-muted-foreground block">Маскирование API ключей</span>
          </div>
          <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 space-y-1">
            <div className="flex justify-center"><Send className="w-4 h-4 text-sky-500" /></div>
            <span className="text-[10px] font-black uppercase text-sky-600 block">Telegram Bot P0</span>
            <span className="text-xs font-bold text-foreground block">Алерты и Заказы</span>
            <span className="text-[10px] text-muted-foreground block">Idempotent Webhook Reset</span>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-1">
            <div className="flex justify-center"><ShieldCheck className="w-4 h-4 text-purple-500" /></div>
            <span className="text-[10px] font-black uppercase text-purple-600 block">RBAC Matrix</span>
            <span className="text-xs font-bold text-foreground block">16 секций прав</span>
            <span className="text-[10px] text-muted-foreground block">OWNER / ADMIN / SUPPORT</span>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-1">
            <div className="flex justify-center"><AlertTriangle className="w-4 h-4 text-rose-500" /></div>
            <span className="text-[10px] font-black uppercase text-rose-600 block">KillSwitch</span>
            <span className="text-xs font-bold text-foreground block">Режим техработ</span>
            <span className="text-[10px] text-muted-foreground block">HTTP 503 Maintenance</span>
          </div>
        </div>
      </div>
    );
  }

  // CIRCUIT_BREAKER or default
  return (
    <div className="my-4 p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <span className="text-xs font-bold text-foreground">Схема 4: Автоматический Circuit Breaker провайдеров</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20">Fail-Safe</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <span className="text-[10px] font-black uppercase text-emerald-600 block">CLOSED (Штатно)</span>
          <p className="text-xs font-bold text-foreground mt-0.5">Трафик разрешен</p>
          <span className="text-[10px] text-muted-foreground">Ошибок &lt; 5 подряд</span>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <span className="text-[10px] font-black uppercase text-amber-600 block">HALF-OPEN (Тест)</span>
          <p className="text-xs font-bold text-foreground mt-0.5">1 проверочный запрос</p>
          <span className="text-[10px] text-muted-foreground">Кулдаун 60 секунд</span>
        </div>
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
          <span className="text-[10px] font-black uppercase text-rose-600 block">OPEN (Авария)</span>
          <p className="text-xs font-bold text-foreground mt-0.5">Шлюз изолирован</p>
          <span className="text-[10px] text-muted-foreground">Заказы в очередь Failover</span>
        </div>
      </div>
    </div>
  );
}
