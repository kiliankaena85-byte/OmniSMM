'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  Store, 
  CreditCard, 
  TrendingUp, 
  Bot 
} from 'lucide-react';
import Link from 'next/link';

interface OnboardingReadinessBarProps {
  settings: {
    brandName?: string | null;
    siteTitle?: string | null;
    logoUrl?: string | null;
    yookassaShopId?: string | null;
    robokassaLogin?: string | null;
    cryptoBotToken?: string | null;
    globalMarginMultiplier?: number | null;
    exchangeRateUSD?: number | null;
    telegramBotToken?: string | null;
    supportEmail?: string | null;
    isTestMode?: boolean;
  };
}

export function OnboardingReadinessBar({ settings }: OnboardingReadinessBarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  // Initialize from localStorage after mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('omnismm_admin_onboarding_collapsed');
      if (saved === 'true') {
        setIsCollapsed(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('omnismm_admin_onboarding_collapsed', String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  };

  // 1. Evaluate 4 Core Milestones
  const isBrandReady = Boolean((settings.brandName || settings.siteTitle) && settings.logoUrl);
  const isPaymentReady = Boolean(settings.yookassaShopId || settings.robokassaLogin || settings.cryptoBotToken);
  const isPricingReady = Boolean((settings.globalMarginMultiplier && settings.globalMarginMultiplier > 1) || (settings.exchangeRateUSD && settings.exchangeRateUSD > 0));
  const isSupportReady = Boolean(settings.telegramBotToken || settings.supportEmail);

  const steps = [
    {
      id: 'brand',
      title: 'Брендинг и Витрина',
      description: 'Название, логотип и реквизиты магазина',
      isCompleted: isBrandReady,
      icon: Store,
      tabHref: '?tab=system',
    },
    {
      id: 'payments',
      title: 'Платежные шлюзы',
      description: 'ЮKassa, Robokassa или CryptoBot',
      isCompleted: isPaymentReady,
      icon: CreditCard,
      tabHref: '?tab=integrations',
    },
    {
      id: 'pricing',
      title: 'Наценки и Валюты',
      description: 'Коэффициент наценки и курс ЦБ РФ',
      isCompleted: isPricingReady,
      icon: TrendingUp,
      tabHref: '?tab=catalog',
    },
    {
      id: 'support',
      title: 'Каналы поддержки',
      description: 'Telegram-бот или email техподдержки',
      isCompleted: isSupportReady,
      icon: Bot,
      tabHref: '?tab=telegram',
    },
  ];

  const completedCount = steps.filter(s => s.isCompleted).length;
  const totalCount = steps.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const isAllComplete = completedCount === totalCount;

  return (
    <Card className="rounded-lg border border-border/70 bg-gradient-to-r from-primary/5 via-card to-primary/5 p-5 sm:p-6 shadow-xs relative overflow-hidden transition-all duration-300">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-1/4 w-72 h-20 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-primary/15 text-primary rounded-lg border border-primary/20 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                Готовность платформы к запуску
              </h3>
              <Badge 
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isAllComplete 
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                    : 'bg-primary/15 text-primary border-primary/20'
                }`}
              >
                {isAllComplete ? '🚀 100% Готово к продажам' : `${progressPercent}% Готово (${completedCount} из ${totalCount})`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
              {isAllComplete 
                ? 'Все ключевые узлы настроены. Платформа полностью готова к приему трафика и оплате заказов.' 
                : 'Заполните базовые параметры для открытия витрины и безопасного приема оплат.'}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleCollapse}
          className="h-8 px-2.5 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground shrink-0 rounded-lg shadow-xs"
          aria-label={isCollapsed ? 'Развернуть чек-лист' : 'Свернуть чек-лист'}
        >
          {isCollapsed ? (
            <>
              <span className="hidden sm:inline">Показать шаги</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Свернуть</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </>
          )}
        </Button>
      </div>

      {/* Progress Line */}
      <div className="w-full bg-muted/40 rounded-full h-2 mt-4 overflow-hidden border border-border/30">
        <div 
          className="bg-gradient-to-r from-primary to-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Expanded Checklist Cards */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`p-3.5 rounded-lg border transition-all duration-200 flex flex-col justify-between gap-3 shadow-xs ${
                  step.isCompleted
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-foreground'
                    : 'bg-card border-border/70 hover:border-primary/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg border shrink-0 ${
                    step.isCompleted
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-muted text-muted-foreground border-border/40'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground truncate">{step.title}</span>
                      {step.isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                      {step.description}
                    </p>
                  </div>
                </div>

                <Link
                  href={step.tabHref}
                  scroll={false}
                  className={`text-[11px] font-bold flex items-center justify-between p-1.5 px-2.5 rounded-lg border transition-colors ${
                    step.isCompleted
                      ? 'bg-background/60 text-muted-foreground hover:text-foreground border-border/40'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90 border-transparent shadow-xs'
                  }`}
                >
                  <span>{step.isCompleted ? 'Изменить' : 'Настроить'}</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
