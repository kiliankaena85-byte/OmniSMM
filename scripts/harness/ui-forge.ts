/**
 * Antigravity UI Forge Harness v2.0 (Dual-Brand Edition)
 *
 * Единый автоматизированный харнес для создания, валидации и проверки UI-экранов:
 * - `npx tsx scripts/harness/ui-forge.ts list` -> Вывод доступных компонентов UI Арсенала (Flux & Plan)
 * - `npx tsx scripts/harness/ui-forge.ts validate` -> Проверка токенов и правил дизайн-системы
 * - `npx tsx scripts/harness/ui-forge.ts scaffold --brand=smmplan <slug>` -> Генерация API-страницы для SMMplan
 * - `npx tsx scripts/harness/ui-forge.ts scaffold --brand=flux <slug>` -> Генерация страницы Obsidian Matrix для SMMflux
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const FLUX_COMPONENTS = [
  { name: 'FluxButton', description: 'Кнопки (primary, secondary, outline, ghost) по стандарту Cobalt Matrix с лоадером' },
  { name: 'FluxInput', description: 'Поля ввода с иконками, подсказками и shake-анимацией ошибок' },
  { name: 'FluxCard', description: 'Полупрозрачные карточки с рамкой border-border/40 и радиусом rounded-2xl' },
  { name: 'FluxBadge', description: 'Деликатные акцентные бейджи bg-primary/10 text-primary border border-primary/20' },
  { name: 'NumberTicker', description: 'Плавный анимированный счетчик цен и баланса с tabular-nums' },
  { name: 'BorderBeam', description: 'Деликатный световой луч по контуру карточки' },
  { name: 'TiltCard', description: '3D интерактивный наклон карточки за курсором' },
  { name: 'Marquee', description: 'Бесконечная плавная бегущая строка логотипов и отзывов' },
  { name: 'Confetti', description: 'Праздничный салют конфетти при успешном заказе/оплате' },
];

const PLAN_COMPONENTS = [
  { name: 'PlanButton', description: 'Строгие API-кнопки (primary, secondary, outline, ghost) со скруглением rounded-xl' },
  { name: 'PlanCard', description: 'Карточки с четкой рамкой border-border и мягкой тенью shadow-layered' },
  { name: 'PlanBadge', description: 'Контрастные чипы для статусов, очередей и HTTP-методов (GET, POST)' },
  { name: 'PlanTable', description: 'Высокоплотная таблица для прайс-листов, истории заказов и API-ответов' },
];

function printBanner(): void {
  console.log('\n==================================================================\n⚡ ANTIGRAVITY DUAL-BRAND UI FORGE HARNESS v2.0 (SMMplan & SMMflux)\n==================================================================\n');
}

function listArsenal(): void {
  printBanner();
  console.log('✨ [SMMflux] Obsidian Slate & Cobalt Matrix Arsenal (@/components/ui):\n');
  FLUX_COMPONENTS.forEach((c, idx) => console.log(`  ${idx + 1}. \x1b[35m<${c.name} />\x1b[0m — ${c.description}`));
  console.log('\n🏛️ [SMMplan] Classic API Fintech Arsenal (@/components/ui/plan):\n');
  PLAN_COMPONENTS.forEach((c, idx) => console.log(`  ${idx + 1}. \x1b[34m<${c.name} />\x1b[0m — ${c.description}`));
  console.log('\nИмпорт: import { FluxButton, PlanButton, PlanCard, PlanTable } from "@/components/ui";\n');
}

function validateTokens(targetDir = 'src'): void {
  printBanner();
  console.log(`🔍 Запуск AST проверки дизайн-токенов (${targetDir})...\n`);
  try {
    execSync(`npx tsx scripts/check-design-system.ts ${targetDir}`, { stdio: 'inherit' });
  } catch {
    console.error('\n❌ Обнаружены нарушения дизайн-токенов.');
    process.exit(1);
  }
}

function getPlanTemplate(name: string, pascal: string): string {
  return `"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Shield, Zap } from "lucide-react";
import { PlanButton, PlanCard, PlanBadge, PlanTable, PlanTableHeader, PlanTableHeadCell, PlanTableRow, PlanTableCell } from "@/components/ui";

export default function ${pascal}Page() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <div className="absolute top-0 inset-x-0 h-[600px] z-0 pointer-events-none overflow-hidden premium-grid-backdrop opacity-30" />
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border/80 h-16 flex items-center">
        <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black">
              <Zap className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">
              SMMplan <span className="text-xs text-primary font-bold px-2 py-0.5 rounded bg-primary/10 uppercase">API</span>
            </span>
          </Link>
          <Link href="/"><PlanButton variant="outline" size="sm">На главную</PlanButton></Link>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10 w-full">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <PlanBadge variant="primary" size="md">SMMplan API Решения</PlanBadge>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">${name}</h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Высоконагруженная API-инфраструктура для агентств, реселлеров и разработчиков.
          </p>
        </div>
        <PlanCard variant="bordered" padding="lg" className="mb-8">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" />Параметры интеграции и SLA</h3>
          <PlanTable>
            <PlanTableHeader>
              <tr><PlanTableHeadCell>Параметр</PlanTableHeadCell><PlanTableHeadCell>Значение</PlanTableHeadCell><PlanTableHeadCell>Статус</PlanTableHeadCell></tr>
            </PlanTableHeader>
            <tbody>
              <PlanTableRow><PlanTableCell className="font-semibold">Uptime SLA</PlanTableCell><PlanTableCell>99.98%</PlanTableCell><PlanTableCell><PlanBadge variant="success">Гарантировано</PlanBadge></PlanTableCell></PlanTableRow>
              <PlanTableRow><PlanTableCell className="font-semibold">Скорость API</PlanTableCell><PlanTableCell>&lt; 45ms</PlanTableCell><PlanTableCell><PlanBadge variant="primary">High-Speed</PlanBadge></PlanTableCell></PlanTableRow>
            </tbody>
          </PlanTable>
          <div className="mt-6 flex justify-end">
            <PlanButton variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>Подключить тариф</PlanButton>
          </div>
        </PlanCard>
      </main>
    </div>
  );
}
`;
}

function getFluxTemplate(name: string, pascal: string): string {
  return `"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { FluxButton, FluxCard, FluxBadge, NumberTicker, BorderBeam } from "@/components/ui";

export default function ${pascal}Page() {
  return (
    <div className="min-h-screen bg-[#0B0E14] text-foreground relative overflow-hidden flex flex-col font-sans">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10 w-full flex flex-col items-center">
        <FluxBadge variant="primary" pulse icon={<Sparkles className="w-3.5 h-3.5" />} className="mb-6 bg-primary/10 text-primary border border-primary/20">
          SMMflux Matrix
        </FluxBadge>
        <h1 className="text-4xl sm:text-6xl font-black text-center tracking-tight text-foreground mb-6">
          Заголовок <span className="text-primary">${name}</span>
        </h1>
        <p className="text-muted-foreground text-center max-w-2xl text-base sm:text-lg mb-12">
          Высокоскоростная инфраструктура продвижения по стандартам Obsidian Slate & Cobalt Matrix.
        </p>
        <FluxCard variant="glass" padding="xl" className="w-full max-w-2xl relative border border-border/40 bg-card/40 backdrop-blur-xl">
          <BorderBeam duration={8} />
          <div className="space-y-6 text-center">
            <h3 className="text-2xl font-black text-foreground">Интерактивный узел</h3>
            <p className="text-muted-foreground text-sm">Текущий показатель: <NumberTicker value={99.9} />%</p>
            <div className="flex justify-center">
              <FluxButton variant="primary" size="lg" rightIcon={<ArrowRight className="w-5 h-5" />}>Главное целевое действие</FluxButton>
            </div>
          </div>
        </FluxCard>
      </main>
    </div>
  );
}
`;
}

function scaffoldPage(brand: string, pageName: string): void {
  printBanner();
  if (!pageName) {
    console.error('Usage: npx tsx scripts/harness/ui-forge.ts scaffold [--brand=smmplan|flux] <page-slug>');
    process.exit(1);
  }
  const isPlan = brand === 'smmplan' || brand === 'plan';
  const slug = pageName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const targetDir = path.resolve(process.cwd(), `src/app/${slug}`);
  const targetFile = path.join(targetDir, 'page.tsx');

  if (fs.existsSync(targetFile)) {
    console.error(`❌ Страница ${targetFile} уже существует.`);
    process.exit(1);
  }
  fs.mkdirSync(targetDir, { recursive: true });
  const pascalName = slug.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase());
  const template = isPlan ? getPlanTemplate(pageName, pascalName) : getFluxTemplate(pageName, pascalName);
  fs.writeFileSync(targetFile, template, 'utf-8');
  console.log(`✅ Шаблон страницы (${isPlan ? 'SMMplan API' : 'SMMflux Obsidian'}) создан: \x1b[32m${targetFile}\x1b[0m`);
}

const args = process.argv.slice(2);
const brandArg = args.find((a) => a.startsWith('--brand='))?.split('=')[1] || 'flux';
const remainingArgs = args.filter((a) => !a.startsWith('--brand='));
const command = remainingArgs[0];
const pageName = remainingArgs[1];

switch (command) {
  case 'list':
    listArsenal();
    break;
  case 'validate':
    validateTokens(pageName);
    break;
  case 'scaffold':
    scaffoldPage(brandArg, pageName);
    break;
  default:
    printBanner();
    console.log('Команды UI Forge Harness:');
    console.log('  npx tsx scripts/harness/ui-forge.ts list                                  — Список компонентов');
    console.log('  npx tsx scripts/harness/ui-forge.ts validate [dir]                        — Проверка дизайн-токенов');
    console.log('  npx tsx scripts/harness/ui-forge.ts scaffold --brand=smmplan <slug>      — Создать API-страницу SMMplan');
    console.log('  npx tsx scripts/harness/ui-forge.ts scaffold --brand=flux <slug>         — Создать страницу SMMflux\n');
    break;
}
