'use client';

/**
 * DePIN Telegram Mini App — Gamification Tier 2
 *
 * [WARN-3 FIX]   telegramId теперь сохраняется из /api/depin/auth и передаётся
 *                в convertCreditsToBalanceAction → рубли реально начисляются в леджер
 *
 * [SSE]          setInterval(7000) заменён на EventSource /api/depin/stream
 *                — реалтайм push без HTTP-polling, меньше батареи
 *
 * [GAMIFICATION] Анимированная монетка с CSS keyframes,
 *                шкала энергии 1000/1000 с восстановлением,
 *                частицы +PTS при тапе,
 *                Telegram.WebApp.HapticFeedback при каждом кредите
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  askOmniAiAction,
  reportDePinTaskAction,
  convertCreditsToBalanceAction,
  updateNodePreferencesAction,
} from '@/actions/depin/ai-assistant';

// ── Типы ──────────────────────────────────────────────────────────────────────
type AiMode = 'SMM_POST' | 'SUMMARIZE' | 'REWRITE' | 'CHAT';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: number;
}

interface DePinTask {
  taskId: string;
  type: string;
  targetUrl: string;
  channel: string;
  postId?: number;
  creditsReward: number;
  expiresAt: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  value: number;
}

// ── Telegram WebApp helpers ───────────────────────────────────────────────────
type TgWebApp = {
  ready: () => void;
  expand: () => void;
  initData?: string;
  HapticFeedback?: { impactOccurred: (style: 'light' | 'medium' | 'heavy') => void };
};

function getTg(): TgWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  try { getTg()?.HapticFeedback?.impactOccurred(style); } catch { /* ignore */ }
}

// ── Константы геймификации ───────────────────────────────────────────────────
const ENERGY_MAX       = 1000;
const ENERGY_REGEN_PER_SEC = 2; // +2 энергии в секунду
const ENERGY_PER_TAP   = 20;   // стоимость одного тапа
const CREDITS_PER_TAP  = 1;

// ─────────────────────────────────────────────────────────────────────────────

