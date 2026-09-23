'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { 
  Bot, 
  Send, 
  Sparkles, 
  MessageSquare, 
  Star, 
  CheckCircle2, 
  HelpCircle,
  ShoppingBag,
  Package,
  Wallet,
  User,
  Users,
  ExternalLink,
  Smartphone,
  Zap,
  RotateCcw
} from 'lucide-react';
import { 
  type TelegramMenuButton, 
  type TelegramRatingReasonsConfig, 
  type TelegramMessageTemplatesConfig,
  DEFAULT_TELEGRAM_MENU_BUTTONS,
  DEFAULT_TELEGRAM_RATING_REASONS,
  DEFAULT_TELEGRAM_MESSAGE_TEMPLATES
} from '@/types/telegram';

export type PreviewSimulatorState = 'WELCOME_MENU' | 'SUPPORT_CHAT' | 'CSAT_POLL' | 'REASONS_PICKER' | 'FEEDBACK_SUCCESS';

interface TelegramLivePreviewProps {
  botUsername: string;
  siteName: string;
  menuButtons: TelegramMenuButton[];
  ratingReasons: TelegramRatingReasonsConfig;
  templates: TelegramMessageTemplatesConfig;
}

export function TelegramLivePreview({
  botUsername,
  siteName,
  menuButtons,
  ratingReasons,
  templates
}: TelegramLivePreviewProps) {
  const [activeState, setActiveState] = React.useState<PreviewSimulatorState>('WELCOME_MENU');
  const [simulatedScore, setSimulatedScore] = React.useState<number>(5);
  const [selectedReason, setSelectedReason] = React.useState<string>('Быстрый ответ');

  const buttons = Array.isArray(menuButtons) && menuButtons.length > 0 ? menuButtons : DEFAULT_TELEGRAM_MENU_BUTTONS;
  const reasons = ratingReasons?.negative ? ratingReasons : DEFAULT_TELEGRAM_RATING_REASONS;
  const tpls = templates?.welcome ? templates : DEFAULT_TELEGRAM_MESSAGE_TEMPLATES;

  // Active reply keyboard buttons grouped by row
  const activeButtons = buttons.filter(b => b.isActive !== false);
  const rowMap = new Map<number, TelegramMenuButton[]>();
  for (const b of activeButtons) {
    const r = b.row ?? 0;
    if (!rowMap.has(r)) rowMap.set(r, []);
    rowMap.get(r)!.push(b);
  }
  const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);

  // Formatted welcome
  const formattedWelcome = (tpls.welcome || DEFAULT_TELEGRAM_MESSAGE_TEMPLATES.welcome)
    .replace(/{siteName}/g, siteName || 'SMMplan')
    .replace(/{userName}/g, 'Артём')
    .replace(/{balance}/g, '1 500.00');

  // Formatted ticket closed
  const formattedClosed = (tpls.ticketClosedRating || DEFAULT_TELEGRAM_MESSAGE_TEMPLATES.ticketClosedRating)
    .replace(/{ticketId}/g, 'TK-8492')
    .replace(/{siteName}/g, siteName || 'SMMplan');

  // Formatted thanks
  const formattedThanks = (tpls.ratingThanks || DEFAULT_TELEGRAM_MESSAGE_TEMPLATES.ratingThanks)
    .replace(/{stars}/g, '⭐'.repeat(simulatedScore))
    .replace(/{reasons}/g, selectedReason)
    .replace(/{siteName}/g, siteName || 'SMMplan');

  // Active reasons for simulated score
  let activeReasonList: string[] = [];
  if (simulatedScore <= 2) activeReasonList = reasons.negative || [];
  else if (simulatedScore === 3) activeReasonList = reasons.neutral || [];
  else activeReasonList = reasons.positive || [];

  const handleSelectStar = (score: number) => {
    setSimulatedScore(score);
    setActiveState('REASONS_PICKER');
  };

  const handleSelectReason = (reasonText: string) => {
    setSelectedReason(reasonText);
    setActiveState('FEEDBACK_SUCCESS');
  };

  return (
    <Card className="rounded-3xl border border-border/80 shadow-lg bg-card p-5 space-y-4">
      {/* Simulator Control Tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-primary" />
            Интерактивный симулятор состояний
          </span>
          <button
            type="button"
            onClick={() => {
              setActiveState('WELCOME_MENU');
              setSimulatedScore(5);
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Сброс
          </button>
        </div>

        {/* State Selector Pills */}
        <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-muted/40 border border-border/60 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setActiveState('WELCOME_MENU')}
            className={`py-1.5 rounded-lg transition-all text-center truncate cursor-pointer ${
              activeState === 'WELCOME_MENU' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="1. Меню и Старт"
          >
            1. Меню
          </button>
          <button
            type="button"
            onClick={() => setActiveState('SUPPORT_CHAT')}
            className={`py-1.5 rounded-lg transition-all text-center truncate cursor-pointer ${
              activeState === 'SUPPORT_CHAT' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="2. Чат поддержки"
          >
            2. Диалог
          </button>
          <button
            type="button"
            onClick={() => setActiveState('CSAT_POLL')}
            className={`py-1.5 rounded-lg transition-all text-center truncate cursor-pointer ${
              activeState === 'CSAT_POLL' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="3. Опрос CSAT 1-5 звезд"
          >
            3. CSAT
          </button>
          <button
            type="button"
            onClick={() => setActiveState('REASONS_PICKER')}
            className={`py-1.5 rounded-lg transition-all text-center truncate cursor-pointer ${
              activeState === 'REASONS_PICKER' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="4. Выбор причины"
          >
            4. Теги
          </button>
          <button
            type="button"
            onClick={() => setActiveState('FEEDBACK_SUCCESS')}
            className={`py-1.5 rounded-lg transition-all text-center truncate cursor-pointer ${
              activeState === 'FEEDBACK_SUCCESS' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="5. Финал / Спасибо"
          >
            5. Спасибо
          </button>
        </div>
      </div>

      {/* iPhone Dark Frame */}
      <div className="relative mx-auto w-full max-w-[320px] rounded-[44px] bg-[#000000] p-3 shadow-2xl border-4 border-[#222226] overflow-hidden">
        {/* Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-4 bg-[#111114] rounded-b-xl z-20 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#1e1e24] mr-3" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#2a2a32]" />
        </div>

        {/* Telegram Chat Screen */}
        <div className="w-full h-[540px] rounded-[34px] bg-[#0e1621] text-white flex flex-col justify-between overflow-hidden relative font-sans select-none">
          {/* Header */}
          <div className="pt-6 pb-2.5 px-4 bg-[#17212b] border-b border-[#232e3c] flex items-center gap-3 shrink-0 z-10">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#2AABEE] to-[#229ED9] flex items-center justify-center text-white font-black text-sm shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold truncate leading-tight">{siteName || 'SMMplan'} Support</div>
              <div className="text-[10px] text-[#2AABEE] font-medium leading-tight">@{botUsername || 'bot'} • бот</div>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
            {/* Timestamp Badge */}
            <div className="text-center my-1">
              <span className="bg-[#182533]/80 text-[#708499] text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                Сегодня
              </span>
            </div>

            {/* ── STATE 1: WELCOME & MENU ── */}
            {activeState === 'WELCOME_MENU' && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div className="max-w-[85%] bg-[#182533] p-3 rounded-2xl rounded-tl-sm text-[#f5f5f5] text-[11px] leading-relaxed shadow-sm border border-[#232e3c]/40 space-y-2">
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: formattedWelcome.replace(/\n/g, '<br/>') 
                    }} 
                  />
                  <div className="text-[9px] text-[#708499] text-right font-mono">12:00</div>
                </div>
              </div>
            )}

            {/* ── STATE 2: ACTIVE SUPPORT CHAT ── */}
            {activeState === 'SUPPORT_CHAT' && (
              <div className="space-y-2.5 animate-in fade-in duration-200">
                {/* Client Msg */}
                <div className="flex justify-end">
                  <div className="max-w-[82%] bg-[#2b5278] p-2.5 rounded-2xl rounded-tr-sm text-[#f5f5f5] text-[11px] leading-relaxed shadow-sm">
                    Здравствуйте! Заказ #10842 на подписчиков Telegram задерживается, проверьте пожалуйста.
                    <div className="text-[9px] text-[#86a9d4] text-right font-mono pt-0.5">12:04 ✓✓</div>
                  </div>
                </div>

                {/* Operator Response */}
                <div className="max-w-[85%] bg-[#182533] p-2.5 rounded-2xl rounded-tl-sm text-[#f5f5f5] text-[11px] leading-relaxed shadow-sm border border-[#232e3c]/40">
                  <div className="text-[10px] font-bold text-[#2AABEE] pb-0.5">👨‍💻 Оператор поддержки:</div>
                  Добрый день! Проверили ваш заказ — поставщик перезапустил поток, скорость увеличена. Все 5 000 подписчиков поступят в течение часа!
                  <div className="text-[9px] text-[#708499] text-right font-mono pt-0.5">12:06</div>
                </div>
              </div>
            )}

            {/* ── STATE 3: CSAT POLL (1-5 STARS) ── */}
            {activeState === 'CSAT_POLL' && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div className="max-w-[88%] bg-[#182533] p-3 rounded-2xl rounded-tl-sm text-[#f5f5f5] text-[11px] leading-relaxed shadow-sm border border-[#232e3c]/40 space-y-3">
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: formattedClosed.replace(/\n/g, '<br/>') 
                    }} 
                  />

                  {/* 5 Stars Inline Buttons */}
                  <div className="grid grid-cols-5 gap-1 pt-1 border-t border-[#232e3c]/60">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleSelectStar(star)}
                        className="py-1.5 rounded-lg bg-[#2b5278]/60 hover:bg-[#2b5278] text-amber-300 font-bold text-[11px] text-center transition-colors cursor-pointer"
                      >
                        ⭐ {star}
                      </button>
                    ))}
                  </div>

                  <div className="text-[9px] text-[#708499] text-right font-mono">12:08</div>
                </div>
              </div>
            )}

            {/* ── STATE 4: REASONS PICKER ── */}
            {activeState === 'REASONS_PICKER' && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div className="max-w-[88%] bg-[#182533] p-3 rounded-2xl rounded-tl-sm text-[#f5f5f5] text-[11px] leading-relaxed shadow-sm border border-[#232e3c]/40 space-y-2.5">
                  <div>
                    ⭐ <b>Спасибо за оценку {'⭐'.repeat(simulatedScore)} ({simulatedScore}/5)!</b>
                    <p className="text-[10px] text-[#708499] pt-1">Что именно повлияло на вашу оценку?</p>
                  </div>

                  {/* Inline Reason Buttons */}
                  <div className="space-y-1 pt-1 border-t border-[#232e3c]/60">
                    {activeReasonList.slice(0, 4).map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectReason(r)}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-[#2b5278]/60 hover:bg-[#2b5278] text-white text-[11px] font-medium text-left transition-colors cursor-pointer truncate"
                      >
                        • {r}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleSelectReason('Без уточнения')}
                      className="w-full py-1 rounded-lg bg-[#232e3c]/40 hover:bg-[#232e3c] text-[#708499] hover:text-white text-[10px] text-center transition-colors cursor-pointer"
                    >
                      ✨ Пропустить
                    </button>
                  </div>

                  <div className="text-[9px] text-[#708499] text-right font-mono">12:09</div>
                </div>
              </div>
            )}

            {/* ── STATE 5: FEEDBACK SUCCESS ── */}
            {activeState === 'FEEDBACK_SUCCESS' && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div className="max-w-[88%] bg-[#182533] p-3 rounded-2xl rounded-tl-sm text-[#f5f5f5] text-[11px] leading-relaxed shadow-sm border border-[#232e3c]/40 space-y-2">
                  <div className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Отзыв сохранен: «{selectedReason}»
                  </div>
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: formattedThanks.replace(/\n/g, '<br/>') 
                    }} 
                  />
                  <div className="text-[9px] text-[#708499] text-right font-mono">12:10</div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Area: Simulated Reply Keyboard / Input */}
          <div className="p-2.5 bg-[#17212b] border-t border-[#232e3c] shrink-0 space-y-2">
            {activeState === 'WELCOME_MENU' ? (
              /* Custom Reply Keyboard Grid */
              <div className="space-y-1.5">
                {sortedRows.map(rowKey => {
                  const rowBtns = rowMap.get(rowKey)!.sort((a, b) => (a.col || 0) - (b.col || 0));
                  return (
                    <div key={rowKey} className="grid grid-cols-2 gap-1.5">
                      {rowBtns.map(btn => (
                        <div
                          key={btn.id}
                          className="py-2 px-2 bg-[#2b5278]/80 text-white rounded-xl text-[10px] font-bold text-center truncate shadow-sm border border-[#3b6691]/40"
                          title={btn.label}
                        >
                          {btn.label}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Standard Input Bar for Chat */
              <div className="flex items-center gap-2 bg-[#0e1621] rounded-2xl px-3 py-2 border border-[#232e3c]">
                <span className="text-[11px] text-[#708499] flex-1">Написать сообщение...</span>
                <Send className="w-3.5 h-3.5 text-[#2AABEE]" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
