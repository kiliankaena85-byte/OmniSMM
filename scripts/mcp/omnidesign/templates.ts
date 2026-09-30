/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * OmniDesign MCP Hub — Component Templates for SMMflux & SMMplan.
 */

export function buildFluxCard(name: string, title: string, desc: string): string {
  return `"use client";
import React from "react";
import { FluxCard, FluxBadge, FluxButton } from "@/components/ui";
import { Sparkles, ArrowRight } from "lucide-react";

export function ${name}({ className }: { className?: string }) {
  return (
    <FluxCard variant="bordered" padding="lg" className={\`bg-[#0B0E14] border-border/40 text-foreground \${className ?? ""}\`}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <FluxBadge variant="primary" size="sm" className="bg-primary/10 text-primary border border-primary/20">
          <Sparkles className="w-3.5 h-3.5 mr-1" /> Cobalt Matrix
        </FluxBadge>
        <span className="text-xs text-muted-foreground font-mono">v2.0</span>
      </div>
      <h3 className="text-xl font-bold text-foreground tracking-tight mb-2">${title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">${desc}</p>
      <div className="flex items-center justify-end">
        <FluxButton variant="primary" size="sm" className="gap-2">Подробнее <ArrowRight className="w-4 h-4" /></FluxButton>
      </div>
    </FluxCard>
  );
}
`;
}

export function buildPlanCard(name: string, title: string, desc: string): string {
  return `"use client";
import React from "react";
import { PlanCard, PlanBadge, PlanButton } from "@/components/ui";
import { ShieldCheck, ChevronRight } from "lucide-react";

export function ${name}({ className }: { className?: string }) {
  return (
    <PlanCard variant="bordered" padding="lg" className={\`bg-card border-border shadow-layered text-foreground \${className ?? ""}\`}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <PlanBadge variant="primary" size="sm"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> SMMplan API</PlanBadge>
        <span className="text-xs text-muted-foreground font-semibold">99.98% SLA</span>
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">${title}</h3>
      <p className="text-sm text-muted-foreground mb-6">${desc}</p>
      <div className="flex items-center justify-end">
        <PlanButton variant="outline" size="sm" className="gap-2">Открыть спецификацию <ChevronRight className="w-4 h-4" /></PlanButton>
      </div>
    </PlanCard>
  );
}
`;
}

export function buildFluxTable(name: string, title: string): string {
  return `"use client";
import React from "react";
import { Table } from "@heroui/react";
import { FluxBadge } from "@/components/ui";

export function ${name}() {
  return (
    <div className="w-full bg-[#0B0E14] border border-border/40 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground">${title}</h3>
        <FluxBadge variant="primary" size="sm">Live</FluxBadge>
      </div>
      <Table aria-label="${title} Table" className="min-w-full">
        <Table.Header>
          <Table.Column>ПАРАМЕТР</Table.Column>
          <Table.Column>ЗНАЧЕНИЕ</Table.Column>
          <Table.Column>СТАТУС</Table.Column>
        </Table.Header>
        <Table.Body>
          <Table.Row key="1">
            <Table.Cell className="font-medium text-foreground">Uptime</Table.Cell>
            <Table.Cell className="text-muted-foreground">99.99%</Table.Cell>
            <Table.Cell><span className="text-xs text-success">Активен</span></Table.Cell>
          </Table.Row>
          <Table.Row key="2">
            <Table.Cell className="font-medium text-foreground">Задержка</Table.Cell>
            <Table.Cell className="text-muted-foreground">28ms</Table.Cell>
            <Table.Cell><span className="text-xs text-primary">Normal</span></Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    </div>
  );
}
`;
}

export function buildWizard(name: string, title: string, brand: 'smmflux' | 'smmplan'): string {
  const isFlux = brand === 'smmflux';
  const cardBg = isFlux ? 'bg-[#0B0E14] border-border/40' : 'bg-card border-border';
  return `"use client";
import React, { useState } from "react";
import { CheckCircle2, ChevronRight, ArrowLeft } from "lucide-react";

export function ${name}() {
  const [step, setStep] = useState(1);
  return (
    <div className="w-full max-w-xl mx-auto rounded-2xl border p-6 text-foreground ${cardBg}">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
        <h2 className="text-lg font-bold tracking-tight">${title}</h2>
        <span className="text-xs font-mono text-muted-foreground">Шаг {step} из 3</span>
      </div>
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className={\`h-1.5 flex-1 rounded-full \${s <= step ? "bg-primary" : "bg-muted"}\`} />
        ))}
      </div>
      <div className="min-h-[100px] flex flex-col justify-center">
        {step === 1 && <p className="text-sm text-muted-foreground">Выберите услугу и целевую ссылку для продвижения.</p>}
        {step === 2 && <p className="text-sm text-muted-foreground">Укажите объем заказа с учетом минимального лимита.</p>}
        {step === 3 && (
          <div className="flex items-center gap-2 text-success text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" /> Конфигурация проверена и готова к запуску
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/40">
        <button type="button" onClick={() => setStep((p) => Math.max(1, p - 1))} disabled={step === 1} className="text-xs text-muted-foreground flex items-center gap-1 disabled:opacity-40">
          <ArrowLeft className="w-3.5 h-3.5" /> Назад
        </button>
        <button type="button" onClick={() => setStep((p) => Math.min(3, p + 1))} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5">
          {step === 3 ? "Запустить" : "Далее"} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
`;
}

export function buildHud(name: string, title: string, brand: 'smmflux' | 'smmplan'): string {
  const isFlux = brand === 'smmflux';
  const bg = isFlux ? 'bg-[#0B0E14] border-border/40' : 'bg-card border-border';
  return `"use client";
import React from "react";
import { Activity, Cpu, Wifi } from "lucide-react";

export function ${name}() {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl border ${bg}">
      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5 text-primary" /> ${title}
      </span>
      <div className="h-4 w-px bg-border/40" />
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Cpu className="w-3 h-3 text-muted-foreground" /> NPU: 98%
      </span>
      <div className="h-4 w-px bg-border/40" />
      <span className="text-xs text-success flex items-center gap-1">
        <Wifi className="w-3 h-3" /> SLA: 99.98%
      </span>
    </div>
  );
}
`;
}