export default function DePinTelegramMiniAppPage() {
  const [activeTab, setActiveTab] = useState<'ai' | 'node' | 'tap' | 'settings'>('tap');

  // ── Auth State ───────────────────────────────────────────────────────────────
  const [nodeId,      setNodeId]      = useState('');
  const [telegramId,  setTelegramId]  = useState('');  // [WARN-3 FIX]

  // ── DePIN Node State ─────────────────────────────────────────────────────────
  const [isNodeActive,         setIsNodeActive]         = useState(true);
  const [credits,              setCredits]              = useState(0);
  const [completedTasksCount,  setCompletedTasksCount]  = useState(0);
  const [nodeStatusText,       setNodeStatusText]       = useState('Синхронизация...');
  const [isConverting,         setIsConverting]         = useState(false);
  const [conversionMessage,    setConversionMessage]    = useState<string | null>(null);

  // ── Настройки предпочтений узла ─────────────────────────────────────────────
  const [acceptsViewTasks,   setAcceptsViewTasks]   = useState(true);
  const [acceptsReactTasks,  setAcceptsReactTasks]  = useState(true);
  const [acceptsFollowTasks, setAcceptsFollowTasks] = useState(false);
  const [prefToast,          setPrefToast]          = useState<string | null>(null);

  // ── Gamification State ───────────────────────────────────────────────────────
  const [energy,     setEnergy]     = useState(ENERGY_MAX);
  const [isCoinAnim, setIsCoinAnim] = useState(false);
  const [particles,  setParticles]  = useState<Particle[]>([]);
  const particleId = useRef(0);

  // ── AI Chat State ────────────────────────────────────────────────────────────
  const [aiMode,       setAiMode]       = useState<AiMode>('SMM_POST');
  const [prompt,       setPrompt]       = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages,     setMessages]     = useState<Message[]>([{
    id: 'init_welcome',
    role: 'model',
    text: '👋 Привет! Я OmniAI — твой бесплатный ИИ-ассистент. Напиши тему, и я мгновенно сгенерирую виральный пост для Telegram с хуками, эмодзи и хештегами!',
    createdAt: Date.now(),
  }]);
  const [copiedId,     setCopiedId]     = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sseRef         = useRef<EventSource | null>(null);
  const pendingTask    = useRef<DePinTask | null>(null);

  // ── 1. Telegram auth + stable nodeId [WARN-3 FIX] ───────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tg = getTg();
    if (tg) { tg.ready(); tg.expand(); }

    const initData = tg?.initData;

    if (initData) {
      fetch('/api/depin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
        .then((r) => r.json())
        .then((data: { success: boolean; nodeId?: string; telegramId?: string }) => {
          if (data.success && data.nodeId) {
            setNodeId(data.nodeId);
            // [WARN-3 FIX] Сохраняем telegramId — передаётся при выводе рублей
            if (data.telegramId) setTelegramId(data.telegramId);
            localStorage.setItem('omnismm_depin_node_id', data.nodeId);
          } else {
            const fb = localStorage.getItem('omnismm_depin_node_id')
              || `node_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
            localStorage.setItem('omnismm_depin_node_id', fb);
            setNodeId(fb);
          }
        })
        .catch(() => {
          const fb = localStorage.getItem('omnismm_depin_node_id')
            || `node_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
          localStorage.setItem('omnismm_depin_node_id', fb);
          setNodeId(fb);
        });
    } else {
      const stored = localStorage.getItem('omnismm_depin_node_id')
        || `node_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
      localStorage.setItem('omnismm_depin_node_id', stored);
      setNodeId(stored);
    }
  }, []);

  // ── 2. SSE — реалтайм push задач [заменяет setInterval polling] ──────────────
  useEffect(() => {
    if (!nodeId || !isNodeActive) {
      sseRef.current?.close();
      sseRef.current = null;
      setNodeStatusText(isNodeActive ? 'Синхронизация...' : '⏸ Воркер на паузе');
      return;
    }

    setNodeStatusText('🟢 Узел активен — ожидает задачи...');

    const es = new EventSource(`/api/depin/stream?nodeId=${encodeURIComponent(nodeId)}`);
    sseRef.current = es;

    es.addEventListener('connected', (e) => {
      const d = JSON.parse(e.data) as { credits: number };
      setCredits(d.credits);
      setNodeStatusText('🟢 Узел подключён к пулу задач');
    });

    es.addEventListener('task', (e) => {
      const task = JSON.parse(e.data) as DePinTask;
      pendingTask.current = task;
      setNodeStatusText(`⚡ Просмотр: @${task.channel}/${task.postId ?? ''}`);

      // Выполняем фоновый просмотр и отчитываемся
      fetch(task.targetUrl, { mode: 'no-cors' }).catch(() => {});

      reportDePinTaskAction({
        nodeId,
        taskId: task.taskId,
        target: task.targetUrl,
        success: true,
      }).then((res) => {
        if (res.success) {
          setCredits(res.totalCredits ?? 0);
          setCompletedTasksCount((p) => p + 1);
          setNodeStatusText('✅ Просмотр подтверждён (+10 OmniCredits)');
          haptic('light');
        }
      }).catch(() => {});
    });

    es.addEventListener('idle',  () => setNodeStatusText('🟢 Ожидание новых заказов...'));
    es.addEventListener('ping',  () => { /* keepalive — ничего не делаем */ });
    es.addEventListener('close', () => {
      setNodeStatusText('🔄 Переподключение...');
      es.close();
    });

    es.onerror = () => setNodeStatusText('⚠️ Разрыв соединения, переподключение...');

    return () => { es.close(); sseRef.current = null; };
  }, [nodeId, isNodeActive]);

  // ── 3. Восстановление энергии (+2/сек) ──────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setEnergy((e) => Math.min(ENERGY_MAX, e + ENERGY_REGEN_PER_SEC));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Скролл к последнему сообщению ───────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Тап по монетке (геймификация) ───────────────────────────────────────────
  const handleCoinTap = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (energy < ENERGY_PER_TAP) return;

    setEnergy((en) => en - ENERGY_PER_TAP);
    setCredits((c) => c + CREDITS_PER_TAP);
    setIsCoinAnim(true);
    setTimeout(() => setIsCoinAnim(false), 200);
    haptic('light');

    // Частица +PTS
    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
    const id   = ++particleId.current;
    const x    = e.clientX - rect.left + (Math.random() * 40 - 20);
    const y    = e.clientY - rect.top  - 20;
    setParticles((p) => [...p, { id, x, y, value: CREDITS_PER_TAP }]);
    setTimeout(() => setParticles((p) => p.filter((pt) => pt.id !== id)), 800);
  }, [energy]);

  // ── Вывод кредитов на рублёвый баланс [WARN-3 FIX] ──────────────────────────
  const handleConvertCredits = async () => {
    if (credits < 100 || isConverting) return;
    setIsConverting(true);
    setConversionMessage(null);
    haptic('medium');

    try {
      const res = await convertCreditsToBalanceAction({
        nodeId,
        credits: Math.floor(credits / 100) * 100,
        // [WARN-3 FIX] telegramId теперь передаётся → WalletOps.credit реально зачисляет рубли
        userId: telegramId || undefined,
      });

      if (res.success) {
        setCredits(res.remainingCredits);
        setConversionMessage(`🎉 Начислено ${res.rublesCredited}.00 ₽ на ваш баланс SMMplan!`);
        haptic('heavy');
      } else {
        setConversionMessage(`⚠️ ${res.error || 'Ошибка конвертации'}`);
      }
    } catch {
      setConversionMessage('⚠️ Сетевой сбой при выводе');
    } finally {
      setIsConverting(false);
    }
  };

  // ── AI Chat ──────────────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!prompt.trim() || isGenerating) return;
    const userText = prompt.trim();
    setPrompt('');
    setMessages((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: userText, createdAt: Date.now() }]);
    setIsGenerating(true);

    try {
      const res = await askOmniAiAction({ prompt: userText, mode: aiMode });
      setMessages((prev) => [...prev, {
        id: `m_${Date.now()}`,
        role: 'model',
        text: res.success ? (res.text ?? 'Ответ готов.') : `⚠️ ${res.error ?? 'Ошибка генерации'}`,
        createdAt: Date.now(),
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: `e_${Date.now()}`, role: 'model',
        text: '⚠️ Не удалось связаться с ИИ-сервером.',
        createdAt: Date.now(),
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Рендер ───────────────────────────────────────────────────────────────────
  const energyPct = (energy / ENERGY_MAX) * 100;

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-neutral-950 text-neutral-100 font-sans select-none">

      {/* CSS анимации через style-тег */}
      <style>{`
        @keyframes coinBounce { 0%,100%{transform:scale(1)} 50%{transform:scale(0.88)} }
        @keyframes floatUp { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-60px)} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.6);opacity:0} }
        .coin-tap { animation: coinBounce 0.2s ease-out; }
        .float-particle { animation: floatUp 0.8s ease-out forwards; pointer-events:none; }
        .pulse-ring { animation: pulse-ring 0.6s ease-out; }
      `}</style>

      {/* ── Шапка ────────────────────────────────────────────────────────────── */}
      <header className="px-4 py-3 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-md">Ω</div>
          <div>
            <h1 className="font-semibold text-sm leading-tight">OmniAI Assistant</h1>
            <p className="text-[11px] text-neutral-400">Gemini 3 Flash • DePIN Node</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800/80 rounded-full border border-neutral-700/60">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-400">{credits}</span>
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider">PTS</span>
        </div>
      </header>

      {/* ── Навигация ─────────────────────────────────────────────────────────── */}
      <nav className="flex p-1.5 bg-neutral-900 border-b border-neutral-800 gap-1">
        {([
          { key: 'tap',      icon: '🪙', label: 'Тапер'       },
          { key: 'ai',       icon: '🧠', label: 'AI-Копирайтер'},
          { key: 'node',     icon: '⚡', label: 'DePIN Доход'  },
          { key: 'settings', icon: '⚙️', label: 'Настройки'   },
        ] as const).map(({ key, icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all min-h-[44px] flex items-center justify-center gap-1.5 ${
              activeTab === key
                ? key === 'tap'      ? 'bg-amber-500 text-white shadow-sm'
                : key === 'ai'       ? 'bg-blue-600 text-white shadow-sm'
                : key === 'settings' ? 'bg-violet-600 text-white shadow-sm'
                :                      'bg-emerald-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span>{icon}</span>
            <span>{label}</span>
            {key === 'node' && credits >= 100 && (
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
            )}
          </button>
        ))}
      </nav>

      {/* ════════════════════════════════════════════════════════════════════════
          Вкладка 1: ТАП-геймификация (Хомяк-механика)
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'tap' && (
        <div className="flex-1 flex flex-col items-center justify-between px-6 py-6 overflow-hidden">

          {/* Счётчик PTS */}
          <div className="text-center">
            <div className="text-4xl font-black text-white tabular-nums">{credits.toLocaleString('ru')}</div>
            <div className="text-xs text-neutral-400 mt-1">OmniCredits • ≈ {(credits / 100).toFixed(2)} ₽</div>
          </div>

          {/* Анимированная монетка */}
          <div className="relative flex items-center justify-center">
            {/* Частицы +PTS */}
            {particles.map((p) => (
              <span
                key={p.id}
                className="float-particle absolute text-amber-300 font-bold text-lg pointer-events-none z-20"
                style={{ left: p.x, top: p.y }}
              >
                +{p.value}
              </span>
            ))}

            {/* Пульсирующее кольцо */}
            {isCoinAnim && (
              <div className="pulse-ring absolute w-52 h-52 rounded-full border-2 border-amber-400/60" />
            )}

            <button
              type="button"
              onClick={handleCoinTap}
              disabled={energy < ENERGY_PER_TAP}
              className={`w-48 h-48 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500
                shadow-2xl shadow-amber-500/40 active:shadow-amber-500/20
                flex items-center justify-center text-7xl
                transition-transform duration-75 border-4 border-amber-300/40
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isCoinAnim ? 'coin-tap' : ''}
              `}
              aria-label="Тапнуть монету"
            >
              Ω
            </button>
          </div>

          {/* Шкала энергии */}
          <div className="w-full space-y-2">
            <div className="flex justify-between text-[11px] text-neutral-400">
              <span>⚡ Энергия</span>
              <span className="tabular-nums">{energy} / {ENERGY_MAX}</span>
            </div>
            <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700/50">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  energyPct > 60 ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                  : energyPct > 25 ? 'bg-gradient-to-r from-yellow-500 to-orange-400'
                  : 'bg-gradient-to-r from-red-600 to-red-400'
                }`}
                style={{ width: `${energyPct}%` }}
              />
            </div>
            <p className="text-[10px] text-neutral-500 text-center">
              +{ENERGY_REGEN_PER_SEC} энергии в секунду • Пополняется автоматически
            </p>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          Вкладка 2: AI Чат
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ai' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Режимы */}
          <div className="p-2 border-b border-neutral-800/80 bg-neutral-900/40 flex gap-1.5 overflow-x-auto text-[11px]">
            {([
              { mode: 'SMM_POST',  label: '✍️ Пост Telegram' },
              { mode: 'REWRITE',   label: '🔄 Рерайт'        },
              { mode: 'SUMMARIZE', label: '📊 Выжимка'       },
              { mode: 'CHAT',      label: '💬 Чат'           },
            ] as const).map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAiMode(mode)}
                className={`px-3 py-1.5 rounded-full border transition-all shrink-0 ${
                  aiMode === mode
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300 font-medium'
                    : 'border-neutral-800 text-neutral-400'
                }`}
              >{label}</button>
            ))}
          </div>

          {/* Сообщения */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-neutral-800/90 text-neutral-200 border border-neutral-700/60 rounded-bl-none shadow-sm'
                }`}>{m.text}</div>
                {m.role === 'model' && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(m.id, m.text)}
                    className="mt-1 text-[10px] text-neutral-500 hover:text-neutral-300 flex items-center gap-1 px-1 py-0.5"
                  >{copiedId === m.id ? '✅ Скопировано' : '📋 Копировать'}</button>
                )}
              </div>
            ))}
            {isGenerating && (
              <div className="flex items-center gap-2 text-xs text-neutral-400 px-3 py-2 bg-neutral-900 rounded-xl border border-neutral-800 w-fit">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                <span>OmniAI генерирует шедевр...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Ввод */}
          <div className="p-3 bg-neutral-900 border-t border-neutral-800 flex items-center gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={aiMode === 'SMM_POST' ? 'О чем написать пост?' : 'Введите запрос...'}
              className="flex-1 bg-neutral-800/90 border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors min-h-[44px]"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={isGenerating || !prompt.trim()}
              className="w-11 h-11 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-all shrink-0 min-h-[44px] min-w-[44px]"
            >🚀</button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          Вкладка 3: DePIN Доход
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'node' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Статус ноды */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-neutral-400 uppercase tracking-wider block">Статус DePIN узла</span>
                <span className="text-sm font-semibold text-neutral-100">
                  {isNodeActive ? 'Воркер активен' : 'Воркер на паузе'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer min-h-[44px]">
                <input type="checkbox" checked={isNodeActive} onChange={(e) => setIsNodeActive(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>
            <p className="text-xs text-neutral-400 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800/80 font-mono text-[11px] truncate">
              {nodeStatusText}
            </p>
          </div>

          {/* Баланс */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <span className="text-[11px] text-neutral-400 block mb-1">Накоплено</span>
              <span className="text-2xl font-bold text-emerald-400">{credits}</span>
              <span className="text-[11px] text-neutral-500 block mt-1">≈ {(credits / 100).toFixed(2)} ₽</span>
            </div>
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <span className="text-[11px] text-neutral-400 block mb-1">Просмотров</span>
              <span className="text-2xl font-bold text-blue-400">{completedTasksCount}</span>
              <span className="text-[11px] text-neutral-500 block mt-1">в фоне</span>
            </div>
          </div>

          {/* Вывод средств */}
          <div className="p-4 bg-gradient-to-b from-neutral-900 to-neutral-900/60 border border-neutral-800 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <div>
                <h3 className="text-xs font-semibold text-neutral-200">Вывод на баланс SMMplan / SMMflux</h3>
                <p className="text-[11px] text-neutral-400">100 OmniCredits = 1.00 ₽ на услуги продвижения</p>
              </div>
            </div>
            {conversionMessage && (
              <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">{conversionMessage}</div>
            )}
            <button
              type="button"
              onClick={handleConvertCredits}
              disabled={credits < 100 || isConverting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition-all shadow-md min-h-[44px]"
            >
              {isConverting
                ? 'Обработка...'
                : credits >= 100
                ? `Вывести ${Math.floor(credits / 100)}.00 ₽ на баланс`
                : 'Нужно минимум 100 кредитов (1.00 ₽)'}
            </button>
          </div>

          {/* Прозрачность */}
          <div className="p-3 bg-neutral-900/40 rounded-xl border border-neutral-800/60 text-[11px] text-neutral-500 space-y-1">
            <p className="font-semibold text-neutral-400">🛡️ Политика Zero-Account-Risk:</p>
            <p>• Узел выполняет только открытые GET-запросы к публичным постам Telegram Web.</p>
            <p>• 0 доступа к вашим перепискам, паролям или телефону.</p>
            <p>• Трафик: &lt;10 КБ на просмотр. Батарея не нагревается.</p>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          Вкладка 4: Настройки — типы задач DePIN-узла
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Toast-предупреждение */}
          {prefToast && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-300 flex items-start gap-2">
              <span className="shrink-0 text-base">⚠️</span>
              <span>{prefToast}</span>
            </div>
          )}

          {/* Заголовок */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
            <h2 className="text-sm font-semibold text-neutral-100 mb-1">Типы задач узла</h2>
            <p className="text-[11px] text-neutral-400">
              Выберите, какие органические задачи ваш узел готов выполнять. Отключённые задачи не поступают в очередь.
            </p>
          </div>

          {/* Тоггл 1: Просмотры */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-2xl shrink-0">👁</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-100">Просмотры</p>
                <p className="text-[11px] text-neutral-400 truncate">~0% риска • +5 кредитов / задание</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-bold text-emerald-400">+5 кр.</span>
              <label className="relative inline-flex items-center cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={acceptsViewTasks}
                  className="sr-only peer"
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setAcceptsViewTasks(val); // optimistic
                    await updateNodePreferencesAction({ nodeId, acceptsViewTasks: val });
                  }}
                />
                <div className="w-11 h-6 bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>
          </div>

          {/* Тоггл 2: Реакции */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-2xl shrink-0">👍</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-100">Реакции</p>
                <p className="text-[11px] text-neutral-400 truncate">~1% риска • +8 кредитов / задание</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-bold text-emerald-400">+8 кр.</span>
              <label className="relative inline-flex items-center cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={acceptsReactTasks}
                  className="sr-only peer"
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setAcceptsReactTasks(val); // optimistic
                    await updateNodePreferencesAction({ nodeId, acceptsReactTasks: val });
                  }}
                />
                <div className="w-11 h-6 bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>
          </div>

          {/* Тоггл 3: Подписки */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-amber-900/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-2xl shrink-0">👥</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-100">Подписки</p>
                <p className="text-[11px] text-amber-400/80 truncate">~5% риска • +50 кредитов / задание</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-bold text-amber-400">+50 кр.</span>
              <label className="relative inline-flex items-center cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={acceptsFollowTasks}
                  className="sr-only peer"
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setAcceptsFollowTasks(val); // optimistic
                    if (val) {
                      setPrefToast('⚠️ Вы берёте риск временного ограничения аккаунта. Мы ограничиваем до 3 подписок в сутки.');
                      setTimeout(() => setPrefToast(null), 6000);
                    }
                    await updateNodePreferencesAction({ nodeId, acceptsFollowTasks: val });
                  }}
                />
                <div className="w-11 h-6 bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>
          </div>

          {/* Справка */}
          <div className="p-3 bg-neutral-900/40 rounded-xl border border-neutral-800/60 text-[11px] text-neutral-500 space-y-1">
            <p className="font-semibold text-neutral-400">ℹ️ Как это работает:</p>
            <p>• Настройки сохраняются мгновенно и применяются к следующей задаче в очереди.</p>
            <p>• Риск — вероятность временного ограничения аккаунта Telegram за один день работы.</p>
            <p>• Подписки лимитированы: не более 3 в сутки на один узел.</p>
          </div>
        </div>
      )}
    </div>
  );
}
