'use client';

import * as React from 'react';
import {
  Settings2,
  Smartphone,
  Bot,
  Coins,
  MessageSquare,
  Star,
  BarChart3,
  Globe,
  Activity,
  AlertTriangle,
  Shield,
  Zap,
} from 'lucide-react';

export type TelegramSubTab =
  | 'bots'
  | 'general'
  | 'menu'
  | 'depin'
  | 'mtproto'
  | 'templates'
  | 'csat'
  | 'feedback'
  | 'proxy'
  | 'statistics'
  | 'errors'
  | 'security';

interface TelegramBotSidebarProps {
  activeTab: TelegramSubTab;
  setActiveTab: (tab: TelegramSubTab) => void;
}

export function TelegramBotSidebar({ activeTab, setActiveTab }: TelegramBotSidebarProps) {
  return (
    <div className="lg:col-span-3 flex flex-col gap-1.5 p-2 rounded-2xl bg-muted/20 border border-border/60 sticky top-6">
      <button
        type="button"
        onClick={() => setActiveTab('general')}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer w-full text-left ${
          activeTab === 'general'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <Settings2 className="w-4 h-4" />
        <span>1. Подключение</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('menu')}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer w-full text-left ${
          activeTab === 'menu'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <Smartphone className="w-4 h-4" />
        <span>2. Кнопки Меню</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('bots')}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer w-full text-left ${
          activeTab === 'bots'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <Bot className="w-4 h-4" />
        <span className="flex-1">Конструктор ботов</span>
        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-extrabold shrink-0">NEW</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('depin')}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer w-full text-left ${
          activeTab === 'depin'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <Coins className="w-4 h-4 text-amber-400" />
        <span className="flex-1">Узлы DePIN и Доход</span>
        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-extrabold shrink-0">PTS</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('mtproto')}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer w-full text-left ${
          activeTab === 'mtproto'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <Zap className="w-4 h-4 text-amber-400" />
        <span className="flex-1">MTProto Кластер</span>
        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-extrabold shrink-0">ROOT</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('templates')}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer w-full text-left ${
          activeTab === 'templates'
            ? 'bg-card text-foreground shadow-sm border border-border/80'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <MessageSquare className="w-4 h-4 text-indigo-400" />
        <span>3. Шаблоны Ответов</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('csat')}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer w-full text-left ${
          activeTab === 'csat'
            ? 'bg-card text-foreground shadow-sm border border-border/80'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
        <span>4. Причины Оценок</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('feedback')}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer w-full text-left ${
          activeTab === 'feedback'
            ? 'bg-card text-foreground shadow-sm border border-border/80'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <BarChart3 className="w-4 h-4 text-emerald-400" />
        <span>5. Журнал Отзывов</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('proxy')}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer w-full text-left ${
          activeTab === 'proxy'
            ? 'bg-card text-foreground shadow-sm border border-border/80'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <Globe className="w-4 h-4 text-cyan-400" />
        <span>6. Прокси</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('statistics')}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer w-full text-left ${
          activeTab === 'statistics'
            ? 'bg-card text-foreground shadow-sm border border-border/80'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <Activity className="w-4 h-4 text-purple-400" />
        <span>7. Статистика</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('errors')}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer w-full text-left ${
          activeTab === 'errors'
            ? 'bg-card text-foreground shadow-sm border border-border/80'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <AlertTriangle className="w-4 h-4 text-rose-400" />
        <span>8. Сбои</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('security')}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer w-full text-left ${
          activeTab === 'security'
            ? 'bg-card text-foreground shadow-sm border border-border/80'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <Shield className="w-4 h-4 text-emerald-400" />
        <span>9. Безопасность</span>
      </button>
    </div>
  );
}
