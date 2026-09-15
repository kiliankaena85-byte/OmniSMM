'use client';

import React, { useState } from 'react';
import '../dashboards.css';
import { 
  Send, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Instagram, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Youtube, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Video, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Share2, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CreditCard, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Zap, 
  Sparkles, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ShieldCheck, 
  ArrowUpRight,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Menu,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  X,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Copy,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Search,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CheckCircle2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  AlertCircle,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  HelpCircle,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Key,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Bell,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Lock,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  User,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ExternalLink,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ChevronRight,
  Loader2
} from 'lucide-react';
import { DASHBOARD_DATA } from './dashboards';
import { createDemoPaymentAction } from '@/actions/order/demo-payment.action';

export type FluxTab = 'dashboard' | 'orders' | 'new-order' | 'transactions' | 'deposit' | 'referrals' | 'support' | 'settings';

export function SmmFluxFullApp({ initialTab = 'dashboard' }: { initialTab?: FluxTab }) {
  const [activeTab, setActiveTab] = useState<FluxTab>(initialTab);

  // Form states
  const [selectedNetwork, setSelectedNetwork] = useState('tg');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedCategory, setSelectedCategory] = useState('subs');
  const [selectedTariff, setSelectedTariff] = useState('std');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [quantity, setQuantity] = useState('1000');
  const [targetLink, setTargetLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [depositAmount, setDepositAmount] = useState('1000');
  const [paymentGateway, setPaymentGateway] = useState('yookassa');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');

  // PromoCode State (R4)
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; bonusText: string } | null>(null);

  // API & Requisites States (R3)
  const [companyName, setCompanyName] = useState('ИП "Аврора СММ"');
  const [inn, setInn] = useState('7702981144');
  const [kpp, setKpp] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [legalAddress, setLegalAddress] = useState('г. Санкт-Петербург, Невский пр., д. 45');
  const [webhookUrl, setWebhookUrl] = useState('https://agency-flux.ru/api/webhook');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [webhookSecret, setWebhookSecret] = useState('flux_sec_99182a7b6c');
  const [isRequisitesSaved, setIsRequisitesSaved] = useState(false);

  // Telegram Chat States
    const [chatMessages, setChatMessages] = useState<any[]>(DASHBOARD_DATA.chatHistory);
  const [chatInput, setChatInput] = useState('');
  const [isOperatorTyping, setIsOperatorTyping] = useState(false);

  const handleSendChatMessage = (textToSend?: string) => {
    const msgText = textToSend || chatInput;
    if (!msgText.trim()) return;

    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: msgText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: true
    };

    setChatMessages(prev => [...prev, newMsg]);
    if (!textToSend) setChatInput('');
    setIsOperatorTyping(true);

    setTimeout(() => {
      setIsOperatorTyping(false);
      setChatMessages(prev => [
        ...prev,
        {
          id: `msg-reply-${Date.now()}`,
          sender: 'operator',
          operatorName: 'Александр (Служба поддержки)',
          avatar: 'АА',
          text: 'Спасибо за сообщение! Дежурный инженер SMMflux проверяет параметры вашего обращения.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: true
        }
      ]);
    }, 1200);
  };

  const handleCopyRef = () => {
    navigator.clipboard?.writeText(`https://smmflux.ru/ref/${DASHBOARD_DATA.refCode}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const calculateTotalCost = () => {
    const tariff = DASHBOARD_DATA.tariffs.find(t => t.id === selectedTariff);
    const rate = parseFloat(tariff?.price || '0.03');
    const qty = parseInt(quantity || '0', 10);
    return (qty * rate).toFixed(2);
  };

  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleExecutePayment = async (amountRub: number, desc: string) => {
    if (isPaying) return;
    setIsPaying(true);
    setPaymentError(null);
    try {
      const res = await createDemoPaymentAction({
        amountRub: Math.max(10, amountRub),
        description: desc,
        gateway: (paymentGateway as 'yookassa' | 'cryptobot' | 'robokassa') || 'yookassa',
        targetLink: targetLink || 'https://t.me/smmflux',
        serviceName: `SMMflux: ${desc}`
      });
      if (res.success && res.paymentUrl) {
        window.location.href = res.paymentUrl;
      }
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : 'Ошибка создания платежа в ЮKassa');
      setIsPaying(false);
    }
  };

  return (
    <div className="smmflux-scope w-full min-h-screen bg-white text-[#100d18] flex flex-col md:flex-row pb-20 md:pb-0">
      
      {/* ── 1. LEFT SIDEBAR NAVIGATION (Desktop) & BOTTOM BAR (Mobile) ── */}
      <aside className="hidden md:flex flex-col justify-between w-64 border-r border-[#ece9f5] p-6 shrink-0 bg-[#ffffff] sticky top-0 h-screen">
        <div className="space-y-8">
          {/* Flux Brand Header */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#3b82f6] via-[#7c3aed] to-[#e0218a] flex items-center justify-center text-white font-black text-xl shadow-lg shadow-[#7c3aed]/30">
              F
            </div>
            <div>
              <span className="font-heading text-2xl font-extrabold text-[#100d18] tracking-tight block leading-none">
                SMMflux
              </span>
              <span className="text-[10px] font-bold text-[#e0218a] uppercase tracking-wider">
                Aurora App
              </span>
            </div>
          </div>

          {/* Navigation Links (Desktop 6+1 items) */}
          <nav className="space-y-2">
            {[
              { id: 'dashboard', label: 'Главная', icon: '⚡' },
              { id: 'new-order', label: 'Создать заказ', icon: '🚀' },
              { id: 'orders', label: 'Мои заказы', icon: '📦' },
              { id: 'deposit', label: 'Финансы', icon: '💎' },
              { id: 'referrals', label: 'Бонусы', icon: '🎁' },
              { id: 'support', label: 'Поддержка', icon: '💬' },
              { id: 'settings', label: 'Настройки', icon: '⚙️' },
            ].map((nav) => {
              const isActive = activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActiveTab(nav.id as FluxTab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#14121d] text-white shadow-md shadow-black/10'
                      : 'text-[#423f54] hover:bg-[#f6f5fb]'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs ${
                    isActive ? 'bg-[#e0218a] text-white' : 'bg-[#ece9f5] text-[#7c3aed]'
                  }`}>
                    {nav.icon}
                  </div>
                  <span>{nav.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Info Footer (Desktop) */}
        <div 
          onClick={() => setActiveTab('settings')}
          className="bg-[#f6f5fb] p-4 rounded-2xl border border-[#ece9f5] space-y-2 cursor-pointer hover:border-[#e0218a]/40 transition-colors"
          title="Настройки профиля"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#423f54]">Клиент:</span>
            <span className="font-mono text-[#79748c]">ART-7F2K</span>
          </div>
          <div className="text-xs font-bold text-[#100d18] truncate flex items-center justify-between">
            <span>client@smmflux.ru</span>
            <span className="text-[10px] text-[#e0218a] font-extrabold">⚙️ Профиль</span>
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR (5 Action Items) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#14121d]/95 backdrop-blur-lg border-t border-white/10 px-2 py-2 flex items-center justify-around text-white">
        {[
          { id: 'dashboard', label: 'Главная', icon: '⚡' },
          { id: 'new-order', label: 'Заказ', icon: '🚀' },
          { id: 'orders', label: 'Заказы', icon: '📦' },
          { id: 'deposit', label: 'Финансы', icon: '💎' },
          { id: 'support', label: 'Помощь', icon: '💬' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as FluxTab)}
            className={`flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === tab.id ? 'text-[#e0218a]' : 'text-white/70'
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span className="text-[10px] font-bold">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── 2. MAIN APP CONTENT AREA ── */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8 overflow-x-hidden min-w-0">
        
        {/* MOBILE TOP BAR (With Avatar button to Settings - Variant A) */}
        <div className="md:hidden flex items-center justify-between border-b border-[#ece9f5] pb-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#3b82f6] to-[#e0218a] flex items-center justify-center text-white font-bold text-sm">
              F
            </div>
            <span className="font-heading text-lg font-extrabold">SMMflux</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('deposit')}
              className="bg-[#14121d] text-white px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer"
            >
              {DASHBOARD_DATA.balance}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className="w-8 h-8 rounded-full bg-[#f6f5fb] border border-[#ece9f5] text-[#100d18] flex items-center justify-center text-xs font-black uppercase cursor-pointer"
              title="Настройки профиля и удаление аккаунта"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* ── PAGE 1: DASHBOARD OVERVIEW ── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="space-y-2">
              <h1 className="font-heading text-2xl sm:text-4xl lg:text-5xl font-extrabold text-[#100d18] tracking-tight leading-tight">
                Что хотите <span className="marker-highlight">продвигать</span> сегодня?
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-[#79748c]">
                Заряжаем социальные сети максимальной активностью за считанные минуты
              </p>
            </div>

            {/* AURORA HERO CARD */}
            <div className="relative rounded-3xl p-6 sm:p-8 text-white overflow-hidden shadow-[0_20px_46px_rgba(124,58,237,0.30)] min-w-0"
                 style={{ background: 'radial-gradient(120% 130% at 12% 0%, #3b82f6 0%, #7c3aed 38%, #d6249f 66%, #f59e6b 100%)' }}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl aurora-blob-1 pointer-events-none" />
              <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-pink-500/30 rounded-full blur-2xl aurora-blob-2 pointer-events-none" />

              <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-widest bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white">
                    Баланс аккаунта
                  </span>
                  <span className="text-xs font-bold text-white/90 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-yellow-300" /> PRO План
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="font-heading text-4xl sm:text-6xl font-black tracking-tight">
                    {DASHBOARD_DATA.balance}
                  </div>
                  <p className="text-xs text-white/80 font-medium">Сберегли {DASHBOARD_DATA.savings} благодаря персональному тарифу</p>
                </div>

                <div className="pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div className="bg-black/20 backdrop-blur-md px-3.5 py-2 rounded-2xl">
                      <span className="text-white/70 block text-[10px]">Потрачено</span>
                      <span className="font-bold text-white text-sm">{DASHBOARD_DATA.spent}</span>
                    </div>
                    <div className="bg-black/20 backdrop-blur-md px-3.5 py-2 rounded-2xl">
                      <span className="text-white/70 block text-[10px]">Выполнено заказов</span>
                      <span className="font-bold text-white text-sm">{DASHBOARD_DATA.ordersCount}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveTab('deposit')}
                    className="bg-[#14121d] hover:bg-black text-white px-6 py-3 rounded-full font-extrabold text-xs transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center gap-2"
                  >
                    <span>Мгновенное пополнение</span>
                    <ArrowUpRight className="w-4 h-4 text-[#e0218a]" />
                  </button>
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={() => setActiveTab('new-order')}
                className="p-6 rounded-3xl bg-[#f6f5fb] border border-[#ece9f5] text-left hover:border-[#e0218a] transition-all group space-y-2"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#e0218a] text-white flex items-center justify-center font-bold">
                  🚀
                </div>
                <h3 className="font-heading text-lg font-bold group-hover:text-[#e0218a] transition-colors">Создать новый заказ</h3>
                <p className="text-xs text-[#79748c]">Выбор из 500+ вариантов продвижения</p>
              </button>

              <button 
                onClick={() => setActiveTab('orders')}
                className="p-6 rounded-3xl bg-[#f6f5fb] border border-[#ece9f5] text-left hover:border-[#7c3aed] transition-all group space-y-2"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#7c3aed] text-white flex items-center justify-center font-bold">
                  📦
                </div>
                <h3 className="font-heading text-lg font-bold group-hover:text-[#7c3aed] transition-colors">Отследить статус заказов</h3>
                <p className="text-xs text-[#79748c]">312 активных и выполненных операций</p>
              </button>
            </div>
          </div>
        )}

        {/* ── PAGE 2: NEW ORDER WIZARD ── */}
        {activeTab === 'new-order' && (
          <section className="bg-[#f6f5fb] rounded-3xl p-6 sm:p-8 border border-[#ece9f5] space-y-6 shadow-sm">
            <div className="border-b border-[#ece9f5] pb-4">
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#100d18]">
                Быстрый запуск <span className="marker-highlight">продвижения</span>
              </h1>
              <p className="text-xs text-[#79748c] mt-1">Заполните параметры и запустите выполнение за 3 секунды</p>
            </div>

            {/* Neon Link Input */}
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#79748c] block">
                1. Ссылка на объект:
              </span>
              <div className="relative flex items-center min-w-0">
                <input
                  type="url"
                  placeholder="Вставьте ссылку на пост / канал (например: t.me/channel)..."
                  value={targetLink}
                  onChange={(e) => setTargetLink(e.target.value)}
                  className="w-full bg-white border-2 border-[#e0218a]/40 focus:border-[#e0218a] rounded-full px-6 py-4 pr-16 text-xs sm:text-sm font-semibold text-[#100d18] placeholder-[#79748c] outline-none shadow-lg shadow-[#e0218a]/5 transition-all truncate"
                />
                <button className="absolute right-2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#14121d] text-white flex items-center justify-center hover:bg-[#e0218a] transition-all shadow-md active:scale-90 shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Social Chips */}
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#79748c] block">
                2. Социальная сеть:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
                {[
                  { id: 'tg', label: 'Telegram', icon: '✈️' },
                  { id: 'ig', label: 'Instagram', icon: '📸' },
                  { id: 'yt', label: 'YouTube', icon: '▶️' },
                  { id: 'tt', label: 'TikTok', icon: '🎵' },
                  { id: 'vk', label: 'VKontakte', icon: '🟦' },
                ].map((chip) => {
                  const isSelected = selectedNetwork === chip.id;
                  return (
                    <button
                      key={chip.id}
                      onClick={() => setSelectedNetwork(chip.id)}
                      className={`px-5 py-3 rounded-full text-xs font-bold flex items-center gap-2 shrink-0 transition-all ${
                        isSelected
                          ? 'bg-[#14121d] text-white shadow-lg shadow-black/20 scale-105'
                          : 'bg-white text-[#423f54] hover:bg-white/80 border border-[#ece9f5]'
                      }`}
                    >
                      <span>{chip.icon}</span>
                      <span>{chip.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horizontal Sliding Tariffs */}
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#79748c] block">
                3. Выберите тариф:
              </span>
              <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-3">
                {DASHBOARD_DATA.tariffs.map((t) => {
                  const isSelected = selectedTariff === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTariff(t.id)}
                      className={`w-64 sm:w-72 shrink-0 p-5 rounded-3xl bg-white border-2 cursor-pointer transition-all flex flex-col justify-between space-y-4 ${
                        isSelected
                          ? 'border-[#e0218a] shadow-xl shadow-[#e0218a]/10 scale-[1.02]'
                          : 'border-[#ece9f5] hover:border-[#7c3aed]/40'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#f6f5fb] text-[#7c3aed]">
                            {t.badge}
                          </span>
                          <span className="text-xs text-[#06b6a4] font-bold">Мин. 10 шт</span>
                        </div>
                        <h4 className="font-heading text-lg font-extrabold text-[#100d18]">{t.name}</h4>
                        <p className="text-xs text-[#79748c]">Запуск: {t.speed}</p>
                      </div>

                      <div className="pt-3 border-t border-[#ece9f5] flex items-center justify-between">
                        <span className="font-heading text-xl font-extrabold text-[#e0218a]">{t.price}</span>
                        <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          isSelected ? 'bg-[#e0218a] text-white' : 'bg-[#f6f5fb] text-[#100d18]'
                        }`}>
                          ✓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#ece9f5]">
              <div className="space-y-1">
                <span className="text-xs font-bold text-[#79748c]">Итого к оплате:</span>
                <div className="font-heading text-2xl font-black text-[#100d18]">{calculateTotalCost()} ₽</div>
              </div>

              <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                {paymentError && (
                  <div className="p-2 rounded-lg bg-red-50 text-red-600 text-[11px] font-bold">
                    {paymentError}
                  </div>
                )}
                <button 
                  type="button"
                  disabled={isPaying}
                  onClick={() => handleExecutePayment(parseFloat(calculateTotalCost()), `Заказ: ${selectedNetwork.toUpperCase()} ${selectedCategory}`)}
                  className="w-full sm:w-auto bg-[#14121d] hover:bg-[#e0218a] text-white px-8 py-4 rounded-full font-extrabold text-xs transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#e0218a]" />
                      <span>Переход в ЮKassa...</span>
                    </>
                  ) : (
                    <>
                      <span>Оплатить и запустить</span>
                      <ArrowUpRight className="w-4 h-4 text-[#e0218a]" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── PAGE 3: ORDERS LIST ── */}
        {activeTab === 'orders' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#100d18]">
                  Мои <span className="marker-highlight">заказы</span>
                </h1>
                <p className="text-xs text-[#79748c]">Карточки вашей активности со статусами и деталями</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {['ALL', 'IN_PROGRESS', 'COMPLETED', 'ERROR'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                      orderStatusFilter === st
                        ? 'bg-[#14121d] text-white shadow-md'
                        : 'bg-[#f6f5fb] text-[#423f54] hover:bg-white'
                    }`}
                  >
                    {st === 'ALL' ? 'Все' : st === 'IN_PROGRESS' ? 'В работе' : st === 'COMPLETED' ? 'Выполнены' : 'Ошибки'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {DASHBOARD_DATA.recentOrders
                .filter(o => orderStatusFilter === 'ALL' || o.status === orderStatusFilter)
                .map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white p-5 rounded-3xl border border-[#ece9f5] shadow-sm hover:shadow-lg transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-[#f6f5fb] flex items-center justify-center shrink-0 text-xl">
                        {ord.network === 'Telegram' ? '✈️' : ord.network === 'Instagram' ? '📸' : '▶️'}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-base font-bold text-[#100d18] truncate">
                            {ord.service}
                          </span>
                          <span className="text-xs font-mono font-bold text-[#79748c]">{ord.id}</span>
                        </div>
                        <p className="text-xs text-[#79748c] truncate">{ord.link}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#ece9f5]">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        ord.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : ord.status === 'IN_PROGRESS'
                          ? 'bg-sky-500/10 text-sky-600'
                          : 'bg-rose-500/10 text-rose-600'
                      }`}>
                        {ord.statusText}
                      </span>
                      <span className="font-heading text-lg font-extrabold text-[#100d18]">
                        {ord.amount}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* ── PAGE: TRANSACTIONS & REFUNDS LEDGER ── */}
        {activeTab === 'transactions' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#100d18]">
                  История <span className="marker-highlight">транзакций</span>
                </h1>
                <p className="text-xs text-[#79748c]">Все списания, пополнения и гарантированные авто-возвраты</p>
              </div>

              <div className="bg-[#e0218a]/10 border border-[#e0218a]/20 text-[#e0218a] px-4 py-2 rounded-full text-xs font-extrabold flex items-center gap-2">
                <span>🔄 100% честный возврат средств</span>
              </div>
            </div>

            {/* Metric Strips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-[#f6f5fb] border border-[#ece9f5] space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-[#79748c] block">Всего пополнено</span>
                <span className="font-heading text-2xl font-black text-emerald-600">{DASHBOARD_DATA.transactionsSummary.totalCredited}</span>
              </div>
              <div className="p-5 rounded-3xl bg-[#f6f5fb] border border-[#ece9f5] space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-[#79748c] block">Возвращено за отмены</span>
                <span className="font-heading text-2xl font-black text-[#e0218a]">+{DASHBOARD_DATA.transactionsSummary.totalRefunded}</span>
              </div>
              <div className="p-5 rounded-3xl bg-[#f6f5fb] border border-[#ece9f5] space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-[#79748c] block">Списано на заказы</span>
                <span className="font-heading text-2xl font-black text-[#100d18]">{DASHBOARD_DATA.transactionsSummary.totalDebited}</span>
              </div>
            </div>

            {/* Transactions Cards */}
            <div className="space-y-3">
              {DASHBOARD_DATA.transactions.map((tx) => {
                const isCredit = tx.type === 'CREDIT';
                const isRefund = tx.category === 'REFUND';
                return (
                  <div
                    key={tx.id}
                    className="bg-white p-5 rounded-3xl border border-[#ece9f5] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                        isRefund ? 'bg-pink-500/10 text-pink-600' : isCredit ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {isRefund ? '🔄' : isCredit ? '💳' : '📦'}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-heading text-base font-bold text-[#100d18]">
                            {tx.title}
                          </span>
                          <span className="text-xs font-mono text-[#79748c]">{tx.id}</span>
                        </div>
                        <p className="text-xs text-[#79748c]">{tx.date}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 border-[#ece9f5] pt-2 sm:pt-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                        isRefund ? 'bg-[#e0218a]/10 text-[#e0218a]' : isCredit ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {tx.statusText}
                      </span>
                      <span className={`font-heading text-xl font-black ${
                        isRefund ? 'text-[#e0218a]' : isCredit ? 'text-emerald-600' : 'text-[#100d18]'
                      }`}>
                        {tx.amount}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── PAGE 4: DEPOSIT ── */}
        {activeTab === 'deposit' && (
          <section className="bg-[#f6f5fb] rounded-3xl p-6 sm:p-8 border border-[#ece9f5] space-y-6">
            <div className="border-b border-[#ece9f5] pb-4">
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#100d18]">
                Мгновенное <span className="marker-highlight">пополнение</span>
              </h1>
              <p className="text-xs text-[#79748c]">Пополняйте баланс банковскими картами или криптовалютой</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="text-xs font-bold text-[#423f54] block">Сумма пополнения (рубли):</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-white border-2 border-[#ece9f5] focus:border-[#e0218a] rounded-2xl px-5 py-3.5 text-lg font-heading font-extrabold text-[#100d18] outline-none"
                />

                <div className="grid grid-cols-2 gap-3">
                  {['yookassa', 'sbp', 'cryptobot', 'robokassa'].map((gw) => (
                    <button
                      key={gw}
                      onClick={() => setPaymentGateway(gw)}
                      className={`p-4 rounded-2xl font-bold text-xs text-left transition-all ${
                        paymentGateway === gw
                          ? 'bg-[#14121d] text-white shadow-lg'
                          : 'bg-white text-[#423f54] border border-[#ece9f5]'
                      }`}
                    >
                      {gw === 'yookassa' ? 'ЮKassa' : gw === 'sbp' ? 'СБП' : gw === 'cryptobot' ? 'CryptoBot' : 'Robokassa'}
                    </button>
                  ))}
                </div>

                <button 
                  type="button"
                  disabled={isPaying}
                  onClick={() => handleExecutePayment(
                    appliedPromo ? Math.round(parseInt(depositAmount || '0') * 1.1) : (parseInt(depositAmount || '0') || 100),
                    'Пополнение баланса'
                  )}
                  className="w-full bg-[#e0218a] hover:bg-pink-600 text-white py-4 rounded-2xl font-extrabold text-sm transition-all shadow-lg shadow-[#e0218a]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Переход в ЮKassa...</span>
                    </>
                  ) : (
                    <span>Оплатить {appliedPromo ? (parseInt(depositAmount || '0') * 1.1).toFixed(0) : depositAmount} ₽</span>
                  )}
                </button>

                {/* PromoCode Input (R4) */}
                <div className="space-y-2 pt-4 border-t border-[#ece9f5]">
                  <label className="text-xs font-bold text-[#423f54] block">Промокод или ваучер:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ввести промокод..."
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                      className="flex-1 bg-white border border-[#ece9f5] focus:border-[#e0218a] rounded-xl px-4 py-2.5 text-xs font-mono uppercase text-[#100d18] outline-none"
                    />
                    <button
                      onClick={() => {
                        if (promoCodeInput.trim()) {
                          setAppliedPromo({
                            code: promoCodeInput.trim(),
                            bonusText: '+10% бонус применён!'
                          });
                        }
                      }}
                      className="bg-[#14121d] hover:bg-black text-white px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all"
                    >
                      Применить
                    </button>
                  </div>

                  {appliedPromo && (
                    <div className="p-3 bg-pink-500/10 border border-pink-500/20 rounded-xl text-xs text-[#e0218a] font-extrabold flex items-center justify-between">
                      <span>✓ Промокод {appliedPromo.code}: {appliedPromo.bonusText}</span>
                      <button onClick={() => setAppliedPromo(null)} className="text-[#79748c]">✕</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#7c3aed] to-[#e0218a] text-white p-6 rounded-3xl space-y-4 shadow-xl flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-xs font-extrabold uppercase bg-white/20 px-3 py-1 rounded-full">Бонусы</span>
                  <h3 className="font-heading text-2xl font-extrabold">Получите до +10% к балансу</h3>
                  <p className="text-xs text-white/80">При пополнении от 5 000 ₽ мы автоматически начислим подарочный бонус.</p>
                </div>
                <div className="font-mono text-xs bg-black/20 p-3 rounded-2xl">
                  Ваша персональная скидка: 5%
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── PAGE 5: REFERRALS ── */}
        {activeTab === 'referrals' && (
          <section className="bg-gradient-to-br from-[#14121d] to-[#252136] text-white p-6 sm:p-8 rounded-3xl space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-2">
              <div>
                <h1 className="font-heading text-2xl sm:text-3xl font-extrabold">
                  Партнёрская программа Flux
                </h1>
                <p className="text-xs text-white/70">Приглашайте друзей и делитесь бонусами 10%</p>
              </div>
              <span className="bg-[#e0218a] px-4 py-1.5 rounded-full text-xs font-extrabold">
                Начислено: {DASHBOARD_DATA.refBalance}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <span className="font-mono font-bold truncate">https://smmflux.ru/ref/{DASHBOARD_DATA.refCode}</span>
              <button
                onClick={handleCopyRef}
                className="bg-[#e0218a] text-white px-4 py-2 rounded-xl font-extrabold shrink-0 hover:bg-pink-600"
              >
                {isCopied ? 'Скопировано!' : 'Копировать'}
              </button>
            </div>
          </section>
        )}

        {/* ── PAGE 6: TELEGRAM STYLE CHAT ── */}
        {activeTab === 'support' && (
          <section className="bg-white rounded-3xl border border-[#ece9f5] shadow-lg overflow-hidden flex flex-col h-[700px] max-h-[85vh]">
            
            {/* Telegram Header */}
            <div className="bg-[#14121d] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#3b82f6] via-[#7c3aed] to-[#e0218a] text-white font-black text-sm flex items-center justify-center shadow-lg">
                    АА
                  </div>
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#06b6a4] border-2 border-[#14121d]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-base font-extrabold text-white">
                      Александр (Поддержка Flux)
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#e0218a] text-white text-[10px] font-extrabold uppercase">
                      В сети
                    </span>
                  </div>
                  <p className="text-xs text-white/70 flex items-center gap-1.5 mt-0.5">
                    <span>отвечает за 2 минуты</span>
                    <span>•</span>
                    <span>{DASHBOARD_DATA.supportHours}</span>
                  </p>
                </div>
              </div>

              <a
                href="https://t.me/smmplan_support"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-extrabold transition-all"
              >
                <Send className="w-4 h-4 text-[#e0218a]" />
                <span>Чат в Telegram ↗</span>
              </a>
            </div>

            {/* Telegram Wallpaper Feed */}
            <div className="flex-1 bg-[#f6f5fb] p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-4">
              
              <div className="flex justify-center">
                <span className="bg-[#14121d]/10 backdrop-blur-md text-[#423f54] text-[11px] font-extrabold px-4 py-1.5 rounded-full">
                  Сегодня, 26 июля
                </span>
              </div>

              <div className="bg-white border border-[#ece9f5] p-3.5 rounded-2xl max-w-md mx-auto flex items-center justify-between text-xs shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#e0218a] animate-pulse" />
                  <span className="font-bold text-[#100d18]">Активный заказ:</span>
                  <span className="text-[#e0218a] font-mono font-bold">#381920</span>
                </div>
                <span className="text-[11px] text-[#79748c] font-bold">Telegram Подписчики</span>
              </div>

              {chatMessages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-[#7c3aed] text-white font-bold text-xs flex items-center justify-center shrink-0">
                        АА
                      </div>
                    )}
                    
                    <div
                      className={`relative p-4 rounded-3xl max-w-[85%] sm:max-w-[70%] space-y-1 shadow-md text-xs ${
                        isUser
                          ? 'bg-gradient-to-r from-[#7c3aed] to-[#e0218a] text-white rounded-br-sm'
                          : 'bg-white text-[#100d18] border border-[#ece9f5] rounded-bl-sm'
                      }`}
                    >
                      {!isUser && (
                        <span className="text-[11px] font-extrabold text-[#7c3aed] block">
                          {msg.operatorName}
                        </span>
                      )}
                      <p className="leading-relaxed font-medium whitespace-pre-wrap">{msg.text}</p>
                      
                      <div className={`flex items-center justify-end gap-1 text-[10px] ${
                        isUser ? 'text-white/80' : 'text-[#79748c]'
                      }`}>
                        <span className="font-mono">{msg.time}</span>
                        {isUser && <span>✓✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isOperatorTyping && (
                <div className="flex items-center gap-2 text-xs text-[#79748c] font-bold">
                  <div className="w-7 h-7 rounded-full bg-[#7c3aed] text-white font-bold text-[10px] flex items-center justify-center">
                    АА
                  </div>
                  <span className="animate-pulse">Александр печатает...</span>
                </div>
              )}
            </div>

            {/* Quick Chips */}
            <div className="bg-[#f6f5fb] px-4 py-2 border-t border-[#ece9f5] flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
              <span className="text-[10px] font-extrabold text-[#79748c] shrink-0 uppercase">Вопросы:</span>
              {[
                '📦 Где заказ #381920?',
                '🔄 Хочу докрутку',
                '💳 Зачисление баланса',
                '🚀 Увеличить скорость'
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendChatMessage(chip)}
                  className="bg-white hover:bg-[#e0218a] hover:text-white text-[#423f54] text-xs font-bold px-3.5 py-1.5 rounded-full border border-[#ece9f5] shrink-0 transition-all shadow-xs"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="bg-white border-t border-[#ece9f5] p-3 sm:p-4 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChatMessage();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  title="Прикрепить заказ"
                  onClick={() => setChatInput(prev => `${prev} [Заказ #381920]`)}
                  className="p-2 text-[#79748c] hover:text-[#e0218a] hover:bg-[#f6f5fb] rounded-full transition-colors shrink-0 text-base"
                >
                  📎
                </button>

                <input
                  type="text"
                  placeholder="Напишите сообщение в чат поддержки..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-[#f6f5fb] border border-transparent focus:border-[#e0218a] focus:bg-white rounded-full px-5 py-3 text-xs text-[#100d18] outline-none transition-all font-semibold"
                />

                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="w-10 h-10 rounded-full bg-[#14121d] hover:bg-[#e0218a] disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-md shrink-0 active:scale-90"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </section>
        )}

        {/* ── PAGE 7: SETTINGS ── */}
        {activeTab === 'settings' && (
          <section className="bg-[#f6f5fb] rounded-3xl p-6 sm:p-8 border border-[#ece9f5] space-y-6">
            <div className="border-b border-[#ece9f5] pb-4">
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#100d18]">
                Настройки <span className="marker-highlight">профиля</span>
              </h1>
              <p className="text-xs text-[#79748c]">Управление параметрами аккаунта SMMflux</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-[#ece9f5] space-y-4 max-w-xl text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#423f54]">Email аккаунта:</label>
                <input
                  type="email"
                  readOnly
                  value="client@smmflux.ru"
                  className="w-full bg-[#f6f5fb] border border-[#ece9f5] rounded-2xl px-4 py-3 font-mono"
                />
              </div>

              <div className="space-y-1 pt-2">
                <label className="font-bold text-[#423f54]">Новый пароль:</label>
                <input
                  type="password"
                  placeholder="Мин. 12 символов..."
                  className="w-full bg-[#f6f5fb] border border-[#ece9f5] rounded-2xl px-4 py-3 font-mono"
                />
              </div>

              <button className="bg-[#14121d] hover:bg-black text-white px-6 py-3 rounded-full font-extrabold">
                Сохранить данные
              </button>

              {/* 152-FZ Compliance (R3) */}
              <div className="space-y-2 pt-4 border-t border-[#ece9f5]">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base font-bold text-[#100d18]">Оферта и 152-ФЗ</h3>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-extrabold">
                    Подтверждено
                  </span>
                </div>
                <div className="bg-[#f6f5fb] p-4 rounded-2xl border border-[#ece9f5] space-y-1 text-xs text-[#79748c]">
                  <div className="flex justify-between">
                    <span>Дата согласия:</span>
                    <span className="font-mono text-[#100d18] font-bold">24 июля 2026, 14:22</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IP фиксации:</span>
                    <span className="font-mono text-[#100d18] font-bold">185.220.101.4</span>
                  </div>
                </div>
              </div>

              {/* API Legal Requisites (R3) */}
              <div className="space-y-3 pt-4 border-t border-[#ece9f5]">
                <h3 className="font-heading text-base font-bold text-[#100d18]">Реквизиты юридического лица</h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Название компании / ИП..."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-[#f6f5fb] border border-[#ece9f5] rounded-2xl px-4 py-2.5 text-xs font-semibold"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="ИНН..."
                      value={inn}
                      onChange={(e) => setInn(e.target.value)}
                      className="w-full bg-[#f6f5fb] border border-[#ece9f5] rounded-2xl px-4 py-2.5 text-xs font-mono"
                    />
                    <input
                      type="text"
                      placeholder="КПП (если есть)..."
                      value={kpp}
                      onChange={(e) => setKpp(e.target.value)}
                      className="w-full bg-[#f6f5fb] border border-[#ece9f5] rounded-2xl px-4 py-2.5 text-xs font-mono"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setIsRequisitesSaved(true)}
                  className="bg-[#14121d] hover:bg-black text-white px-5 py-2.5 rounded-full font-extrabold text-xs"
                >
                  {isRequisitesSaved ? '✓ Сохранено' : 'Сохранить реквизиты'}
                </button>
              </div>

              {/* API Webhook URL (R3) */}
              <div className="space-y-2 pt-4 border-t border-[#ece9f5]">
                <h3 className="font-heading text-base font-bold text-[#100d18]">API Webhook Интеграция</h3>
                <input
                  type="url"
                  placeholder="https://..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full bg-[#f6f5fb] border border-[#ece9f5] rounded-2xl px-4 py-2.5 text-xs font-mono text-[#100d18]"
                />
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
