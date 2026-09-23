'use client';

import React, { useState } from 'react';
import '../dashboards.css';
import { 
  Send, 
  Instagram, 
  Youtube, 
  Video, 
  Share2, 
  CreditCard, 
  Zap, 
  ShieldCheck, 
  ArrowUpRight,
  Menu,
  X,
  Copy,
  Award,
  Search,
  CheckCircle2,
  Check,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { DASHBOARD_DATA } from './dashboards';
import { createDemoPaymentAction } from '@/actions/order/demo-payment.action';

export type PlanTab = 'dashboard' | 'orders' | 'new-order' | 'transactions' | 'deposit' | 'referrals' | 'support' | 'settings';

export function SmmPlanFullApp({ initialTab = 'dashboard' }: { initialTab?: PlanTab }) {
  const [activeTab, setActiveTab] = useState<PlanTab>(initialTab);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Form states
  const [selectedNetwork, setSelectedNetwork] = useState('tg');
  const [selectedCategory, setSelectedCategory] = useState('subs');
  const [selectedTariff, setSelectedTariff] = useState('std');
  const [quantity, setQuantity] = useState('1000');
  const [targetLink, setTargetLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [depositAmount, setDepositAmount] = useState('1000');
  const [paymentGateway, setPaymentGateway] = useState('yookassa');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Record<string, unknown> | null>(null);

  // PromoCode State (R4)
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; bonusText: string } | null>(null);

  // API & Legal Requisites States (R3)
  const [companyName, setCompanyName] = useState('ООО "СММ ПЛАН"');
  const [inn, setInn] = useState('7701984210');
  const [kpp, setKpp] = useState('77010101');
  const [legalAddress, setLegalAddress] = useState('г. Москва, ул. Тверская, д. 12, стр. 1');
  const [webhookUrl, setWebhookUrl] = useState('https://my-agency.ru/api/smmplan-webhook');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [webhookSecret, setWebhookSecret] = useState('whsec_8f91a2b3c4d5e6f7');
  const [isRequisitesSaved, setIsRequisitesSaved] = useState(false);

  // Telegram Chat States
    const [chatMessages, setChatMessages] = useState<typeof DASHBOARD_DATA.chatHistory>(DASHBOARD_DATA.chatHistory);
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
          text: 'Спасибо за ваше обращение! Информация передана инженеру. Проверяем параметры выполнения вашего заказа.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: true
        }
      ]);
    }, 1200);
  };

  const handleCopyRef = () => {
    navigator.clipboard?.writeText(`https://smmplan.ru/ref/${DASHBOARD_DATA.refCode}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const calculateTotalCost = () => {
    const tariff = DASHBOARD_DATA.tariffs.find(t => t.id === selectedTariff);
    const rate = parseFloat(tariff?.price || '0.03');
    const qty = parseInt(quantity || '0', 10);
    return (qty * rate).toFixed(2);
  };

  const handleExecutePayment = async (amountRub: number, desc: string) => {
    if (isPaying) return;
    setIsPaying(true);
    setPaymentError(null);
    try {
      const res = await createDemoPaymentAction({
        amountRub: Math.max(10, amountRub),
        description: desc,
        gateway: (paymentGateway as 'yookassa' | 'cryptobot' | 'robokassa') || 'yookassa',
        targetLink: targetLink || 'https://t.me/smmplan',
        serviceName: `SMMplan: ${desc}`
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
    <div className="smmplan-scope w-full min-h-screen pb-16 bg-[#e9edf2]">
      
      {/* ── 1. TOP HEADER NAVIGATION ── */}
      <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            
            {/* Brand Logo */}
            <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-9 h-9 rounded-xl bg-[#1f9bf0] flex items-center justify-center text-white font-black text-lg shadow-sm">
                P
              </div>
              <span className="font-heading text-xl text-[#0e131a] tracking-tight font-extrabold">
                SMMplan
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold bg-[#e7f2fe] text-[#1f9bf0] rounded-full uppercase tracking-wider">
                Terminal
              </span>
            </div>

            {/* Desktop Navigation (6+1 streamlined items) */}
            <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 overflow-x-auto custom-scrollbar">
              {[
                { id: 'dashboard', label: 'Главная' },
                { id: 'new-order', label: 'Создать заказ' },
                { id: 'orders', label: 'Мои заказы' },
                { id: 'deposit', label: 'Финансы' },
                { id: 'referrals', label: 'Партнёрам' },
                { id: 'support', label: 'Поддержка' },
                { id: 'settings', label: 'Настройки' },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as PlanTab)}
                    className={`px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      isActive 
                        ? 'text-[#1f9bf0] bg-[#e7f2fe] font-bold' 
                        : 'text-[#414a59] hover:bg-[#e9edf2]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* Right Quick Balance & Avatar */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div 
                onClick={() => setActiveTab('deposit')}
                className="bg-[#e9edf2] hover:bg-[#d3dce8] px-3 sm:px-3.5 py-1.5 rounded-full border border-[#d3dce8] flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <span className="text-xs font-semibold text-[#8b94a3] uppercase hidden sm:inline whitespace-nowrap">Баланс:</span>
                <span className="font-mono-data font-bold text-[#0e131a] text-xs sm:text-sm lg:text-base whitespace-nowrap">{DASHBOARD_DATA.balance}</span>
              </div>
              <button 
                onClick={() => setActiveTab('deposit')}
                className="hidden sm:flex items-center gap-1.5 bg-[#1f9bf0] hover:bg-[#0b7fd4] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Пополнить</span>
              </button>

              {/* Mobile Profile Avatar Link (Variant A) */}
              <button 
                onClick={() => setActiveTab('settings')}
                className="md:hidden w-8 h-8 rounded-xl bg-[#e7f2fe] text-[#1f9bf0] border border-[#1f9bf0]/20 flex items-center justify-center font-bold text-xs uppercase cursor-pointer"
                title="Настройки профиля и удаление аккаунта"
              >
                👤
              </button>

              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-[#414a59] hover:bg-[#e9edf2] rounded-lg cursor-pointer"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-[#e2e8f0] py-3 space-y-1 animate-in slide-in-from-top duration-200">
              {[
                { id: 'dashboard', label: 'Главная' },
                { id: 'new-order', label: 'Быстрый заказ' },
                { id: 'orders', label: 'Мои заказы' },
                { id: 'transactions', label: 'Транзакции & Возвраты' },
                { id: 'deposit', label: 'Пополнение' },
                { id: 'referrals', label: 'Рефералы' },
                { id: 'support', label: 'Поддержка' },
                { id: 'settings', label: 'Настройки' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as PlanTab);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${
                    activeTab === tab.id ? 'font-bold text-[#1f9bf0] bg-[#e7f2fe]' : 'font-medium text-[#414a59]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── 2. TICKER CAPSULE BAR ── */}
      <div className="bg-[#0e131a] text-white py-2 overflow-hidden border-b border-[#e2e8f0]">
        <div className="ticker-track text-xs font-semibold space-x-8 px-4">
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1f9d6b] animate-pulse" />
            <span>Платформа работает в штатном режиме</span>
          </span>
          <span>⚡ 15+ соцсетей</span>
          <span>• 500+ услуг</span>
          <span>• Авто-выполнение 24/7</span>
          <span>• 9–21 Поддержка МСК</span>
          <span>• Сберегли клиентам 5 940 ₽</span>
          <span>• Выполнено заказов: 1 420 000+</span>
        </div>
      </div>

      {/* ── 3. MAIN TABBED WORKSPACE ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">

        {/* ── PAGE 1: DASHBOARD OVERVIEW ── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Balance Hero Card */}
              <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-8 border border-[#e2e8f0] border-l-4 border-l-[#1f9bf0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] flex flex-col justify-between min-w-0">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8b94a3]">Текущий баланс</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e6f7f0] text-[#1f9d6b] text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1f9d6b]" />
                      Активен
                    </span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <h1 className="font-mono-data text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0e131a] tracking-tight">
                      {DASHBOARD_DATA.balance}
                    </h1>
                    <span className="text-xs font-semibold text-[#8b94a3]">ID счёта: #USR-8491</span>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                    <div>
                      <span className="text-[11px] font-semibold text-[#8b94a3] block">Всего потрачено</span>
                      <span className="font-mono-data text-sm sm:text-base font-bold text-[#0e131a]">{DASHBOARD_DATA.spent}</span>
                    </div>
                    <div className="w-px h-8 bg-[#e2e8f0] hidden sm:block" />
                    <div>
                      <span className="text-[11px] font-semibold text-[#8b94a3] block">Сэкономлено</span>
                      <span className="font-mono-data text-sm sm:text-base font-bold text-[#1f9d6b]">+{DASHBOARD_DATA.savings}</span>
                    </div>
                    <div className="w-px h-8 bg-[#e2e8f0] hidden sm:block" />
                    <div>
                      <span className="text-[11px] font-semibold text-[#8b94a3] block">Заказов</span>
                      <span className="font-mono-data text-sm sm:text-base font-bold text-[#0e131a]">{DASHBOARD_DATA.ordersCount} шт</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveTab('deposit')}
                    className="w-full sm:w-auto bg-[#1f9bf0] hover:bg-[#0b7fd4] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Пополнить баланс</span>
                  </button>
                </div>
              </div>

              {/* Status Side Card */}
              <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] flex flex-col justify-between space-y-4 min-w-0">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
                  <h3 className="font-heading text-sm font-bold text-[#0e131a] flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#1f9bf0]" />
                    Статус: <span className="text-[#1f9bf0]">PRO Клиент</span>
                  </h3>
                  <span className="text-xs font-mono-data text-[#8b94a3]">Скидка 5%</span>
                </div>

                <div className="space-y-3">
                  <div className="bg-[#e9edf2] p-3 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#414a59]">Реферальный доход:</span>
                    <span className="font-mono-data font-bold text-[#0e131a]">{DASHBOARD_DATA.refBalance}</span>
                  </div>
                  <div className="bg-[#e9edf2] p-3 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#414a59]">Приоритет задач:</span>
                    <span className="font-semibold text-[#1f9d6b] flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" /> Мгновенный отклик
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => setActiveTab('new-order')}
                  className="w-full text-center block bg-[#0e131a] text-white py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800"
                >
                  Перейти к созданию заказа →
                </button>
              </div>
            </div>

            {/* Quick Orders Summary */}
            <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] space-y-4">
              <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4">
                <h2 className="font-heading text-lg font-bold text-[#0e131a]">Последние 4 заказа</h2>
                <button onClick={() => setActiveTab('orders')} className="text-xs font-bold text-[#1f9bf0] hover:underline">
                  Перейти в полный список ({DASHBOARD_DATA.ordersCount}) →
                </button>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] text-[11px] font-bold text-[#8b94a3] uppercase">
                      <th className="py-3 px-4">ID</th>
                      <th className="py-3 px-4">Услуга</th>
                      <th className="py-3 px-4">Ссылка</th>
                      <th className="py-3 px-4">Статус</th>
                      <th className="py-3 px-4 text-right">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0] text-xs">
                    {DASHBOARD_DATA.recentOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-[#e9edf2]/40 transition-colors">
                        <td className="py-3 px-4 font-mono-data font-bold text-[#0e131a]">{ord.id}</td>
                        <td className="py-3 px-4 font-semibold text-[#0e131a]">{ord.service}</td>
                        <td className="py-3 px-4 font-mono-data text-[#8b94a3] max-w-[180px] truncate">{ord.link}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            ord.status === 'COMPLETED'
                              ? 'bg-[#e6f7f0] text-[#1f9d6b] border-[#1f9d6b]/20'
                              : ord.status === 'IN_PROGRESS'
                              ? 'bg-[#e7f2fe] text-[#1f9bf0] border-[#1f9bf0]/20'
                              : 'bg-[#fdeeee] text-[#d6453d] border-[#d6453d]/20'
                          }`}>
                            {ord.statusText}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-data font-extrabold text-[#0e131a]">{ord.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PAGE 2: NEW ORDER WIZARD ── */}
        {activeTab === 'new-order' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] space-y-6">
            <div className="border-b border-[#e2e8f0] pb-4">
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#0e131a]">
                Форма создания нового заказа
              </h1>
              <p className="text-xs text-[#8b94a3]">Выберите соцсеть, категорию и тариф для мгновенного старта</p>
            </div>

            {/* STEP 1 */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#8b94a3] block">
                1. Социальная сеть
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { id: 'tg', name: 'Telegram', icon: Send, color: 'text-[#1f9bf0]' },
                  { id: 'ig', name: 'Instagram', icon: Instagram, color: 'text-pink-600' },
                  { id: 'yt', name: 'YouTube', icon: Youtube, color: 'text-red-600' },
                  { id: 'tt', name: 'TikTok', icon: Video, color: 'text-slate-900' },
                  { id: 'vk', name: 'VK', icon: Share2, color: 'text-blue-600' },
                  { id: 'rt', name: 'Rutube', icon: Zap, color: 'text-emerald-600' },
                ].map((net) => {
                  const IconComp = net.icon;
                  const isSelected = selectedNetwork === net.id;
                  return (
                    <button
                      key={net.id}
                      onClick={() => setSelectedNetwork(net.id)}
                      className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        isSelected 
                          ? 'border-[#1f9bf0] bg-[#e7f2fe] ring-2 ring-[#1f9bf0]/20' 
                          : 'border-[#e2e8f0] bg-white hover:border-[#d3dce8]'
                      }`}
                    >
                      <IconComp className={`w-5 h-5 ${net.color}`} />
                      <span className="text-xs font-bold text-[#0e131a]">{net.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 2 */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#8b94a3] block">
                2. Категория услуги
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'subs', name: 'Подписчики / Участники' },
                  { id: 'views', name: 'Просмотры постов / видео' },
                  { id: 'likes', name: 'Лайки и одобрения' },
                  { id: 'react', name: 'Реакции (🔥👍🎉)' },
                  { id: 'comments', name: 'Комментарии с текстом' },
                  { id: 'stars', name: 'Звёзды и бусты канала' },
                ].map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-[#0e131a] text-white shadow-sm'
                          : 'bg-[#e9edf2] text-[#414a59] hover:bg-[#d3dce8]'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 3 */}
            <div className="space-y-4 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#8b94a3] block">
                3. Тариф и качество
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {DASHBOARD_DATA.tariffs.map((t) => {
                  const isSelected = selectedTariff === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTariff(t.id)}
                      className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-4 ${
                        isSelected 
                          ? 'border-[#1f9bf0] bg-white ring-2 ring-[#1f9bf0]/20 shadow-md' 
                          : 'border-[#e2e8f0] bg-white hover:border-[#d3dce8]'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${t.badgeBg}`}>
                            {t.badge}
                          </span>
                          {t.popular && (
                            <span className="text-[10px] font-bold text-[#1f9bf0] bg-[#e7f2fe] px-2 py-0.5 rounded-md">
                              ХИТ ПРОДАЖ
                            </span>
                          )}
                        </div>
                        <h4 className="font-heading text-base font-bold text-[#0e131a]">{t.name}</h4>
                        <p className="text-xs text-[#8b94a3]">Скорость: {t.speed}</p>
                      </div>

                      <div className="pt-2 border-t border-[#e2e8f0] flex items-baseline justify-between">
                        <span className="text-xs text-[#414a59]">Цена за 1 шт:</span>
                        <span className="font-mono-data text-lg font-extrabold text-[#0e131a]">{t.price}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* INPUT FORM */}
              <div className="bg-[#e9edf2]/70 p-6 rounded-2xl border border-[#e2e8f0] grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-6 space-y-1.5 min-w-0">
                  <label className="text-xs font-bold text-[#414a59] block">Ссылка на объект (канал/пост/видео)</label>
                  <input
                    type="url"
                    placeholder="https://t.me/my_channel"
                    value={targetLink}
                    onChange={(e) => setTargetLink(e.target.value)}
                    className="w-full bg-white border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-xs text-[#0e131a] focus:outline-none focus:border-[#1f9bf0] font-mono-data"
                  />
                </div>

                <div className="md:col-span-3 space-y-1.5 min-w-0">
                  <label className="text-xs font-bold text-[#414a59] block">Количество (мин. 10)</label>
                  <input
                    type="number"
                    min="10"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-white border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-xs text-[#0e131a] focus:outline-none focus:border-[#1f9bf0] font-mono-data"
                  />
                </div>

                <div className="md:col-span-3 min-w-0">
                  {paymentError && (
                    <div className="mb-2 p-2 rounded-lg bg-red-50 text-red-600 text-[11px] font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  )}
                  <button 
                    type="button"
                    disabled={isPaying}
                    onClick={() => handleExecutePayment(parseFloat(calculateTotalCost()), `Заказ: ${selectedNetwork.toUpperCase()} ${selectedCategory}`)}
                    className="w-full bg-[#1f9bf0] hover:bg-[#0b7fd4] text-white py-3 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                  >
                    {isPaying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Переход в ЮKassa...</span>
                      </>
                    ) : (
                      <>
                        <span>Подтвердить и оплатить ({calculateTotalCost()} ₽)</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PAGE 3: ORDERS LIST ── */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e2e8f0] pb-4 gap-4">
              <div>
                <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#0e131a]">
                  История заказов ({DASHBOARD_DATA.ordersCount})
                </h1>
                <p className="text-xs text-[#8b94a3]">Полный реестр ваших заказов с отслеживанием прогресса</p>
              </div>

              {/* Status Filters */}
              <div className="flex flex-wrap gap-1.5 bg-[#e9edf2] p-1 rounded-xl text-xs font-bold">
                {['ALL', 'IN_PROGRESS', 'COMPLETED', 'ERROR'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      orderStatusFilter === st ? 'bg-white text-[#0e131a] shadow-sm' : 'text-[#8b94a3]'
                    }`}
                  >
                    {st === 'ALL' ? 'Все' : st === 'IN_PROGRESS' ? 'В работе' : st === 'COMPLETED' ? 'Выполнены' : 'Ошибки'}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-3 bg-[#e9edf2]/50 border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-xs">
              <Search className="w-4 h-4 text-[#8b94a3]" />
              <input
                type="text"
                placeholder="Поиск по ID заказа или ссылке..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="w-full bg-transparent outline-none text-[#0e131a]"
              />
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#e2e8f0] text-[11px] font-bold text-[#8b94a3] uppercase">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Дата и Время</th>
                    <th className="py-3 px-4">Услуга</th>
                    <th className="py-3 px-4">Ссылка</th>
                    <th className="py-3 px-4">Статус</th>
                    <th className="py-3 px-4 text-right">Стоимость</th>
                    <th className="py-3 px-4 text-center">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] text-xs font-mono-data">
                  {DASHBOARD_DATA.recentOrders
                    .filter(o => orderStatusFilter === 'ALL' || o.status === orderStatusFilter)
                    .map((ord) => (
                      <tr key={ord.id} className="hover:bg-[#e9edf2]/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-[#0e131a]">{ord.id}</td>
                        <td className="py-3.5 px-4 text-[#8b94a3]">{ord.date}</td>
                        <td className="py-3.5 px-4 font-sans font-semibold text-[#0e131a]">{ord.service}</td>
                        <td className="py-3.5 px-4 text-[#8b94a3] max-w-[180px] truncate">{ord.link}</td>
                        <td className="py-3.5 px-4 font-sans">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            ord.status === 'COMPLETED'
                              ? 'bg-[#e6f7f0] text-[#1f9d6b] border-[#1f9d6b]/20'
                              : ord.status === 'IN_PROGRESS'
                              ? 'bg-[#e7f2fe] text-[#1f9bf0] border-[#1f9bf0]/20'
                              : 'bg-[#fdeeee] text-[#d6453d] border-[#d6453d]/20'
                          }`}>
                            {ord.statusText}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-[#0e131a]">{ord.amount}</td>
                        <td className="py-3.5 px-4 text-center font-sans">
                          <button 
                            onClick={() => setSelectedOrderDetails(ord)}
                            className="text-[#1f9bf0] font-bold hover:underline"
                          >
                            Детали
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PAGE: TRANSACTIONS & REFUNDS LEDGER ── */}
        {activeTab === 'transactions' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e2e8f0] pb-4 gap-4">
              <div>
                <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#0e131a]">
                  Движение средств и Возвраты
                </h1>
                <p className="text-xs text-[#8b94a3]">Полный финансовый аудит списаний, пополнений и автоматических возвратов</p>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#e6f7f0] border border-[#1f9d6b]/20 text-[#1f9d6b] text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Авто-возврат при отмене 100%</span>
              </div>
            </div>

            {/* Financial Summary Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[#e9edf2] rounded-xl border border-[#e2e8f0] space-y-1">
                <span className="text-[11px] font-bold text-[#8b94a3] uppercase block">Текущий баланс</span>
                <span className="font-mono-data text-2xl font-extrabold text-[#0e131a]">{DASHBOARD_DATA.balance}</span>
              </div>

              <div className="p-4 bg-[#e6f7f0]/60 rounded-xl border border-[#1f9d6b]/30 space-y-1">
                <span className="text-[11px] font-bold text-[#1f9d6b] uppercase block">Всего пополнено (+)</span>
                <span className="font-mono-data text-2xl font-extrabold text-[#1f9d6b]">{DASHBOARD_DATA.transactionsSummary.totalCredited}</span>
              </div>

              <div className="p-4 bg-[#e7f2fe]/80 rounded-xl border border-[#1f9bf0]/30 space-y-1">
                <span className="text-[11px] font-bold text-[#1f9bf0] uppercase block">Возвращено за отмены (🔄)</span>
                <span className="font-mono-data text-2xl font-extrabold text-[#1f9bf0]">+{DASHBOARD_DATA.transactionsSummary.totalRefunded}</span>
              </div>

              <div className="p-4 bg-[#e9edf2] rounded-xl border border-[#e2e8f0] space-y-1">
                <span className="text-[11px] font-bold text-[#8b94a3] uppercase block">Списано за заказы (-)</span>
                <span className="font-mono-data text-2xl font-extrabold text-[#0e131a]">{DASHBOARD_DATA.transactionsSummary.totalDebited}</span>
              </div>
            </div>

            {/* Trust Assurance Banner */}
            <div className="p-4 rounded-xl bg-[#e7f2fe] border border-[#1f9bf0]/20 flex items-start gap-3 text-xs text-[#0e131a]">
              <ShieldCheck className="w-5 h-5 text-[#1f9bf0] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block">100% защита от потерянных средств</span>
                <p className="text-[#414a59]">
                  Если заказ отменяется или выполняется частично, неотработанная сумма <b>мгновенно возвращается</b> на ваш баланс без комиссий. Ни одна копейка не пропадает.
                </p>
              </div>
            </div>

            {/* Ledger Transactions Table */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#e2e8f0] text-[11px] font-bold text-[#8b94a3] uppercase">
                    <th className="py-3 px-4">ID транзакции</th>
                    <th className="py-3 px-4">Дата / Время</th>
                    <th className="py-3 px-4">Назначение платежа</th>
                    <th className="py-3 px-4">Тип</th>
                    <th className="py-3 px-4 text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] text-xs font-mono-data">
                  {DASHBOARD_DATA.transactions.map((tx) => {
                    const isCredit = tx.type === 'CREDIT';
                    const isRefund = tx.category === 'REFUND';
                    return (
                      <tr key={tx.id} className="hover:bg-[#e9edf2]/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-[#0e131a]">{tx.id}</td>
                        <td className="py-3.5 px-4 text-[#8b94a3]">{tx.date}</td>
                        <td className="py-3.5 px-4 font-sans font-semibold text-[#0e131a]">
                          {tx.title}
                          {tx.orderId && (
                            <span className="ml-2 font-mono text-[11px] text-[#1f9bf0] underline cursor-pointer">
                              [Заказ {tx.orderId}]
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-sans">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isRefund 
                              ? 'bg-[#e7f2fe] text-[#1f9bf0] border border-[#1f9bf0]/20'
                              : isCredit 
                              ? 'bg-[#e6f7f0] text-[#1f9d6b] border border-[#1f9d6b]/20'
                              : 'bg-[#e9edf2] text-[#414a59]'
                          }`}>
                            {isRefund ? '🔄 Возврат средств' : isCredit ? '💳 Пополнение' : '📦 Списание'}
                          </span>
                        </td>
                        <td className={`py-3.5 px-4 text-right font-extrabold text-sm ${
                          isCredit ? (isRefund ? 'text-[#1f9bf0]' : 'text-[#1f9d6b]') : 'text-[#0e131a]'
                        }`}>
                          {tx.amount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PAGE 4: DEPOSIT / ADD FUNDS ── */}
        {activeTab === 'deposit' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] space-y-6">
            <div className="border-b border-[#e2e8f0] pb-4">
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#0e131a]">
                Пополнение баланса
              </h1>
              <p className="text-xs text-[#8b94a3]">Выберите способ оплаты. Зачисление происходят автоматически в течение 1 минуты</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Payment Form */}
              <div className="md:col-span-7 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#8b94a3] block">
                    1. Выберите платёжную систему
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'yookassa', name: 'ЮKassa (Карты РФ, СБП)', badge: '0% КОМИССИЯ' },
                      { id: 'robokassa', name: 'Robokassa (Карты мира)', badge: 'БЫСТРО' },
                      { id: 'cryptobot', name: 'CryptoBot (USDT / TON / BTC)', badge: 'КРИПТА' },
                      { id: 'sbp', name: 'СБП (Система быстрых платежей)', badge: 'ПОПУЛЯРНО' },
                    ].map((gw) => (
                      <button
                        key={gw.id}
                        onClick={() => setPaymentGateway(gw.id)}
                        className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all ${
                          paymentGateway === gw.id
                            ? 'border-[#1f9bf0] bg-[#e7f2fe] ring-2 ring-[#1f9bf0]/20'
                            : 'border-[#e2e8f0] bg-white hover:border-[#d3dce8]'
                        }`}
                      >
                        <span className="text-xs font-bold text-[#0e131a]">{gw.name}</span>
                        <span className="text-[10px] font-extrabold text-[#1f9bf0] bg-white px-2 py-0.5 rounded w-max border border-[#1f9bf0]/20">
                          {gw.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#414a59] block">Сумма пополнения (в рублях)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="flex-1 bg-white border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-bold text-[#0e131a] font-mono-data"
                    />
                    <button 
                      type="button"
                      disabled={isPaying}
                      onClick={() => handleExecutePayment(
                        appliedPromo ? Math.round(parseInt(depositAmount || '0') * 1.1) : (parseInt(depositAmount || '0') || 100),
                        'Пополнение баланса'
                      )}
                      className="bg-[#1f9bf0] hover:bg-[#0b7fd4] text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                    >
                      {isPaying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Переход в ЮKassa...</span>
                        </>
                      ) : (
                        <span>Оплатить {appliedPromo ? (parseInt(depositAmount || '0') * 1.1).toFixed(0) : depositAmount} ₽</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* PromoCode & Voucher Input (R4) */}
                <div className="space-y-2 pt-4 border-t border-[#e2e8f0]">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#8b94a3] block">
                    Активация промокода или ваучера
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Введите промокод (например: PROMO2026)..."
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                      className="flex-1 bg-white border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-xs font-mono-data uppercase text-[#0e131a]"
                    />
                    <button
                      onClick={() => {
                        if (promoCodeInput.trim()) {
                          setAppliedPromo({
                            code: promoCodeInput.trim(),
                            bonusText: '+10% бонус к пополнению применён!'
                          });
                        }
                      }}
                      className="bg-[#0e131a] hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all"
                    >
                      Применить
                    </button>
                  </div>

                  {appliedPromo && (
                    <div className="p-3 bg-[#e6f7f0] border border-[#1f9d6b]/20 rounded-xl text-xs text-[#1f9d6b] font-bold flex items-center justify-between">
                      <span>✓ Промокод {appliedPromo.code}: {appliedPromo.bonusText}</span>
                      <button onClick={() => setAppliedPromo(null)} className="text-[#8b94a3] hover:text-black">✕</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Bonus Info */}
              <div className="md:col-span-5 bg-[#e9edf2]/60 p-6 rounded-2xl border border-[#e2e8f0] space-y-4">
                <h3 className="font-heading text-sm font-bold text-[#0e131a]">Бонусы при пополнении</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2.5 bg-white rounded-xl border border-[#e2e8f0]">
                    <span>От 3 000 ₽</span>
                    <span className="font-bold text-[#1f9d6b]">+3% на баланс</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-white rounded-xl border border-[#e2e8f0]">
                    <span>От 5 000 ₽</span>
                    <span className="font-bold text-[#1f9d6b]">+5% на баланс</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-white rounded-xl border border-[#e2e8f0]">
                    <span>От 10 000 ₽</span>
                    <span className="font-bold text-[#1f9d6b]">+10% на баланс</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PAGE 5: REFERRALS ── */}
        {activeTab === 'referrals' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] space-y-6">
            <div className="border-b border-[#e2e8f0] pb-4 flex items-center justify-between">
              <div>
                <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#0e131a]">
                  Партнёрская программа (10%)
                </h1>
                <p className="text-xs text-[#8b94a3]">Получайте постоянные пожизненные отчисления с заказов приглашённых друзей</p>
              </div>
              <span className="font-mono-data text-sm font-bold text-[#1f9d6b] bg-[#e6f7f0] px-3 py-1 rounded-full">
                Заработано: {DASHBOARD_DATA.refBalance}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-[#e9edf2] rounded-xl border border-[#e2e8f0] space-y-1">
                <span className="text-[#8b94a3] block font-semibold">Переходов по ссылке</span>
                <span className="font-mono-data text-2xl font-bold text-[#0e131a]">34</span>
              </div>
              <div className="p-4 bg-[#e9edf2] rounded-xl border border-[#e2e8f0] space-y-1">
                <span className="text-[#8b94a3] block font-semibold">Регистраций</span>
                <span className="font-mono-data text-2xl font-bold text-[#0e131a]">12</span>
              </div>
              <div className="p-4 bg-[#e9edf2] rounded-xl border border-[#e2e8f0] space-y-1">
                <span className="text-[#8b94a3] block font-semibold">Начислено выплат</span>
                <span className="font-mono-data text-2xl font-bold text-[#1f9d6b]">{DASHBOARD_DATA.refBalance}</span>
              </div>
            </div>

            <div className="bg-[#e9edf2]/60 p-6 rounded-2xl border border-[#e2e8f0] space-y-3">
              <label className="text-xs font-bold text-[#414a59] block">Ваша реферальная ссылка</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`https://smmplan.ru/ref/${DASHBOARD_DATA.refCode}`}
                  className="flex-1 bg-white border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-xs font-mono-data text-[#0e131a]"
                />
                <button
                  onClick={handleCopyRef}
                  className="bg-[#1f9bf0] text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-[#0b7fd4]"
                >
                  {isCopied ? 'Скопировано!' : 'Копировать'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PAGE 6: TELEGRAM STYLE SUPPORT CHAT ── */}
        {activeTab === 'support' && (
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] overflow-hidden flex flex-col h-[700px] max-h-[85vh]">
            
            {/* Telegram Header */}
            <div className="bg-white border-b border-[#e2e8f0] px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-[#1f9bf0] text-white font-black text-sm flex items-center justify-center shadow-sm">
                    АА
                  </div>
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#1f9d6b] border-2 border-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-base font-bold text-[#0e131a]">
                      Александр (Служба поддержки)
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-[#e6f7f0] text-[#1f9d6b] text-[10px] font-extrabold uppercase">
                      В сети
                    </span>
                  </div>
                  <p className="text-xs text-[#8b94a3] flex items-center gap-1.5">
                    <span>отвечает в среднем за 2–3 минуты</span>
                    <span>•</span>
                    <span>{DASHBOARD_DATA.supportHours}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="https://t.me/smmplan_support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#e7f2fe] text-[#1f9bf0] text-xs font-bold hover:bg-[#d5e7fd] transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>Открыть в Telegram ↗</span>
                </a>
              </div>
            </div>

            {/* Telegram Wallpaper Message Feed */}
            <div className="flex-1 bg-[#f4f6f9] p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-4">
              
              {/* Central Date Badge */}
              <div className="flex justify-center">
                <span className="bg-[#0e131a]/10 backdrop-blur-md text-[#414a59] text-[11px] font-bold px-3 py-1 rounded-full">
                  Сегодня, 26 июля
                </span>
              </div>

              {/* Pinned Active Order Context */}
              <div className="bg-white/90 border border-[#e2e8f0] p-3 rounded-xl max-w-md mx-auto flex items-center justify-between text-xs shadow-sm">
                <div className="flex items-center gap-2 font-mono-data">
                  <span className="w-2 h-2 rounded-full bg-[#1f9bf0] animate-pulse" />
                  <span className="font-bold text-[#0e131a]">Прикреплённый заказ:</span>
                  <span className="text-[#1f9bf0] font-bold">#381920</span>
                </div>
                <span className="text-[11px] text-[#8b94a3] font-semibold">TG Подписчики</span>
              </div>

              {/* Messages list */}
              {chatMessages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-[#1f9bf0] text-white font-bold text-xs flex items-center justify-center shrink-0">
                        АА
                      </div>
                    )}
                    
                    <div
                      className={`relative p-3.5 rounded-2xl max-w-[85%] sm:max-w-[70%] space-y-1 shadow-sm text-xs ${
                        isUser
                          ? 'bg-[#1f9bf0] text-white rounded-br-none'
                          : 'bg-white text-[#0e131a] border border-[#e2e8f0] rounded-bl-none'
                      }`}
                    >
                      {!isUser && (
                        <span className="text-[11px] font-bold text-[#1f9bf0] block">
                          {msg.operatorName}
                        </span>
                      )}
                      <p className="leading-relaxed font-sans font-medium whitespace-pre-wrap">{msg.text}</p>
                      
                      <div className={`flex items-center justify-end gap-1 text-[10px] ${
                        isUser ? 'text-white/80' : 'text-[#8b94a3]'
                      }`}>
                        <span className="font-mono-data">{msg.time}</span>
                        {isUser && <span>✓✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Operator Typing Indicator */}
              {isOperatorTyping && (
                <div className="flex items-center gap-2 text-xs text-[#8b94a3] font-semibold">
                  <div className="w-7 h-7 rounded-full bg-[#1f9bf0] text-white font-bold text-[10px] flex items-center justify-center">
                    АА
                  </div>
                  <span className="animate-pulse">Александр печатает...</span>
                </div>
              )}
            </div>

            {/* Telegram Quick Prompt Chips */}
            <div className="bg-[#f4f6f9] px-4 py-2 border-t border-[#e2e8f0] flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
              <span className="text-[10px] font-bold text-[#8b94a3] shrink-0 uppercase">Частые вопросы:</span>
              {[
                '📦 Где мой заказ #381920?',
                '🔄 Запросить докрутку',
                '💳 Не пришло пополнение',
                '⚡ Какая скорость выполнения?'
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendChatMessage(chip)}
                  className="bg-white hover:bg-[#e7f2fe] hover:text-[#1f9bf0] text-[#414a59] text-xs font-semibold px-3 py-1.5 rounded-full border border-[#e2e8f0] shrink-0 transition-colors shadow-xs"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Telegram Input Bar */}
            <div className="bg-white border-t border-[#e2e8f0] p-3 sm:p-4 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChatMessage();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  title="Прикрепить номер заказа"
                  onClick={() => setChatInput(prev => `${prev} [Заказ #381920]`)}
                  className="p-2 text-[#8b94a3] hover:text-[#1f9bf0] hover:bg-[#e7f2fe] rounded-xl transition-colors shrink-0"
                >
                  📎
                </button>

                <input
                  type="text"
                  placeholder="Напишите сообщение поддержке (Enter для отправки)..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-[#e9edf2] border border-transparent focus:border-[#1f9bf0] focus:bg-white rounded-xl px-4 py-3 text-xs text-[#0e131a] outline-none transition-all"
                />

                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="w-10 h-10 rounded-xl bg-[#1f9bf0] hover:bg-[#0b7fd4] disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-sm shrink-0 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>
        )}

        {/* ── PAGE 7: SETTINGS ── */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] space-y-6">
            <div className="border-b border-[#e2e8f0] pb-4">
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#0e131a]">
                Настройки аккаунта
              </h1>
              <p className="text-xs text-[#8b94a3]">Управление профилем, безопасностью и ключами доступа</p>
            </div>

            <div className="space-y-6 max-w-2xl text-xs">
              <div className="space-y-3">
                <h3 className="font-heading text-base font-bold text-[#0e131a]">Личная информация</h3>
                <div>
                  <label className="block text-[#414a59] font-bold mb-1">Email адрес</label>
                  <input
                    type="email"
                    readOnly
                    value="client@smmplan.ru"
                    className="w-full bg-[#e9edf2] border border-[#e2e8f0] rounded-xl px-4 py-2.5 font-mono-data text-[#0e131a]"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#e2e8f0]">
                <h3 className="font-heading text-base font-bold text-[#0e131a]">Смена пароля</h3>
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="Текущий пароль"
                    className="w-full bg-white border border-[#e2e8f0] rounded-xl px-4 py-2.5"
                  />
                  <input
                    type="password"
                    placeholder="Новый пароль (мин. 12 символов)"
                    className="w-full bg-white border border-[#e2e8f0] rounded-xl px-4 py-2.5"
                  />
                </div>
                <button className="bg-[#0e131a] text-white px-5 py-2 rounded-xl font-bold text-xs hover:bg-slate-800">
                  Сохранить новый пароль
                </button>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#e2e8f0]">
                <h3 className="font-heading text-base font-bold text-[#0e131a]">API Ключ для разработчиков</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value="smmplan_api_9f81a7b6c5d4e3f2a1b0"
                    className="flex-1 bg-[#e9edf2] border border-[#e2e8f0] rounded-xl px-4 py-2.5 font-mono-data"
                  />
                  <button className="bg-[#1f9bf0] text-white px-4 py-2.5 rounded-xl font-bold">
                    Обновить ключ
                  </button>
                </div>
              </div>

              {/* 152-FZ Legal Compliance Card (R3) */}
              <div className="space-y-3 pt-4 border-t border-[#e2e8f0]">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base font-bold text-[#0e131a]">Согласия и Оферта (152-ФЗ)</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#e6f7f0] text-[#1f9d6b] text-[10px] font-extrabold uppercase">
                    Подтверждено
                  </span>
                </div>
                <div className="bg-[#e9edf2]/60 p-4 rounded-xl border border-[#e2e8f0] space-y-1.5 text-xs text-[#414a59]">
                  <div className="flex justify-between">
                    <span>Дата принятия Условий оферты:</span>
                    <span className="font-mono-data font-bold text-[#0e131a]">24 июля 2026, 14:22 МСК</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IP-адрес фиксации согласия:</span>
                    <span className="font-mono-data font-bold text-[#0e131a]">185.220.101.4</span>
                  </div>
                  <p className="text-[11px] text-[#8b94a3] pt-1">
                    Согласие зафиксировано в соответствии с требованиями 152-ФЗ «О персональных данных».
                  </p>
                </div>
              </div>

              {/* API Legal Requisites (R3) */}
              <div className="space-y-3 pt-4 border-t border-[#e2e8f0]">
                <h3 className="font-heading text-base font-bold text-[#0e131a]">Бухгалтерские реквизиты (Юрлицам)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#414a59] font-bold mb-1">Название компании</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full bg-white border border-[#e2e8f0] rounded-xl px-3.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[#414a59] font-bold mb-1">ИНН</label>
                    <input
                      type="text"
                      value={inn}
                      onChange={(e) => setInn(e.target.value)}
                      className="w-full bg-white border border-[#e2e8f0] rounded-xl px-3.5 py-2 text-xs font-mono-data"
                    />
                  </div>
                  <div>
                    <label className="block text-[#414a59] font-bold mb-1">КПП</label>
                    <input
                      type="text"
                      value={kpp}
                      onChange={(e) => setKpp(e.target.value)}
                      className="w-full bg-white border border-[#e2e8f0] rounded-xl px-3.5 py-2 text-xs font-mono-data"
                    />
                  </div>
                  <div>
                    <label className="block text-[#414a59] font-bold mb-1">Юридический адрес</label>
                    <input
                      type="text"
                      value={legalAddress}
                      onChange={(e) => setLegalAddress(e.target.value)}
                      className="w-full bg-white border border-[#e2e8f0] rounded-xl px-3.5 py-2 text-xs"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setIsRequisitesSaved(true)}
                  className="bg-[#0e131a] text-white px-5 py-2 rounded-xl font-bold text-xs hover:bg-slate-800"
                >
                  {isRequisitesSaved ? '✓ Реквизиты сохранены' : 'Сохранить реквизиты'}
                </button>
              </div>

              {/* API Webhook Integration (R3) */}
              <div className="space-y-3 pt-4 border-t border-[#e2e8f0]">
                <h3 className="font-heading text-base font-bold text-[#0e131a]">API Вебхуки для разработчиков</h3>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[#414a59] font-bold mb-1">Webhook URL</label>
                    <input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="w-full bg-white border border-[#e2e8f0] rounded-xl px-3.5 py-2 text-xs font-mono-data text-[#0e131a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#414a59] font-bold mb-1">Webhook Secret (HMAC SHA-256)</label>
                    <input
                      type="text"
                      readOnly
                      value={webhookSecret}
                      className="w-full bg-[#e9edf2] border border-[#e2e8f0] rounded-xl px-3.5 py-2 text-xs font-mono-data text-[#0e131a]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
