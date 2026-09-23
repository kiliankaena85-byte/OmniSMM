'use client';

/**
 * Tab 3: Architecture, Prisma Models & ADR Inspector
 */

import React, { useState } from 'react';
import { Layers, Database, Shield, FileCode, CheckCircle2, ChevronRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface ArchitectureItem {
  id: string;
  category: 'ADR' | 'MODEL' | 'SECURITY';
  title: string;
  description: string;
  linkText: string;
  href?: string;
  badge: string;
}

const ARCHITECTURE_REGISTRY: ArchitectureItem[] = [
  {
    id: 'adr-20',
    category: 'ADR',
    title: 'ADR-2026-20: Интерактивный виджет OmniManual 1.0',
    description: 'Векторная память в Docker (Qdrant), Gemini 3.8 Flash, пул ротируемых ключей, заземление на код.',
    linkText: 'docs/architecture/ADR-2026-20',
    badge: 'ACCEPTED',
  },
  {
    id: 'adr-18',
    category: 'ADR',
    title: 'ADR-2026-18: Режимы окружения (Sandbox, Hybrid, Prod)',
    description: 'Изоляция контуров эквайринга и исполнения провайдерами.',
    linkText: 'docs/architecture/ADR-2026-18',
    badge: 'ACCEPTED',
  },
  {
    id: 'adr-17',
    category: 'ADR',
    title: 'ADR-2026-17: ExactMath Half-Even и 54-ФЗ НДС 22%',
    description: 'Все денежные расчеты строго в копейках BigInt. Порог УСН 20 млн ₽.',
    linkText: 'docs/architecture/ADR-2026-17',
    badge: 'LOCKED',
  },
  {
    id: 'model-user',
    category: 'MODEL',
    title: 'Prisma Model: User & StaffRole',
    description: 'Баланс в копейках (BigInt), личные ключи Gemini (Vault AES-256), 16 секций прав RBAC.',
    linkText: 'prisma/schema.prisma:model User',
    badge: 'PRISMA 5',
  },
  {
    id: 'model-order',
    category: 'MODEL',
    title: 'Prisma Model: Order & SmartCampaign',
    description: 'Жизненный цикл заказа, Drip-Feed Floor инвариант, поддержка Failover.',
    linkText: 'prisma/schema.prisma:model Order',
    badge: 'PRISMA 5',
  },
  {
    id: 'model-service',
    category: 'MODEL',
    title: 'Prisma Model: Service & Provider',
    description: 'Каталог услуг, теневой буфер цен, карантин зомби-услуг, наценки в basis points.',
    linkText: 'prisma/schema.prisma:model Service',
    badge: 'PRISMA 5',
  },
  {
    id: 'sec-tailscale',
    category: 'SECURITY',
    title: 'Официальный туннель: Tailscale Funnel',
    description: 'Суверенный доступ в РФ в обход блокировок Cloudflare на ТСПУ.',
    linkText: 'AGENTS.md: Rule 10',
    badge: 'SECURITY',
  },
  {
    id: 'sec-proxy',
    category: 'SECURITY',
    title: 'Node.js Runtime Proxy (src/proxy.ts)',
    description: 'Криптографический Nonce, CSP заголовки, маршрутизация тенантов.',
    linkText: 'src/proxy.ts',
    badge: 'SECURITY',
  },
];

export const ManualInspectorTab: React.FC = () => {
  const [filter, setFilter] = useState<'ALL' | 'ADR' | 'MODEL' | 'SECURITY'>('ALL');

  const filtered = ARCHITECTURE_REGISTRY.filter((item) => {
    if (filter === 'ALL') return true;
    return item.category === filter;
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-3 text-xs">
      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1">
        {(['ALL', 'ADR', 'MODEL', 'SECURITY'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
              filter === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 hover:bg-muted text-muted-foreground'
            }`}
          >
            {cat === 'ALL' ? 'Все компоненты' : cat}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2 flex-1">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-lg border border-border/80 bg-card hover:border-primary/40 transition-colors shadow-xs"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                {item.category === 'ADR' && <Layers className="w-3 h-3" />}
                {item.category === 'MODEL' && <Database className="w-3 h-3" />}
                {item.category === 'SECURITY' && <Shield className="w-3 h-3" />}
                <span>{item.badge}</span>
              </span>
            </div>

            <h4 className="font-semibold text-foreground text-xs">{item.title}</h4>
            <p className="text-muted-foreground text-[11px] mt-1 leading-relaxed">{item.description}</p>

            <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="font-mono flex items-center gap-1 text-primary">
                <FileCode className="w-3 h-3" />
                <span>{item.linkText}</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
