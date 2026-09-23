/**
 * Interactive Textbook: Admin Domains Registry
 * Standard: OmniSMM 1.0 Architecture & Operation Passports
 */

import { TextbookDomain } from '../types';

export const TEXTBOOK_DOMAINS: TextbookDomain[] = [
  {
    id: 'ARCH',
    title: 'Архитектура и мульти-тенантность',
    shortTitle: 'Архитектура',
    icon: 'Cpu',
    colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    description: 'Топология Next.js 16, изоляция брендов SMMplan & SMMflux, AES-256 Vault, RBAC',
    volumeNumber: 1,
  },
  {
    id: 'DASHBOARD',
    title: 'Дашборд и сквозная аналитика KPI',
    shortTitle: 'Дашборд & KPI',
    icon: 'BarChart3',
    colorClass: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    description: 'Метрики юнит-экономики, P&L, COGS, обязательства (Liabilities) и телеметрия',
    volumeNumber: 2,
  },
  {
    id: 'ORDERS',
    title: 'Реестр заказов и диспетчеризация',
    shortTitle: 'Заказы & Drip',
    icon: 'Package',
    colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    description: 'Жизненный цикл заказов, аварийный Failover, Partial возврат, Smart Drip-Feed floor',
    volumeNumber: 3,
  },
  {
    id: 'TICKETS',
    title: 'Саппорт, тикет-центр и CRM клиентов',
    shortTitle: 'Саппорт & CRM',
    icon: 'MessageSquareText',
    colorClass: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
    description: 'Омниканальный тикет-центр, регламент SLA 15м, скрытые заметки 🔒, шорткаты /',
    volumeNumber: 4,
  },
  {
    id: 'CATALOG',
    title: 'Каталог услуг, соцсети и ценообразование',
    shortTitle: 'Каталог & Цены',
    icon: 'Layers',
    colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    description: 'Стандарт строго ₽/шт, семантика TargetType, слияние категорий, Карантин >30%',
    volumeNumber: 6,
  },
  {
    id: 'PROVIDERS',
    title: 'Провайдеры API, импорт и здоровье шлюзов',
    shortTitle: 'Провайдеры API',
    icon: 'PlugZap',
    colorClass: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    description: 'Cherry-Pick импорт (Приоритет №1 админа), Shadow Catalog, Circuit Breaker, 50+ кодов',
    volumeNumber: 8,
  },
  {
    id: 'FINANCE',
    title: 'Финансы, Казначейство и налоги (54-ФЗ)',
    shortTitle: 'Финансы & 54-ФЗ',
    icon: 'Wallet',
    colorClass: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
    description: 'Двойная запись LedgerEntry, WalletOps, безнал B2B, НДС 22%, 152-ФЗ анонимизация',
    volumeNumber: 9,
  },
  {
    id: 'SETTINGS',
    title: 'Настройки системы, брендинг и безопасность',
    shortTitle: 'Настройки',
    icon: 'Settings',
    colorClass: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
    description: 'Конфигурация Vault, рубильник KillSwitch, Telegram Bot P0, курсы валют ЦБ РФ, CMS и флаги',
    volumeNumber: 11,
  },
  {
    id: 'RUNBOOKS',
    title: 'Регламенты аварийных ситуаций (Runbooks)',
    shortTitle: 'Runbooks DR',
    icon: 'AlertOctagon',
    colorClass: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    description: 'ГОСТ ЕСПД инструкции DR-01...DR-06: KillSwitch, сбой валидатора, обнуление провайдера',
    volumeNumber: 12,
  },
];
