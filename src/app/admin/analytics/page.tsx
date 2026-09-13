import { getFunnelAnalyticsAction, getAiFunnelAnalysisAction } from '@/actions/admin/analytics.action';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminPageHeader } from '@/components/admin/page-header';
import { BarChart as BarChartIcon, Clock, TrendingDown, Download } from 'lucide-react';
import Link from 'next/link';
import { enforceSectionAccess } from '@/lib/server/rbac';
import { LTVCharts } from './ltv-charts';
import { TopServicesTable, ProfitCategoriesTable, ProfitServicesTable } from './tables';
import { AiFunnelAdvisor } from './ai-funnel-advisor';
import type { AiFunnelAnalysisResult } from '@/services/analytics/ai-funnel-analyst.service';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await enforceSectionAccess('analytics');
  const params = await searchParams;
  const period = params.p === '1' ? 1 : 7;
  
  const [analyticsData, aiAnalysis] = await Promise.all([
    getFunnelAnalyticsAction(period),
    getAiFunnelAnalysisAction(period),
  ]);

  if ('error' in analyticsData) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive">Ошибка доступа</h1>
        <p className="text-muted-foreground mt-2">{analyticsData.error}</p>
        <Link href="/admin/dashboard" className="mt-4 inline-block text-primary hover:underline">
          Вернуться на главную
        </Link>
      </div>
    );
  }

  const { funnel, topServices, profitability, ltv } = analyticsData;

  const maxCount = Math.max(funnel.linkPasted, 1);
  
  const s4Pct = funnel.linkPasted > 0 ? (funnel.paymentClicked / funnel.linkPasted) * 100 : 0;
  const dropToS2 = funnel.linkPasted > 0 ? (funnel.serviceSelected / funnel.linkPasted) * 100 : 0;
  const dropToS3 = funnel.serviceSelected > 0 ? (funnel.checkoutInitiated / funnel.serviceSelected) * 100 : 0;
  const dropToS4 = funnel.checkoutInitiated > 0 ? (funnel.paymentClicked / funnel.checkoutInitiated) * 100 : 0;

  function getColorClass(pct: number) {
    if (pct === 0 && maxCount === 1) return 'bg-muted text-muted-foreground';
    if (pct < 30) return 'bg-destructive text-primary-foreground shadow-destructive/20';
    if (pct < 50) return 'bg-warning text-primary-foreground shadow-warning/20';
    return 'bg-success text-primary-foreground shadow-success/20';
  }

  const fmt = (v: number) => (v / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) + ' ₽';

  return (
    <div className="space-y-8 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10 bg-muted/50/30">
      <AdminPageHeader
        icon={BarChartIcon}
        title="Аналитика и Рентабельность"
        description="Глубокий анализ конверсии и чистой прибыли"
        action={(
          <a
            href="/api/admin/export?type=profitability"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-foreground bg-background border border-border shadow-sm rounded-lg hover:bg-muted/50 hover:text-primary transition-colors"
          >
            <Download className="w-4 h-4 shrink-0" /> Отчет бухгалтерии (CSV)
          </a>
        )}
      />

      {/* Controls */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Link
            href="?p=1"
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              period === 1
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
                : 'bg-background border border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" /> 24 Часа
            </div>
          </Link>
          <Link
            href="?p=7"
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              period === 7
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
                : 'bg-background border border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" /> 7 Дней
            </div>
          </Link>
        </div>
      </div>

      {/* AI CRO Advisor Widget */}
      {aiAnalysis && !('error' in aiAnalysis) && (
        <AiFunnelAdvisor initialAnalysis={aiAnalysis as AiFunnelAnalysisResult} period={period} />
      )}

      {/* LTV & Whale Analysis */}
      <LTVCharts ltv={ltv} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Funnel */}
        <Card className="border-border/50 shadow-sm rounded-2xl">
          <CardHeader className="pb-2 border-b border-slate-50">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-primary shrink-0" /> Воронка конверсии
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8 pb-12 flex flex-col items-center justify-center gap-1">

            <div className="w-full max-w-md flex flex-col items-center">
              <div className="w-full py-4 text-center rounded-t-xl font-black bg-primary text-primary-foreground shadow-lg text-sm uppercase tracking-wider">
                1. Трафик (Лендинг): {funnel.linkPasted}
              </div>
              <div className="text-[10px] font-bold text-muted-foreground py-2 uppercase tracking-tighter">BASE (100%)</div>
            </div>

            <div className="w-[85%] max-w-sm flex flex-col items-center -mt-1">
              <div className={`w-full py-3.5 text-center rounded-sm font-black shadow-md text-sm uppercase tracking-wider ${getColorClass(dropToS2)}`}>
                2. Выбор услуги: {funnel.serviceSelected}
              </div>
              <div className="text-[10px] font-bold text-muted-foreground py-2 uppercase tracking-tighter">
                CR: {dropToS2.toFixed(1)}% {dropToS2 < 30 && '🔥 DROP'}
              </div>
            </div>

            <div className="w-[70%] max-w-xs flex flex-col items-center -mt-1">
              <div className={`w-full py-3 text-center rounded-sm font-black shadow-md text-xs uppercase tracking-wider ${getColorClass(dropToS3)}`}>
                3. Чекаут: {funnel.checkoutInitiated}
              </div>
              <div className="text-[10px] font-bold text-muted-foreground py-2 uppercase tracking-tighter">
                CR: {dropToS3.toFixed(1)}% {dropToS3 < 30 && '🔥 DROP'}
              </div>
            </div>

            <div className="w-[50%] max-w-[180px] flex flex-col items-center -mt-1">
              <div className={`w-full py-2.5 text-center rounded-b-xl font-black shadow-md text-xs uppercase tracking-wider ${getColorClass(dropToS4)}`}>
                4. Оплата: {funnel.paymentClicked}
              </div>
              <div className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tighter">
                FINAL CR: {s4Pct.toFixed(1)}%
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Top Services by Clicks */}
        <Card className="border-border/50 shadow-sm rounded-2xl">
          <CardHeader className="pb-2 border-b border-slate-50">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-foreground">Топ 5 Популярных (клики)</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-hidden rounded-xl border border-border">
              <TopServicesTable topServices={topServices} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profitability by Category */}
      <Card className="border-border/50 shadow-sm rounded-2xl">
        <CardHeader className="border-b border-slate-50">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-foreground">Рентабельность по категориям</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <ProfitCategoriesTable categories={profitability.categories} fmt={fmt} />
          </div>
        </CardContent>
      </Card>

      {/* Profitability by Service (Top 15) */}
      <Card className="border-border/50 shadow-sm rounded-2xl">
        <CardHeader className="border-b border-slate-50">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-foreground">Рентабельность по услугам (Топ 15)</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <ProfitServicesTable services={profitability.services} fmt={fmt} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
