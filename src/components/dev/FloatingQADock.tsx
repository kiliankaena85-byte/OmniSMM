'use client';

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sliders, 
  X, 
  Building2, 
  Sparkles, 
  User, 
  ShieldCheck, 
  LogOut, 
  RotateCcw, 
  QrCode,
  Bug,
  Zap,
  KeyRound,
  CheckCircle2,
  Loader2,
  Headphones,
  Briefcase,
  Wallet
} from "lucide-react";
import { toast } from "sonner";
import { BugReportModal } from "./BugReportModal";
import { normalizeTenantId } from "@/config/tenants";
import { qaDirectLoginAction, QARole } from "@/actions/qa-auth";

export function FloatingQADock() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [currentTenant, setCurrentTenant] = useState<string>("smmplan");
  const [showQR, setShowQR] = useState(false);
  const [showBugReportModal, setShowBugReportModal] = useState(false);

  // Состояние защищенного QA ключа
  const [showKeyInputModal, setShowKeyInputModal] = useState(false);
  const [pendingRole, setPendingRole] = useState<QARole | null>(null);
  const [enteredSecret, setEnteredSecret] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Чтение параметров активации из URL
    const urlParams = new URLSearchParams(window.location.search);
    const secretParam = urlParams.get('smm_qa_key') || urlParams.get('tester_pass');
    const hasSecretParam = !!secretParam;
    const hasStaffCookie = document.cookie.includes('x_staff=1') || document.cookie.includes('smm_qa_dock=1');
    const isLocalDev = process.env.NODE_ENV === 'development' && !window.location.hostname.includes('test.') && !window.location.hostname.includes('smmplan.pro');

    if (secretParam && secretParam.length > 3) {
      sessionStorage.setItem('smm_qa_key', secretParam);
    }

    if (hasSecretParam) {
      document.cookie = 'smm_qa_dock=1; path=/; max-age=86400; SameSite=Lax; Secure';
    }

    if (hasStaffCookie || hasSecretParam || (isLocalDev && process.env.NEXT_PUBLIC_ENABLE_QA_DOCK === 'true')) {
      setIsEnabled(true);
    } else {
      setIsEnabled(false);
    }

    // Определение текущего тенанта
    const match = document.cookie.match(/x_tenant=([^;]+)/);
    const bodyTenant = document.body.getAttribute("data-tenant");
    const rawTenant = (match && match[1]) || bodyTenant || 'smmplan';
    setCurrentTenant(normalizeTenantId(rawTenant));

    // Слушатель горячих клавиш Ctrl+Shift+B для быстрого баг-репорта
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "B" || e.key === "b")) {
        e.preventDefault();
        setShowBugReportModal(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isClient || !isEnabled) return null;

  const handleSwitchTenant = (tenant: "smmplan" | "flux") => {
    document.cookie = `x_tenant=${tenant}; path=/; max-age=2592000; SameSite=Lax`;
    toast.success(`Переключение бренда на ${tenant === "smmplan" ? "SMMplan (API)" : "SMMflux (Aurora)"}...`);
    setTimeout(() => {
      window.location.href = `${window.location.pathname}?tenant=${tenant}`;
    }, 300);
  };

  const executeLogin = async (role: QARole, secretKey: string) => {
    setIsAuthenticating(true);
    try {
      const res = await qaDirectLoginAction({
        role,
        secretKey,
        tenantId: currentTenant,
      });

      if (res.success && res.redirectUrl) {
        sessionStorage.setItem('smm_qa_key', secretKey);
        toast.success(
          role === "owner" || role === "admin" 
            ? "Успешный вход: Владелец платформы (полный доступ)" 
            : role === "manager"
            ? "Успешный вход: Менеджер платформы (каталог, заказы, тикеты)"
            : role === "support"
            ? "Успешный вход: Саппорт / Оператор (тикеты, докрутки)"
            : role === "cashier"
            ? "Успешный вход: Кассир (балансовые заявки)"
            : "Успешный вход: Клиент (личный кабинет)"
        );
        setShowKeyInputModal(false);
        setTimeout(() => {
          window.location.href = res.redirectUrl!;
        }, 300);
      } else {
        toast.error(res.error || "Не удалось войти. Проверьте ключ QA.");
        sessionStorage.removeItem('smm_qa_key');
      }
    } catch (err: unknown) {
      toast.error("Ошибка при авторизации QA: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleQuickAuth = async (role: QARole | "guest") => {
    if (role === "guest") {
      document.cookie = "session_token=; path=/; max-age=0; SameSite=Lax; Secure; HttpOnly";
      document.cookie = "auth_token=; path=/; max-age=0; SameSite=Lax; Secure";
      document.cookie = "explicit_logout=true; path=/; max-age=31536000; SameSite=Lax; Secure; HttpOnly";
      toast.info("Вы вышли из учетной записи");
      setTimeout(() => {
        const isProtectedPath = window.location.pathname.startsWith('/admin') || 
                                window.location.pathname.startsWith('/dashboard') || 
                                window.location.pathname.startsWith('/operator');
        window.location.href = isProtectedPath ? '/login' : window.location.pathname;
      }, 300);
      return;
    }

    const savedKey = sessionStorage.getItem('smm_qa_key');
    if (savedKey) {
      await executeLogin(role, savedKey);
    } else {
      setPendingRole(role);
      setShowKeyInputModal(true);
    }
  };

  const handleClearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    toast.info("Кэш и локальные хранилища очищены. Перезагрузка...");
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(window.location.href)}`;

  return (
    <div className="fixed bottom-5 left-5 z-[999999] font-sans antialiased pointer-events-auto">
      {/* Свернутая плавающая кнопка */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-zinc-900/90 hover:bg-zinc-900 text-white border border-zinc-700/80 shadow-2xl backdrop-blur-xl flex items-center gap-2.5 transition-all cursor-pointer group"
          title="Открыть пульт управления тестировщика"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <Sliders className="w-4 h-4 text-zinc-300 group-hover:text-white transition-colors" />
          <span className="text-xs font-bold tracking-tight">QA Dock</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wider ${
            currentTenant === "smmplan" 
              ? "bg-blue-600/30 text-blue-400 border border-blue-500/30" 
              : "bg-purple-600/30 text-purple-300 border border-purple-500/30"
          }`}>
            {currentTenant === "smmplan" ? "SMMplan" : "SMMflux"}
          </span>
        </motion.button>
      )}

      {/* Развернутая панель управления */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[340px] sm:w-[400px] max-h-[85vh] overflow-y-auto bg-zinc-950/95 text-zinc-100 border border-zinc-800/90 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl flex flex-col gap-4 text-xs select-none custom-scrollbar"
          >
            {/* Хедер панели */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-extrabold text-sm text-white flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  QA Control Center
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Блок 1: Переключение Бренда (Тенанта) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                <span>1. Активный Бренд (Тенант)</span>
                <span className="text-[10px] text-zinc-500">Cookie: x_tenant</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSwitchTenant("smmplan")}
                  className={`min-h-[44px] p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${
                    currentTenant === "smmplan"
                      ? "bg-blue-600/20 border-blue-500 text-blue-300 shadow-[0_0_15px_rgba(37,99,235,0.25)]"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-white"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>SMMplan</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchTenant("flux")}
                  className={`min-h-[44px] p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${
                    currentTenant === "flux"
                      ? "bg-purple-600/20 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.25)]"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>SMMflux (Aurora)</span>
                </button>
              </div>
            </div>

            {/* Блок 2: Быстрая авторизация и роли (RBAC) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                <span>2. Тестирование Ролей (RBAC 1-Click)</span>
                {sessionStorage.getItem('smm_qa_key') && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    Ключ активен
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {/* 1. Гость */}
                <button
                  type="button"
                  disabled={isAuthenticating}
                  onClick={() => handleQuickAuth("guest")}
                  className="min-h-[44px] px-2 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white font-medium flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer"
                  title="Анонимный посетитель без сессии"
                >
                  <LogOut className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-[10px]">Гость</span>
                </button>

                {/* 2. Клиент */}
                <button
                  type="button"
                  disabled={isAuthenticating}
                  onClick={() => handleQuickAuth("client")}
                  className="min-h-[44px] px-2 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white font-medium flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer"
                  title="Обычный покупатель (Личный кабинет /dashboard)"
                >
                  {isAuthenticating && pendingRole === "client" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-300" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <span className="text-[10px]">Клиент</span>
                </button>

                {/* 3. Владелец (Owner) */}
                <button
                  type="button"
                  disabled={isAuthenticating}
                  onClick={() => handleQuickAuth("owner")}
                  className="min-h-[44px] px-2 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer relative overflow-hidden"
                  title="Владелец / Super Admin — полный доступ к /admin"
                >
                  {isAuthenticating && (pendingRole === "owner" || pendingRole === "admin") ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span className="text-[10px]">Владелец</span>
                </button>

                {/* 4. Менеджер */}
                <button
                  type="button"
                  disabled={isAuthenticating}
                  onClick={() => handleQuickAuth("manager")}
                  className="min-h-[44px] px-2 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/40 text-blue-300 font-semibold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer"
                  title="Менеджер (Каталог, Заказы, Тикеты, Контент. БЕЗ финансов)"
                >
                  {isAuthenticating && pendingRole === "manager" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  ) : (
                    <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span className="text-[10px]">Менеджер</span>
                </button>

                {/* 5. Саппорт */}
                <button
                  type="button"
                  disabled={isAuthenticating}
                  onClick={() => handleQuickAuth("support")}
                  className="min-h-[44px] px-2 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer"
                  title="Саппорт / Оператор (Тикеты, Заказы просмотр, Докрутки)"
                >
                  {isAuthenticating && pendingRole === "support" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span className="text-[10px]">Саппорт</span>
                </button>

                {/* 6. Кассир */}
                <button
                  type="button"
                  disabled={isAuthenticating}
                  onClick={() => handleQuickAuth("cashier")}
                  className="min-h-[44px] px-2 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/40 text-purple-300 font-semibold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer"
                  title="Кассир (Согласование балансовых заявок)"
                >
                  {isAuthenticating && pendingRole === "cashier" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  ) : (
                    <Wallet className="w-3.5 h-3.5 text-purple-400" />
                  )}
                  <span className="text-[10px]">Кассир</span>
                </button>
              </div>
            </div>

            {/* Блок 3: Быстрый Баг-Репорт */}
            <div className="pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => {
                  setShowBugReportModal(true);
                  setIsOpen(false);
                }}
                className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-gradient-to-r from-red-600/90 to-rose-600/90 hover:from-red-500 hover:to-rose-500 text-white font-bold flex items-center justify-between transition-all cursor-pointer shadow-lg shadow-red-600/20 active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-black/25 flex items-center justify-center">
                    <Bug className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs">Сообщить о баге</span>
                </div>
                <span className="text-[10px] font-mono opacity-85 bg-black/25 px-1.5 py-0.5 rounded text-white">Ctrl+Shift+B</span>
              </button>
            </div>

            {/* Блок 4: Мобильный QR-код и Сброс */}
            <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 gap-2">
              <button
                type="button"
                onClick={() => setShowQR(!showQR)}
                className="min-h-[36px] flex-1 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs"
              >
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>{showQR ? "Скрыть QR" : "📱 QR для смартфона"}</span>
              </button>

              <button
                type="button"
                onClick={handleClearCache}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs"
                title="Очистить localStorage и кэш"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Сброс</span>
              </button>
            </div>

            {/* Показ QR-кода */}
            {showQR && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center gap-2"
              >
                <p className="text-[11px] text-zinc-300 font-semibold text-center">
                  Наведите камеру смартфона для мгновенного перехода:
                </p>
                <img 
                  src={qrImageUrl} 
                  alt="QR для мобильного тестирования" 
                  className="w-44 h-44 rounded-xl border border-zinc-700 bg-white p-1" 
                />
                <p className="text-[10px] text-zinc-500 truncate max-w-full text-center">
                  {window.location.href}
                </p>
              </motion.div>
            )}

            {/* Инфо футер */}
            <div className="pt-2 text-[10px] text-zinc-500 flex items-center justify-between border-t border-zinc-900">
              <span>Cloudflare Tunnel: Healthy 🟢</span>
              <span className="font-mono">test.smmplan.pro</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Всплывающее окно ввода QA ключа (1 раз за сессию) */}
      <AnimatePresence>
        {showKeyInputModal && (
          <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-zinc-100"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Вход Тестировщика</h3>
                    <p className="text-[11px] text-zinc-400 capitalize">
                      Роль: {pendingRole || 'admin'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowKeyInputModal(false)}
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-semibold text-zinc-300">
                  Секретный ключ QA доступа:
                </label>
                <input
                  type="password"
                  value={enteredSecret}
                  onChange={(e) => setEnteredSecret(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && enteredSecret.trim() && pendingRole) {
                      executeLogin(pendingRole, enteredSecret.trim());
                    }
                  }}
                  placeholder="Введите ключ QA доступа..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-white text-xs font-mono transition-all"
                  autoFocus
                />
                <p className="text-[10px] text-zinc-500">
                  Ключ сохранится во вкладке браузера до закрытия.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKeyInputModal(false)}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-semibold text-xs transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={!enteredSecret.trim() || isAuthenticating}
                  onClick={() => {
                    if (pendingRole && enteredSecret.trim()) {
                      executeLogin(pendingRole, enteredSecret.trim());
                    }
                  }}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {isAuthenticating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  ) : (
                    "Подтвердить вход"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Быстрый Баг-Репорт Модальное Окно */}
      <BugReportModal
        isOpen={showBugReportModal}
        onClose={() => setShowBugReportModal(false)}
        currentTenant={currentTenant}
        checkoutMode="wizard"
      />
    </div>
  );
}
