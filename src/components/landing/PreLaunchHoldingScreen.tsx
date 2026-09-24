'use client';

import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  Send, 
  Mail, 
  MessageSquare, 
  Lock,
  Flame,
  Clock,
  Sliders,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface PreLaunchHoldingScreenProps {
  siteName?: string;
  supportTelegram?: string;
  supportEmail?: string;
  tenantId?: string;
}

export function PreLaunchHoldingScreen({
  siteName = 'SMMplan',
  supportTelegram = 'smmplan_support_bot',
  supportEmail = 'support@smmplan.pro',
  tenantId = 'smmplan',
}: PreLaunchHoldingScreenProps) {
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [agreed, setAgreed] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const telegramUrl = supportTelegram.startsWith('http')
    ? supportTelegram
    : `https://t.me/${supportTelegram.replace('@', '')}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Пожалуйста, введите корректный адрес электронной почты');
      return;
    }

    if (!agreed) {
      toast.error('Необходимо согласие на обработку персональных данных (152-ФЗ)');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/prelaunch/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          tenantId,
          source: 'prelaunch_holding_hero',
          company_fax_id: honeypot,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsSubscribed(true);
        toast.success('Вы успешно зарегистрированы в списке раннего доступа!');
      } else {
        toast.error(data.error || 'Не удалось отправить заявку. Попробуйте снова.');
      }
    } catch {
      toast.error('Ошибка сети. Проверьте подключение и повторите попытку.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col justify-between relative overflow-x-hidden selection:bg-primary selection:text-primary-foreground">
      
      {/* ── Ambient Background Lighting ── */}
      <div className="absolute top-0 inset-x-0 h-[600px] pointer-events-none overflow-hidden select-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[450px] rounded-full bg-gradient-to-b from-primary/20 via-blue-600/10 to-transparent blur-[120px] pointer-events-none" />
        <div className="absolute top-[20%] left-[10%] w-[350px] max-w-full h-[350px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute top-[15%] right-[10%] w-[400px] max-w-full h-[400px] rounded-full bg-cyan-500/10 blur-[110px] pointer-events-none" />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-blue-600 flex items-center justify-center text-primary-foreground font-black text-lg shadow-lg shadow-primary/25 ring-2 ring-primary/20">
            S
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-foreground flex items-center gap-2">
              {siteName}
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              SMM-панель для продвижения в социальных сетях
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="min-h-[40px] px-4 py-2 rounded-xl bg-card/60 hover:bg-card border border-border/40 text-xs font-bold text-foreground transition-all duration-200 backdrop-blur-md flex items-center gap-2 shadow-sm"
          >
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Вход в панель</span>
          </Link>
        </div>
      </header>

      {/* ── Main Hero Section ── */}
      <main className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center text-center">
        
        {/* Badge: Pre-Launch Status */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold mb-6 shadow-inner backdrop-blur-md"
        >
          <Flame className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
          <span>Скоро официальное открытие • Релиз в 2026 году</span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.15] mb-6"
        >
          Удобная SMM-панель <br className="hidden sm:inline" />
          для продвижения{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-500 to-cyan-400">
            в социальных сетях
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-2xl leading-relaxed mb-8"
        >
          Проверенные поставщики услуг, интеллектуальный подбор тарифов, честные цены за 1 штуку и круглосуточная поддержка в Telegram.
        </motion.p>

        {/* Readiness Progress Bar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="w-full max-w-md bg-card/60 border border-border/40 rounded-2xl p-4 mb-8 backdrop-blur-md shadow-lg"
        >
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              Готовность платформы:
            </span>
            <span className="text-primary font-bold">96%</span>
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden p-0.5">
            <div className="h-full bg-gradient-to-r from-primary via-blue-500 to-emerald-400 rounded-full w-[96%] animate-pulse" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-left">
            Финальное тестирование провайдеров, систем оплаты и Telegram-бота.
          </p>
        </motion.div>

        {/* Early Access Form / Waitlist Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full max-w-xl bg-card/70 border border-border/50 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden"
        >
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

          <AnimatePresence mode="wait">
            {!isSubscribed ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1 text-center sm:text-left">
                  <h3 className="text-base sm:text-lg font-extrabold text-foreground flex items-center justify-center sm:justify-start gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                    Получите доступ в числе первых
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Оставьте почту, чтобы получить инвайт к запуску и{' '}
                    <strong className="text-foreground font-semibold">1 000 ₽ бонуса</strong> на стартовый баланс.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  {/* Honeypot field (hidden from real users, filled by bots) */}
                  <input
                    type="text"
                    name="company_fax_id"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    className="opacity-0 absolute -z-50 pointer-events-none w-0 h-0 p-0 m-0 border-0"
                    aria-hidden="true"
                  />
                  <div className="relative flex-1">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Введите ваш email..."
                      required
                      className="w-full min-h-[48px] pl-10 pr-4 rounded-xl bg-background/80 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-xs sm:text-sm font-medium transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 active:scale-98 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Получить доступ</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {/* 152-FZ Consent Checkbox */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none text-[11px] text-muted-foreground mt-1">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary accent-primary"
                  />
                  <span>
                    Согласен на получение уведомления об открытии и обработку данных в соответствии с{' '}
                    <Link href="/legal/privacy" className="text-primary hover:underline">
                      Политикой конфиденциальности (152-ФЗ)
                    </Link>.
                  </span>
                </label>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-4 flex flex-col items-center text-center gap-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-black text-foreground">Заявка принята!</h3>
                <p className="text-xs text-muted-foreground max-w-md">
                  Мы отправили подтверждение на <span className="font-semibold text-foreground">{email}</span>. В день запуска вы получите письмо для активации приветственного баланса 1 000 ₽.
                </p>
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 min-h-[40px] px-5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-bold text-xs flex items-center gap-2 transition-all"
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  Подписаться на канал обновлений в Telegram
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── 4 Accurate Feature Cards ── */}
        <div className="w-full max-w-5xl mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          
          <div className="bg-card/40 border border-border/40 rounded-2xl p-5 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5 shrink-0" />
            </div>
            <h4 className="font-bold text-sm text-foreground mb-1">Честные цены</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Прозрачные розничные цены за 1 шт. Без скрытых комиссий и лишних переплат.
            </p>
          </div>

          <div className="bg-card/40 border border-border/40 rounded-2xl p-5 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-5 h-5 shrink-0" />
            </div>
            <h4 className="font-bold text-sm text-foreground mb-1">Интеллектуальный подбор</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Удобная система фильтрации и подбора проверенных услуг по скорости и гарантии.
            </p>
          </div>

          <div className="bg-card/40 border border-border/40 rounded-2xl p-5 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Sliders className="w-5 h-5 shrink-0" />
            </div>
            <h4 className="font-bold text-sm text-foreground mb-1">Гибкие настройки</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Пошаговый мастер заказа, плавное распределение (Drip-Feed) и отслеживание статуса.
            </p>
          </div>

          <div className="bg-card/40 border border-border/40 rounded-2xl p-5 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-5 h-5 shrink-0" />
            </div>
            <h4 className="font-bold text-sm text-foreground mb-1">Поддержка в Telegram</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Круглосуточный бот поддержки, уведомления о заказах и оперативная связь с командой.
            </p>
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 w-full border-t border-border/30 mt-12 py-8 bg-card/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Инфраструктура активна</span>
          </div>

          <div className="flex items-center gap-6">
            <a 
              href={telegramUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <span>Telegram: @{supportTelegram.replace('@', '')}</span>
            </a>
            <a 
              href={`mailto:${supportEmail}`}
              className="hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{supportEmail}</span>
            </a>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 text-center md:text-right">
            <div>© {new Date().getFullYear()} {siteName}. Все права защищены.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
