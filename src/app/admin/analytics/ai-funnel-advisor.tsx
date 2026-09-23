'use client';

import React, { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Sparkles, 
  TrendingDown, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Zap, 
  ArrowUpRight, 
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { getAiFunnelAnalysisAction } from '@/actions/admin/analytics.action';
import type { AiFunnelAnalysisResult } from '@/services/analytics/ai-funnel-analyst.service';

interface AiFunnelAdvisorProps {
  initialAnalysis: AiFunnelAnalysisResult;
  period: number;
}

export function AiFunnelAdvisor({ initialAnalysis, period }: AiFunnelAdvisorProps) {
  const [analysis, setAnalysis] = useState<AiFunnelAnalysisResult>(initialAnalysis);
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const res = await getAiFunnelAnalysisAction(period, true);
        if (res && 'healthScore' in res) {
          setAnalysis(res as AiFunnelAnalysisResult);
        }
      } catch (err) {
        console.error('Failed to refresh AI analysis:', err);
      }
    });
  };

  const getStatusBadge = (status: AiFunnelAnalysisResult['healthStatus'], score: number) => {
    switch (status) {
      case 'EXCELLENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Отлично ({score}/100)
          </span>
        );
      case 'GOOD':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Стабильно ({score}/100)
          </span>
        );
      case 'ATTENTION_NEEDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Требует внимания ({score}/100)
          </span>
        );
      case 'CRITICAL':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <ShieldAlert className="w-3.5 h-3.5" /> Высокие потери ({score}/100)
          </span>
        );
    }
  };

  const getImpactBadge = (impact: string) => {
    if (impact === 'HIGH') {
      return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Высокий эффект</span>;
    }
    return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">Средний эффект</span>;
  };

  return (
    <Card className="border-border/60 shadow-md rounded-2xl overflow-hidden bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              ИИ-Аналитик воронки & CRO Advisor
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Автоматический поиск точек роста и аудит потерь конверсии на базе Gemini 3 Flash
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getStatusBadge(analysis.healthStatus, analysis.healthScore)}
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-background border border-border hover:bg-muted text-foreground transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Пересчитать ИИ-анализ на свежих данных"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
            {isPending ? 'Анализ...' : 'Обновить'}
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Executive Summary */}
        <p className="text-sm text-foreground/90 leading-relaxed font-medium bg-muted/30 p-3 rounded-xl border border-border/40">
          💡 <span className="text-foreground font-semibold">{analysis.summary}</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bottleneck Warning Box */}
          <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5" /> Главное «Узкое горлышко»
              </span>
              <span className="text-xs font-black text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded">
                Отвал: ~{analysis.bottleneck.dropOffRate}%
              </span>
            </div>
            <div className="text-sm font-semibold text-foreground">
              {analysis.bottleneck.step}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {analysis.bottleneck.description}
            </p>
          </div>

          {/* Strengths Box */}
          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Сильные стороны воронки
            </span>
            <ul className="space-y-1 pt-1">
              {analysis.strengths.map((str, idx) => (
                <li key={idx} className="text-xs text-foreground/80 flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span> {str}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Growth Recommendations */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Топ-3 Рекомендации для роста прибыли
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {analysis.growthRecommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-all flex flex-col justify-between space-y-2 shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-foreground line-clamp-1">{rec.title}</span>
                    {getImpactBadge(rec.impact)}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {rec.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/40 text-[11px] font-medium text-primary flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 shrink-0" />
                  <span className="line-clamp-2">{rec.actionItem}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Meta */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/30">
          <div className="flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            Движок: {analysis.source === 'AI_GEMINI' ? '✨ Google Gemini 3 Flash' : '⚡ Эвристический расчет'}
          </div>
          <div>
            Сформировано: {new Date(analysis.generatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
