'use client';

import { 
  DollarSign, 
  TrendingDown, 
  TrendingUp, 
  PieChart 
} from 'lucide-react';
import { QuarantineList, type QuarantineEntry } from '../quarantine-list';
import { FinanceSettingsForm } from '../finance-settings-form';
import { VatThresholdWidget } from '../vat-threshold-widget';
import { fmt } from './finance-helpers';

export interface FinanceMetricsDTO {
  revenueGross: number;
  refunds: number;
  cogs: number;
  marginGross: number;
  marginPercentage: number;
  gatewayFees: number;
  taxes: number;
  opex: number;
  profitNet: number;
  effectiveTaxRate: number;
  annualRevenue: number;
  isVatThresholdExceeded: boolean;
}

export interface FinanceOverviewTabProps {
  metrics: FinanceMetricsDTO;
  settings: {
    taxRate: number;
    opexMonthly: number;
  };
  quarantineList: QuarantineEntry[];
}

export function FinanceOverviewTab({ metrics, settings, quarantineList }: FinanceOverviewTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Escrow Quarantine Notification if any */}
      {quarantineList.length > 0 && (
        <QuarantineList entries={quarantineList} />
      )}

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-success/30 bg-success/10 p-5 space-y-2 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-success">
            <span>Выручка (Gross)</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-foreground">
            {fmt(metrics.revenueGross)}
          </div>
          <div className="text-[11px] text-muted-foreground font-medium">
            Все входящие поступления
          </div>
        </div>

        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-5 space-y-2 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-destructive">
            <span>Возвраты (Refunds)</span>
            <TrendingDown className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-destructive">
            {metrics.refunds > 0 ? `-${fmt(metrics.refunds)}` : fmt(0)}
          </div>
          <div className="text-[11px] text-muted-foreground font-medium">
            Отмены заказов и частичные возвраты
          </div>
        </div>

        <div className="rounded-lg border border-warning/30 bg-warning/10 p-5 space-y-2 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-warning">
            <span>Закупка (COGS)</span>
            <TrendingDown className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-warning">
            {metrics.cogs > 0 ? `-${fmt(metrics.cogs)}` : fmt(0)}
          </div>
          <div className="text-[11px] text-muted-foreground font-medium">
            Себестоимость провайдеров
          </div>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/10 p-5 space-y-2 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-primary">
            <span>Валовая Маржа</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-primary">
            {fmt(metrics.marginGross)}
          </div>
          <div className="text-[11px] text-muted-foreground font-medium">
            {metrics.marginPercentage.toFixed(1)}% маржинальность
          </div>
        </div>
      </div>

      {/* Breakdown & Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: EBITDA / Net Profit Breakdown */}
        <div className="lg:col-span-2 rounded-lg border border-border/70 shadow-xs bg-card/70 backdrop-blur-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-border/50 pb-4">
            <div className="p-2 bg-primary/10 text-primary rounded-lg border border-primary/20">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Расчёт чистой прибыли (P&L)</h3>
              <p className="text-xs text-muted-foreground">
                Калькуляция EBITDA с учетом комиссий платежных шлюзов, налогов и постоянных расходов.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Комиссии шлюзов', value: -metrics.gatewayFees, color: 'text-destructive', desc: 'ЮKassa (3.5%), Robokassa и CryptoBot (1%)' },
              { label: 'Валовая маржа', value: metrics.marginGross, color: 'text-foreground', desc: 'После вычета себестоимости провайдеров и возвратов' },
              { label: `Налоги (${metrics.effectiveTaxRate.toFixed(1)}%)`, value: -metrics.taxes, color: 'text-destructive', desc: 'Оценочный налог УСН на прибыль' },
              { label: 'OPEX (Постоянные расходы)', value: -metrics.opex, color: 'text-destructive', desc: 'Серверы, софт, поддержка, инфраструктура' },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center p-3 rounded-lg bg-muted/20 border border-border/40">
                <div className="space-y-0.5">
                  <span className="text-sm font-bold text-foreground block">{row.label}</span>
                  <span className="text-[11px] text-muted-foreground">{row.desc}</span>
                </div>
                <span className={`font-black font-mono tabular-nums text-sm ${row.color}`}>
                  {fmt(Math.abs(row.value))}
                </span>
              </div>
            ))}

            {/* Net Profit Summary */}
            <div className={`p-5 rounded-lg flex justify-between items-center shadow-xs transition-all ${
              metrics.profitNet >= 0 ? 'bg-success text-primary-foreground' : 'bg-destructive text-primary-foreground'
            }`}>
              <div className="space-y-0.5">
                <span className="text-xs font-black uppercase tracking-widest opacity-80">Чистая прибыль (EBITDA)</span>
                <p className="text-[10px] font-bold opacity-70">За выбранный период</p>
              </div>
              <div className="text-3xl font-black font-mono tabular-nums">
                {fmt(metrics.profitNet)}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Tax & OPEX Widgets */}
        <div className="lg:col-span-1 space-y-6">
          <FinanceSettingsForm 
            initialTaxRate={settings.taxRate} 
            initialOpex={settings.opexMonthly} 
          />
          <VatThresholdWidget
            annualRevenue={metrics.annualRevenue}
            effectiveTaxRate={metrics.effectiveTaxRate}
            isVatThresholdExceeded={metrics.isVatThresholdExceeded}
          />
        </div>
      </div>
    </div>
  );
}
