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
  syncTapsAction,
  createP2PBoostAction,
  fetchDePinTasksAction,
  skipDePinTaskAction,
} from '@/actions/depin/ai-assistant';
import {
  processReferralAction,
  getReferralStatsAction,
  type ReferralStatsResponse,
} from '@/actions/depin/referral';
import type { DePinTaskItem } from '@/services/depin/task-dispatcher';

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

export interface CompletedDePinTask {
  taskId: string;
  targetId?: string;
  type: string;
  channel: string;
  postId?: number;
  postUrl: string;
  postUrls?: string[];
  postIds?: number[];
  reactionEmoji?: string;
  earnedReward: number;
  completedAt: number;
}

type FeedFilterCategory = 'ALL' | 'MULTI_POST' | 'SMART_COMMENT' | 'REACT' | 'VIEW';
type FeedViewTab = 'AVAILABLE' | 'COMPLETED';

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'только что';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  return `${Math.floor(diffHours / 24)} дн назад`;
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
  disableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  initData?: string;
  initDataUnsafe?: {
    start_param?: string;
    user?: { id: number; username?: string; first_name?: string };
  };
  openTelegramLink?: (url: string) => void;
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
  const [allowedReactions,   setAllowedReactions]   = useState<string[]>(['👍', '❤️', '🔥', '🎉', '👏', '💩']);
  const [hasTelegramPremium, setHasTelegramPremium] = useState(false);
  const [prefToast,          setPrefToast]          = useState<string | null>(null);

  // ── P2P Boost State ──────────────────────────────────────────────────────────
  const [showBoostPanel,       setShowBoostPanel]       = useState(false);
  const [boostPostUrl,         setBoostPostUrl]         = useState('');
  const [boostType,            setBoostType]            = useState<'VIEW' | 'REACT' | 'MULTI_POST' | 'SMART_COMMENT'>('VIEW');
  const [boostReactionEmoji,   setBoostReactionEmoji]   = useState('🔥');
  const [boostCount,           setBoostCount]           = useState(25);
  const [isSubmittingBoost,    setIsSubmittingBoost]    = useState(false);
  const [boostStatusMessage,   setBoostStatusMessage]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastCreatedTargetId,  setLastCreatedTargetId]  = useState<string | null>(null);
  const [lastCreatedPostUrl,   setLastCreatedPostUrl]   = useState<string | null>(null);

  // ── Viral Referral State ───────────────────────────────────────────────────
  const [referralStats,        setReferralStats]        = useState<ReferralStatsResponse | null>(null);
  const [welcomeBanner,        setWelcomeBanner]        = useState<string | null>(null);
  const [copiedRefLink,        setCopiedRefLink]        = useState(false);

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
  const pendingTapsRef = useRef(0);
  const lastTapTimeRef = useRef(Date.now());

  // ── Smart Community Feed & Trust Score State ─────────────────────────────────
  const [feedTasks,               setFeedTasks]               = useState<DePinTaskItem[]>([]);
  const [completedFeedTasks,      setCompletedFeedTasks]      = useState<CompletedDePinTask[]>([]);
  const [feedFilterCategory,      setFeedFilterCategory]      = useState<FeedFilterCategory>('ALL');
  const [feedViewTab,             setFeedViewTab]             = useState<FeedViewTab>('AVAILABLE');
  const [trustScore,              setTrustScore]              = useState<number>(100);
  const [taskComments,            setTaskComments]            = useState<Record<string, string[]>>({});
  const [generatingCommentTaskId, setGeneratingCommentTaskId] = useState<string | null>(null);
  const [copiedCommentKey,        setCopiedCommentKey]        = useState<string | null>(null);
  const [isLoadingFeed,           setIsLoadingFeed]           = useState(false);
  const [openedTaskIds,           setOpenedTaskIds]           = useState<Set<string>>(new Set());
  const [verifyingTaskId,         setVerifyingTaskId]         = useState<string | null>(null);
  const [taskFeedback,            setTaskFeedback]            = useState<Record<string, { success: boolean; message: string }>>({});
  const squadTargetIdRef          = useRef<string | null>(null);
  const completedTaskIdsRef       = useRef<Set<string>>(new Set());
  const completedTargetKeysRef    = useRef<Set<string>>(new Set());
  const skippedTaskIdsRef         = useRef<Set<string>>(new Set());
  const skippedTargetKeysRef      = useRef<Set<string>>(new Set());
  const [skippingTaskId,          setSkippingTaskId]          = useState<string | null>(null);
  const [skipToast,               setSkipToast]               = useState<string | null>(null);

  // ── Загрузка реальных заданий из очереди сообщества DePinTarget ──────────────
  const loadCommunityFeed = useCallback(async (activeNodeId: string) => {
    if (!activeNodeId) return;
    setIsLoadingFeed(true);
    try {
      const res = await fetchDePinTasksAction({
        nodeId: activeNodeId,
        limit: 8,
        includeDemo: true,
        priorityTargetId: squadTargetIdRef.current || undefined,
      });
      if (res.success && res.tasks) {
        // Исключаем локально выполненные и пропущенные задания, чтобы гарантировать ротацию
        const freshTasks = res.tasks.filter((t) => {
          if (completedTaskIdsRef.current.has(t.taskId)) return false;
          if (skippedTaskIdsRef.current.has(t.taskId)) return false;
          const targetKey = t.targetId || `${t.channel}:${t.postId || 1}:${t.type}`;
          const simpleKey = `${t.channel}:${t.postId || 1}`;
          if (completedTargetKeysRef.current.has(targetKey) || completedTargetKeysRef.current.has(simpleKey)) return false;
          if (skippedTargetKeysRef.current.has(targetKey) || skippedTargetKeysRef.current.has(simpleKey)) return false;
          return true;
        });
        setFeedTasks(freshTasks);
        if (res.currentCredits !== undefined) {
          setCredits(res.currentCredits);
        }
        if (res.trustScore !== undefined) {
          setTrustScore(res.trustScore);
        }
      }
    } catch {
      // non-blocking
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  // ── Загрузка истории завершенных и пропущенных заданий из localStorage ───────
  useEffect(() => {
    if (!nodeId || typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(`depin_completed_${nodeId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as CompletedDePinTask[];
        if (Array.isArray(parsed)) {
          setCompletedFeedTasks(parsed);
          parsed.forEach((item) => {
            if (item.taskId) completedTaskIdsRef.current.add(item.taskId);
            const targetKey = item.targetId || `${item.channel}:${item.postId || 1}:${item.type}`;
            const simpleKey = `${item.channel}:${item.postId || 1}`;
            completedTargetKeysRef.current.add(targetKey);
            completedTargetKeysRef.current.add(simpleKey);
          });
          setCompletedTasksCount((prev) => Math.max(prev, parsed.length));
        }
      }

      const storedSkipped = localStorage.getItem(`depin_skipped_${nodeId}`);
      if (storedSkipped) {
        const parsedSkipped = JSON.parse(storedSkipped) as string[];
        if (Array.isArray(parsedSkipped)) {
          parsedSkipped.forEach((key) => {
            if (key) skippedTargetKeysRef.current.add(key);
          });
        }
      }
    } catch {
      // non-blocking
    }
  }, [nodeId]);

  // ── 1. Telegram auth + stable nodeId + Referral Processing ──────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tg = getTg();
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
      }
    }

    const initReferral = (activeNodeId: string, activeTgId?: string) => {
      const startParam =
        tg?.initDataUnsafe?.start_param ||
        new URLSearchParams(window.location.search).get('startapp') ||
        new URLSearchParams(window.location.search).get('start');

      const tgIdToUse = activeTgId || (activeNodeId.startsWith('tg_') ? activeNodeId.replace('tg_', '') : activeNodeId);

      if (startParam) {
        processReferralAction({
          refereeNodeId: activeNodeId,
          refereeTelegramId: tgIdToUse,
          startParam,
        }).then((refRes) => {
          if (refRes.success) {
            if (refRes.welcomeBonusAwarded && refRes.creditsAwarded) {
              setCredits((prev) => prev + refRes.creditsAwarded!);
              setWelcomeBanner('🎁 Вам начислен Welcome-бонус +50 PTS от друга! Запустите бесплатный буст своего канала.');
              haptic('medium');
            }
            if (refRes.squadTargetId) {
              squadTargetIdRef.current = refRes.squadTargetId;
            }
          }
          void loadCommunityFeed(activeNodeId);
        }).catch(() => {
          void loadCommunityFeed(activeNodeId);
        });
      } else {
        void loadCommunityFeed(activeNodeId);
      }

      getReferralStatsAction({ nodeId: activeNodeId, telegramId: tgIdToUse }).then((statsRes) => {
        if (statsRes.success && statsRes.stats) {
          setReferralStats(statsRes.stats);
        }
      }).catch(() => {});
    };

    const initData = tg?.initData;

    if (initData) {
      fetch('/api/depin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
        signal: AbortSignal.timeout(8000),
      })
        .then((r) => r.json())
        .then((data: { success: boolean; nodeId?: string; telegramId?: string }) => {
          if (data.success && data.nodeId) {
            setNodeId(data.nodeId);
            if (data.telegramId) setTelegramId(data.telegramId);
            localStorage.setItem('omnismm_depin_node_id', data.nodeId);
            initReferral(data.nodeId, data.telegramId);
          } else {
            const fb = localStorage.getItem('omnismm_depin_node_id')
              || `node_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
            localStorage.setItem('omnismm_depin_node_id', fb);
            setNodeId(fb);
            initReferral(fb);
          }
        })
        .catch(() => {
          const fb = localStorage.getItem('omnismm_depin_node_id')
            || `node_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
          localStorage.setItem('omnismm_depin_node_id', fb);
          setNodeId(fb);
          initReferral(fb);
        });
    } else {
      const stored = localStorage.getItem('omnismm_depin_node_id')
        || `node_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
      localStorage.setItem('omnismm_depin_node_id', stored);
      setNodeId(stored);
      initReferral(stored);
    }
  }, [loadCommunityFeed]);

  // ── 2. SSE — реалтайм push задач [заменяет setInterval polling] ──────────────
  useEffect(() => {
    if (!nodeId || !isNodeActive) {
      sseRef.current?.close();
      sseRef.current = null;
      setNodeStatusText(isNodeActive ? 'Синхронизация...' : '⏸ Воркер на паузе');
      return;
    }

    setNodeStatusText('🟢 Узел активен — лента обновлена');

    const es = new EventSource(`/api/depin/stream?nodeId=${encodeURIComponent(nodeId)}`);
    sseRef.current = es;

    es.addEventListener('connected', (e) => {
      const d = JSON.parse(e.data) as { credits: number };
      setCredits(d.credits);
      setNodeStatusText('🟢 Узел подключён к сети заданий');
    });

    es.addEventListener('task', (e) => {
      const task = JSON.parse(e.data) as DePinTask;
      pendingTask.current = task;
      setNodeStatusText(`⚡ Новая задача: @${task.channel}/${task.postId ?? ''}`);
      if (nodeId) {
        void loadCommunityFeed(nodeId);
      }
    });

    es.addEventListener('idle',  () => setNodeStatusText('🟢 Ожидание новых заказов...'));
    es.addEventListener('ping',  () => { /* keepalive — ничего не делаем */ });
    es.addEventListener('close', () => {
      setNodeStatusText('🔄 Переподключение...');
      es.close();
    });

    es.onerror = () => setNodeStatusText('⚠️ Разрыв соединения, переподключение...');

    return () => { es.close(); sseRef.current = null; };
  }, [nodeId, isNodeActive, loadCommunityFeed]);

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

  // ── Пакетная синхронизация тапов с базой данных (Batch Tap Accumulator) ──────
  const flushTaps = useCallback(async () => {
    const count = pendingTapsRef.current;
    if (count <= 0 || !nodeId) return;
    pendingTapsRef.current = 0;

    try {
      const res = await syncTapsAction({
        nodeId,
        tapCount: count,
        clientTimestamp: Date.now(),
      });
      if (res.success && res.totalCredits !== undefined) {
        setCredits(res.totalCredits);
        if (res.remainingEnergy !== undefined) {
          setEnergy(res.remainingEnergy);
        }
      } else if (!res.success && res.remainingEnergy !== undefined) {
        setEnergy(res.remainingEnergy);
      }
    } catch {
      // При сетевой ошибке восстанавливаем счетчик для повторной отправки
      pendingTapsRef.current += count;
    }
  }, [nodeId]);

  // Периодический сброс тапов каждые 3 секунды и при скрытии вкладки
  useEffect(() => {
    const timer = setInterval(() => {
      if (pendingTapsRef.current > 0) {
        void flushTaps();
      }
    }, 3000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pendingTapsRef.current > 0) {
        void flushTaps();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pendingTapsRef.current > 0) {
        void flushTaps();
      }
    };
  }, [flushTaps]);

  // ── Тап по монетке (геймификация) ───────────────────────────────────────────
  const handleCoinTap = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (energy < ENERGY_PER_TAP) return;

    setEnergy((en) => en - ENERGY_PER_TAP);
    setCredits((c) => c + CREDITS_PER_TAP);
    pendingTapsRef.current += CREDITS_PER_TAP;
    lastTapTimeRef.current = Date.now();

    setIsCoinAnim(true);
    setTimeout(() => setIsCoinAnim(false), 200);
    haptic('light');

    // Если накопился пакет из 20 тапов — отправляем немедленно
    if (pendingTapsRef.current >= 20) {
      void flushTaps();
    }

    // Частица +PTS
    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
    const id   = ++particleId.current;
    const x    = e.clientX - rect.left + (Math.random() * 40 - 20);
    const y    = e.clientY - rect.top  - 20;
    setParticles((p) => [...p, { id, x, y, value: CREDITS_PER_TAP }]);
    setTimeout(() => setParticles((p) => p.filter((pt) => pt.id !== id)), 800);
  }, [energy, flushTaps]);

  // ── Вывод кредитов на рублёвый баланс [WARN-3 FIX] ──────────────────────────
  const handleConvertCredits = async () => {
    // Сначала сбрасываем любые несохраненные тапы
    await flushTaps();

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

  const handleCreateP2PBoost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeId) return;

    setIsSubmittingBoost(true);
    setBoostStatusMessage(null);

    try {
      const res = await createP2PBoostAction({
        nodeId,
        postUrl: boostPostUrl.trim(),
        boostType,
        reactionEmoji: boostType === 'REACT' ? boostReactionEmoji : undefined,
        count: boostCount,
      });

      if (res.success) {
        if (res.remainingCredits !== undefined) {
          setCredits(res.remainingCredits);
        }
        if (res.targetId) {
          setLastCreatedTargetId(res.targetId);
        }
        setLastCreatedPostUrl(boostPostUrl.trim());
        const typeLabel =
          boostType === 'REACT'
            ? `реакций ${boostReactionEmoji}`
            : boostType === 'MULTI_POST'
            ? 'мульти-просмотров (3 поста)'
            : boostType === 'SMART_COMMENT'
            ? 'ИИ-комментариев'
            : 'просмотров';

        setBoostStatusMessage({
          type: 'success',
          text: `🎉 Задание успешно запущено в сеть DePIN! Цель: ${boostCount} ${typeLabel}.`,
        });
        setBoostPostUrl('');
        void loadCommunityFeed(nodeId);
      } else {
        setBoostStatusMessage({
          type: 'error',
          text: res.error || 'Не удалось запустить буст. Проверьте ссылку и баланс.',
        });
      }
    } catch (err) {
      setBoostStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Сбой отправки задания',
      });
    } finally {
      setIsSubmittingBoost(false);
    }
  };

  // ── Действия Smart Task Feed (нативный просмотр / реакция в Telegram) ───────
  const handleOpenPostInTelegram = (task: DePinTaskItem) => {
    const tg = getTg();
    haptic('light');
    setOpenedTaskIds((prev) => new Set(prev).add(task.taskId));
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(task.postUrl);
    } else {
      window.open(task.postUrl, '_blank');
    }
  };

  const handleOpenMultiPostInTelegram = (task: DePinTaskItem, specificUrl?: string) => {
    const tg = getTg();
    haptic('light');
    setOpenedTaskIds((prev) => new Set(prev).add(task.taskId));
    const urlToOpen = specificUrl || task.postUrl;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(urlToOpen);
    } else {
      window.open(urlToOpen, '_blank');
    }
  };

  const handleGenerateSmartComments = async (task: DePinTaskItem) => {
    if (generatingCommentTaskId) return;
    setGeneratingCommentTaskId(task.taskId);
    haptic('light');

    try {
      const channelLabel = task.channel ? `@${task.channel}` : 'Telegram-канал';
      const promptText = `Напиши 3 коротких органичных комментария к посту #${task.postId || 1} в канале ${channelLabel}`;
      const res = await askOmniAiAction({
        prompt: promptText,
        mode: 'SMART_COMMENT',
      });

      if (res.success && res.text) {
        const lines = res.text
          .split('\n')
          .map((line) => line.replace(/^[\d.)\s*-]+/, '').replace(/^["'«»]+|["'«»]+$/g, '').trim())
          .filter((line) => line.length > 5);

        const options = lines.slice(0, 3);
        if (options.length > 0) {
          setTaskComments((prev) => ({
            ...prev,
            [task.taskId]: options,
          }));
          haptic('medium');
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setGeneratingCommentTaskId(null);
    }
  };

  const handleCopyComment = (taskId: string, commentIndex: number, commentText: string) => {
    navigator.clipboard.writeText(commentText).then(() => {
      setCopiedCommentKey(`${taskId}_${commentIndex}`);
      haptic('light');
      setTimeout(() => setCopiedCommentKey(null), 2500);
    });
  };

  const handleVerifyAndClaimTask = async (task: DePinTaskItem) => {
    if (verifyingTaskId) return;
    setVerifyingTaskId(task.taskId);
    haptic('medium');

    try {
      const res = await reportDePinTaskAction({
        nodeId,
        taskId: task.taskId,
        target: task.targetUrl,
        success: true,
      });

      if (res.success) {
        haptic('heavy');
        const defaultReward = task.type === 'MULTI_POST' ? 15 : task.type === 'SMART_COMMENT' ? 35 : 10;
        const awardedReward = res.creditsAwarded || task.creditsReward || defaultReward;

        setCredits(res.totalCredits ?? (credits + awardedReward));
        setCompletedTasksCount((p) => p + 1);
        completedTaskIdsRef.current.add(task.taskId);
        const targetKey = task.targetId || `${task.channel}:${task.postId || 1}:${task.type}`;
        completedTargetKeysRef.current.add(targetKey);

        // Добавляем в историю завершенных заданий
        const completedItem: CompletedDePinTask = {
          taskId: task.taskId,
          targetId: task.targetId,
          type: task.type,
          channel: task.channel,
          postId: task.postId,
          postUrl: task.postUrl,
          postUrls: task.postUrls,
          postIds: task.postIds,
          reactionEmoji: task.reactionEmoji,
          earnedReward: awardedReward,
          completedAt: Date.now(),
        };

        setCompletedFeedTasks((prev) => {
          const next = [completedItem, ...prev.filter((t) => t.taskId !== task.taskId)].slice(0, 50);
          try {
            if (typeof window !== 'undefined' && nodeId) {
              localStorage.setItem(`depin_completed_${nodeId}`, JSON.stringify(next));
            }
          } catch {
            // ignore
          }
          return next;
        });

        setTaskFeedback((prev) => ({
          ...prev,
          [task.taskId]: { success: true, message: `🎉 +${awardedReward} PTS зачислено!` },
        }));

        setTimeout(() => {
          setFeedTasks((prev) => prev.filter((t) => t.taskId !== task.taskId));
          setTaskFeedback((prev) => {
            const next = { ...prev };
            delete next[task.taskId];
            return next;
          });
          setOpenedTaskIds((prev) => {
            const next = new Set(prev);
            next.delete(task.taskId);
            return next;
          });

          // Автоматическая динамическая ротация и догрузка свежих заданий взамен выполненного
          if (nodeId) {
            void loadCommunityFeed(nodeId);
          }
        }, 1200);
      } else {
        setTaskFeedback((prev) => ({
          ...prev,
          [task.taskId]: { success: false, message: `⚠️ ${res.error || 'Ошибка проверки задания'}` },
        }));
      }
    } catch {
      setTaskFeedback((prev) => ({
        ...prev,
        [task.taskId]: { success: false, message: '⚠️ Сетевой сбой проверки' },
      }));
    } finally {
      setVerifyingTaskId(null);
    }
  };

  // ── Пропуск / замена задания (уже просмотрено, свой пост, зависло) ──────────
  const handleSkipTask = async (
    task: DePinTaskItem,
    reason: 'ALREADY_VIEWED' | 'OWN_POST' | 'EXPIRED' | 'USER_SKIP' = 'USER_SKIP'
  ) => {
    if (skippingTaskId === task.taskId) return;
    setSkippingTaskId(task.taskId);
    haptic('light');

    // 1. Оптимистическое локальное исключение: фиксируем taskId, targetKey и простой channel:postId
    skippedTaskIdsRef.current.add(task.taskId);
    const targetKey = task.targetId || `${task.channel}:${task.postId || 1}:${task.type}`;
    const simpleKey = `${task.channel}:${task.postId || 1}`;
    skippedTargetKeysRef.current.add(targetKey);
    skippedTargetKeysRef.current.add(simpleKey);

    if (reason === 'OWN_POST') {
      skippedTargetKeysRef.current.add(task.channel.toLowerCase());
    }

    try {
      if (typeof window !== 'undefined' && nodeId) {
        const existing = JSON.parse(localStorage.getItem(`depin_skipped_${nodeId}`) || '[]') as string[];
        const toSave = [targetKey, simpleKey];
        if (reason === 'OWN_POST') toSave.push(task.channel.toLowerCase());
        const updated = Array.from(new Set([...existing, ...toSave])).slice(-200);
        localStorage.setItem(`depin_skipped_${nodeId}`, JSON.stringify(updated));
      }
    } catch {
      // non-blocking
    }

    // 2. Немедленно убираем карточку из активной ленты и очищаем оверлеи
    setFeedTasks((prev) => prev.filter((t) => t.taskId !== task.taskId));
    setOpenedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(task.taskId);
      return next;
    });
    setTaskFeedback((prev) => {
      const next = { ...prev };
      delete next[task.taskId];
      return next;
    });

    const toastText =
      reason === 'OWN_POST'
        ? `👤 Канал @${task.channel} исключён (свой пост)`
        : reason === 'ALREADY_VIEWED'
        ? '👁️ Задание пропущено (уже просмотрено ранее)'
        : reason === 'EXPIRED'
        ? '🔄 Зависшее задание заменено на новое'
        : '⏭️ Задание пропущено';

    setSkipToast(toastText);
    setTimeout(() => setSkipToast((curr) => (curr === toastText ? null : curr)), 3500);

    // 3. Вызов Server Action для фиксации в Redis на 30 дней и получения свежего задания
    try {
      const res = await skipDePinTaskAction({
        nodeId,
        taskId: task.taskId,
        targetId: task.targetId,
        channel: task.channel,
        postId: task.postId,
        reason,
      });

      if (res.success && res.replacementTask) {
        const rep = res.replacementTask;
        const repKey = rep.targetId || `${rep.channel}:${rep.postId || 1}:${rep.type}`;
        const repSimpleKey = `${rep.channel}:${rep.postId || 1}`;
        if (
          !completedTargetKeysRef.current.has(repKey) &&
          !completedTargetKeysRef.current.has(repSimpleKey) &&
          !skippedTargetKeysRef.current.has(repKey) &&
          !skippedTargetKeysRef.current.has(repSimpleKey)
        ) {
          setFeedTasks((prev) => {
            if (prev.some((t) => t.taskId === rep.taskId)) return prev;
            return [...prev, rep];
          });
          return;
        }
      }

      if (nodeId) {
        void loadCommunityFeed(nodeId);
      }
    } catch {
      if (nodeId) {
        void loadCommunityFeed(nodeId);
      }
    } finally {
      setSkippingTaskId(null);
    }
  };

  const handleShareWithFriend = () => {
    const tg = getTg();
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'SMMplansapport_bot';
    const myId = telegramId || (nodeId.startsWith('tg_') ? nodeId.replace('tg_', '') : nodeId);
    const shareUrl = `https://t.me/${botUsername}/tap?startapp=ref_${myId}`;
    const text = encodeURIComponent('🎁 Забирай +50 PTS на продвижение своего Telegram-канала в тапалке SMMplan! Набирай просмотры и реакции бесплатно:');
    const fullShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`;
    haptic('light');
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(fullShareUrl);
    } else {
      window.open(fullShareUrl, '_blank');
    }
  };

  const handleCopyReferralLink = () => {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'SMMplansapport_bot';
    const myId = telegramId || (nodeId.startsWith('tg_') ? nodeId.replace('tg_', '') : nodeId);
    const shareUrl = `https://t.me/${botUsername}/tap?startapp=ref_${myId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedRefLink(true);
      haptic('light');
      setTimeout(() => setCopiedRefLink(false), 2000);
    });
  };

  const handleShareSquadPost = (targetId: string, postUrl: string) => {
    const tg = getTg();
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'SMMplansapport_bot';
    const myId = telegramId || (nodeId.startsWith('tg_') ? nodeId.replace('tg_', '') : nodeId);
    const shareUrl = `https://t.me/${botUsername}/tap?startapp=squad_${targetId}_${myId}`;
    const text = encodeURIComponent(`🔥 Друзья, поддержите мой пост в Telegram! Переходите по ссылке и получайте очки за просмотр или реакцию:\n${postUrl}`);
    const fullShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`;
    haptic('medium');
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(fullShareUrl);
    } else {
      window.open(fullShareUrl, '_blank');
    }
  };

  // ── Рендер ───────────────────────────────────────────────────────────────────
  const energyPct = (energy / ENERGY_MAX) * 100;

  const filteredFeedTasks = feedTasks.filter((task) => {
    if (feedFilterCategory === 'ALL') return true;
    if (feedFilterCategory === 'MULTI_POST') return task.type === 'MULTI_POST';
    if (feedFilterCategory === 'SMART_COMMENT') return task.type === 'SMART_COMMENT';
    if (feedFilterCategory === 'REACT') return task.type.startsWith('REACT_POST');
    if (feedFilterCategory === 'VIEW') return task.type === 'VIEW_POST';
    return true;
  });

  const filteredCompletedTasks = completedFeedTasks.filter((task) => {
    if (feedFilterCategory === 'ALL') return true;
    if (feedFilterCategory === 'MULTI_POST') return task.type === 'MULTI_POST';
    if (feedFilterCategory === 'SMART_COMMENT') return task.type === 'SMART_COMMENT';
    if (feedFilterCategory === 'REACT') return task.type.startsWith('REACT_POST');
    if (feedFilterCategory === 'VIEW') return task.type === 'VIEW_POST';
    return true;
  });

  const taskCategoryCounts = {
    ALL: feedTasks.length,
    MULTI_POST: feedTasks.filter((t) => t.type === 'MULTI_POST').length,
    SMART_COMMENT: feedTasks.filter((t) => t.type === 'SMART_COMMENT').length,
    REACT: feedTasks.filter((t) => t.type.startsWith('REACT_POST')).length,
    VIEW: feedTasks.filter((t) => t.type === 'VIEW_POST').length,
  };

  return (
    <div className="fixed inset-0 w-full bg-[#0d0f14] text-neutral-100 font-sans flex flex-col overflow-hidden pt-[env(safe-area-inset-top,0px)]">

      {/* CSS анимации и глобальный скролл */}
      <style>{`
        @keyframes coinBounce { 0%,100%{transform:scale(1)} 50%{transform:scale(0.88)} }
        @keyframes floatUp { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-60px)} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.6);opacity:0} }
        .coin-tap { animation: coinBounce 0.2s ease-out; }
        .float-particle { animation: floatUp 0.8s ease-out forwards; pointer-events:none; }
        .pulse-ring { animation: pulse-ring 0.6s ease-out; }

        /* Блокируем нативный скролл body, чтобы WebView не прыгал */
        html, body {
          overflow: hidden !important;
          overscroll-behavior-y: none;
          background-color: #0d0f14 !important;
          height: 100%;
          width: 100%;
        }

        /* Стильный видимый скроллбар для внутренних контейнеров */
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 9999px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
      `}</style>

      {/* ── Фиксированная шапка и навигация ── */}
      <div className="z-40 bg-[#0d0f14]/95 backdrop-blur-md border-b border-neutral-800/80 shadow-sm w-full shrink-0">
        <div className="max-w-md mx-auto">
          {/* Шапка */}
          <header className="px-4 pt-3.5 pb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-[#352560] border border-purple-500/40 flex items-center justify-center font-bold text-white shadow-md text-base">
                  Ω
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0d0f12]" />
              </div>
              <div>
                <h1 className="font-bold text-sm leading-tight text-white tracking-tight">OmniAI DePIN Ассистент</h1>
                <p className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5">
                  <span>Gemini 3 Flash • DePIN Узел</span>
                  <span className="text-emerald-400 font-bold text-xs tracking-tighter">((•))</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#1a1d24] rounded-full border border-neutral-800">
              <span className="text-xs font-bold text-white tabular-nums">{credits}</span>
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">PTS</span>
            </div>
          </header>

          {/* Навигация */}
          <div className="px-3 pb-2.5">
            <nav className="flex p-1 gap-1 bg-[#16181d] rounded-2xl border border-neutral-800/80">
              {([
                { key: 'tap',      icon: '🔥', label: 'Задания'      },
                { key: 'ai',       icon: '🧠', label: 'Копирайтер'   },
                { key: 'node',     icon: '⚡', label: 'Доход узла'   },
                { key: 'settings', icon: '⚙️', label: 'Настройки'    },
              ] as const).map(({ key, icon, label }) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`flex-1 py-1.5 px-1 rounded-xl transition-all min-h-[46px] flex flex-col items-center justify-center gap-0.5 touch-manipulation ${
                      isActive
                        ? 'bg-gradient-to-b from-amber-600/35 to-amber-700/10 border border-amber-500/50 text-amber-400 shadow-inner'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/30'
                    }`}
                  >
                    <span className="text-base leading-none">{icon}</span>
                    <span className={`text-[11px] leading-tight ${isActive ? 'font-bold text-amber-300' : 'font-medium'}`}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* ── Скроллируемая область контента ── */}
      <div className="flex-1 w-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* ════════════════════════════════════════════════════════════════════════
            Вкладка 1: ТАП-геймификация (Хомяк-механика + P2P Буст + Вирусный рост)
        ════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'tap' && (
          <main className="w-full max-w-md mx-auto px-4 py-3 space-y-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] flex flex-col items-center">

            {/* Welcome-баннер для реферала */}
          {welcomeBanner && (
            <div className="w-full p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-300 flex items-center justify-between gap-2 shadow-sm">
              <span>{welcomeBanner}</span>
              <button
                type="button"
                onClick={() => setWelcomeBanner(null)}
                className="text-amber-400 hover:text-white p-1 text-xs shrink-0"
              >✕</button>
            </div>
          )}

          {/* Счётчик PTS */}
          <div className="text-center shrink-0">
            <div className="text-4xl font-black text-white tabular-nums">{credits.toLocaleString('ru')}</div>
            <div className="text-xs text-neutral-400 mt-1">OmniCredits • ≈ {(credits / 100).toFixed(2)} ₽</div>
          </div>



          {/* ════════════════════════════════════════════════════════════════
              🛡️ TRUST SCORE & АНТИ-БАН ГАЙД (Безопасность узла Telegram)
          ════════════════════════════════════════════════════════════════ */}
          <div className="w-full bg-[#16181d] border border-neutral-800/90 rounded-2xl p-4 space-y-3.5 shadow-md shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-medium text-neutral-300">Индекс доверия</span>
                <span className="font-extrabold text-white text-base tabular-nums">{trustScore}</span>
                <span className="text-neutral-500 font-medium text-sm">/100</span>
                <span className="text-neutral-600 mx-1">•</span>
                <span className="text-emerald-400 font-bold text-sm">Безопасный узел</span>
              </div>
            </div>

            {/* Прогресс-бар Trust Score с неоновым свечением */}
            <div className="w-full bg-[#1c2027] h-2.5 rounded-full overflow-hidden p-0.5 border border-neutral-800/40">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-500 shadow-[0_0_14px_rgba(52,211,153,0.9)]"
                style={{ width: `${Math.min(100, Math.max(10, trustScore))}%` }}
              />
            </div>

            {/* Сворачиваемый анти-бан блок */}
            <details className="group bg-neutral-950/70 border border-neutral-800 rounded-xl p-2.5 text-xs">
              <summary className="cursor-pointer font-medium text-neutral-300 flex items-center justify-between select-none">
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <span>📖</span>
                  <span>Правила безопасности & Защита от бана</span>
                </span>
                <span className="text-neutral-500 group-open:rotate-180 transition-transform text-[10px]">▼</span>
              </summary>
              <div className="mt-2.5 space-y-2 text-[11px] text-neutral-400 border-t border-neutral-800/80 pt-2 leading-relaxed">
                <div>
                  <span className="font-semibold text-neutral-200">🚫 Защита от SpamBlock:</span>{' '}
                  Telegram временно мутит аккаунты за частые монотонные клики. Чередуйте просмотры, реакции, мульти-просмотры 3 постов и комментарии — это снижает риск до нуля.
                </div>
                <div>
                  <span className="font-semibold text-neutral-200">👻 ShadowBan в комментариях:</span>{' '}
                  Спам-фильтры Telegram скрывают шаблонные комментарии ботов. Наш встроенный ИИ (Gemini 3 Flash) генерирует уникальный живой текст под контекст публикации.
                </div>
                <div>
                  <span className="font-semibold text-neutral-200">⏱️ Защита от FloodWait:</span>{' '}
                  Соблюдайте интервал не менее 10–15 секунд между открытием постов. Это имитирует чтение реальным человеком.
                </div>
                <div>
                  <span className="font-semibold text-neutral-200">💎 Почему дорогие задания безопаснее:</span>{' '}
                  За пакетный просмотр 3 постов (<span className="text-violet-300 font-bold">+15 PTS</span>) и осмысленный комментарий (<span className="text-blue-300 font-bold">+35 PTS</span>) начисляется больше очков, потому что глубокие сессии повышают ваш Trust Score и удерживают аккаунт в зеленой зоне надежности.
                </div>
              </div>
            </details>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              🔥 УМНАЯ ЛЕНТА ЗАДАНИЙ СООБЩЕСТВА (Smart Task Feed)
          ════════════════════════════════════════════════════════════════ */}
          <div className="w-full bg-[#16181d] border border-neutral-800/90 rounded-2xl p-4 space-y-3.5 shadow-md shrink-0">
            {/* Заголовок ленты */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🔥</span>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Задания сообщества</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      +10..35 PTS
                    </span>
                  </h3>
                  <p className="text-[10px] text-neutral-400">
                    Реальные просмотры, реакции и комментарии в Telegram
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadCommunityFeed(nodeId)}
                disabled={isLoadingFeed}
                className="text-[11px] text-neutral-200 hover:text-white px-3 py-1.5 rounded-xl bg-[#23272f] hover:bg-[#2b303a] border border-[#3b4252]/70 min-h-[36px] flex items-center gap-1.5 active:scale-95 transition-all touch-manipulation font-medium shadow-sm"
                title="Обновить задания"
              >
                <span className={isLoadingFeed ? 'animate-spin' : ''}>🔄</span>
                <span>{isLoadingFeed ? '...' : 'Обновить'}</span>
              </button>
            </div>

            {/* Переключатель вкладок: Доступные / Завершенные */}
            <div className="flex bg-[#101216] p-1 rounded-xl border border-neutral-800/90">
              <button
                type="button"
                onClick={() => setFeedViewTab('AVAILABLE')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all min-h-[36px] flex items-center justify-center gap-1.5 touch-manipulation ${
                  feedViewTab === 'AVAILABLE'
                    ? 'bg-[#23272f] text-white shadow-sm border border-[#3b4252]/70'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <span>🔥 Доступные</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  feedViewTab === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {feedTasks.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFeedViewTab('COMPLETED')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all min-h-[36px] flex items-center justify-center gap-1.5 touch-manipulation ${
                  feedViewTab === 'COMPLETED'
                    ? 'bg-[#23272f] text-white shadow-sm border border-[#3b4252]/70'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <span>✅ Завершенные</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  feedViewTab === 'COMPLETED' ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {completedFeedTasks.length}
                </span>
              </button>
            </div>

            {/* Фильтры категорий заданий */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              {[
                { id: 'ALL' as const, label: 'Все', badge: feedTasks.length },
                { id: 'MULTI_POST' as const, label: '📚 3 поста', badge: taskCategoryCounts.MULTI_POST },
                { id: 'SMART_COMMENT' as const, label: '💬 Комментарии', badge: taskCategoryCounts.SMART_COMMENT },
                { id: 'REACT' as const, label: '🔥 Реакции', badge: taskCategoryCounts.REACT },
                { id: 'VIEW' as const, label: '👁 Просмотры', badge: taskCategoryCounts.VIEW },
              ].map((cat) => {
                const isActive = feedFilterCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFeedFilterCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] whitespace-nowrap shrink-0 transition-all font-medium border min-h-[32px] flex items-center gap-1.5 touch-manipulation ${
                      isActive
                        ? 'bg-blue-600/25 border-blue-500/60 text-blue-300 font-semibold shadow-sm'
                        : 'bg-[#101216] border-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                    }`}
                  >
                    <span>{cat.label}</span>
                    {feedViewTab === 'AVAILABLE' && cat.badge > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-blue-500/40 text-blue-200' : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {cat.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Содержимое вкладки: ДОСТУПНЫЕ */}
            {feedViewTab === 'AVAILABLE' && (
              <>
                {skipToast && (
                  <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-700/80 text-neutral-200 text-xs flex items-center justify-between gap-2 shadow-lg transition-all animate-in fade-in">
                    <span className="font-medium">{skipToast}</span>
                    <button
                      type="button"
                      onClick={() => setSkipToast(null)}
                      className="text-neutral-400 hover:text-white text-xs px-1.5 py-0.5 rounded"
                      aria-label="Закрыть уведомление"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {isLoadingFeed && feedTasks.length === 0 ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2 text-neutral-400 text-xs">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span>Загрузка актуальных заданий...</span>
                  </div>
                ) : filteredFeedTasks.length > 0 ? (
                  <div className="space-y-2.5">
                    {filteredFeedTasks.map((task) => {
                      const isOpened = openedTaskIds.has(task.taskId);
                      const isVerifying = verifyingTaskId === task.taskId;
                      const feedback = taskFeedback[task.taskId];
                      const isReact = task.type.startsWith('REACT_POST');
                      const isMulti = task.type === 'MULTI_POST';
                      const isComment = task.type === 'SMART_COMMENT';
                      const emoji = task.reactionEmoji || '🔥';
                      const defaultReward = isMulti ? 15 : isComment ? 35 : 10;
                      const taskReward = task.creditsReward || defaultReward;

                      return (
                        <div
                          key={task.taskId}
                          className="p-3.5 bg-[#12141a] border border-neutral-800/80 rounded-2xl space-y-3 hover:border-neutral-700/80 transition-colors shadow-sm"
                        >
                          {/* Верхняя строка карточки */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-medium">
                              <span className="text-[#38bdf8] font-bold text-sm tracking-tight">@{task.channel}</span>
                              {task.postId ? (
                                <span className="text-neutral-500 text-xs font-mono">#{task.postId}</span>
                              ) : null}
                              {task.isSquadTarget && (
                                <span className="px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[9px] font-bold border border-violet-500/30">
                                  ⭐ От друга
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isMulti ? (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/40">
                                  📚 3 поста
                                </span>
                              ) : isComment ? (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                  💬 Комментарий
                                </span>
                              ) : isReact ? (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#1c2027] text-neutral-300 border border-neutral-700/60">
                                  {emoji} Реакция
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#1c2027] text-neutral-300 border border-neutral-700/60">
                                  👁️ Просмотр
                                </span>
                              )}
                              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-600/50">
                                +{taskReward} PTS
                              </span>
                            </div>
                          </div>

                          {/* Информационные подсказки по типу задачи */}
                          {isMulti && (
                            <div className="text-[11px] text-neutral-300 bg-violet-950/30 border border-violet-800/30 p-2 rounded-lg flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <span>📚</span>
                                <span>Просмотр последних 3 постов в канале {task.postIds ? `(#${task.postIds.join(', #')})` : ''}</span>
                              </span>
                            </div>
                          )}

                          {isComment && (
                            <div className="text-[11px] text-neutral-300 bg-blue-950/30 border border-blue-800/30 p-2 rounded-lg flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <span>💬</span>
                                <span>Оставьте органичный комментарий к публикации</span>
                              </span>
                            </div>
                          )}

                          {/* Мульти-просмотр: быстрые ссылки по отдельным постам */}
                          {isMulti && task.postUrls && task.postUrls.length > 1 && (
                            <div className="flex gap-1.5 justify-between">
                              {task.postUrls.map((url, idx) => (
                                <button
                                  key={url}
                                  type="button"
                                  onClick={() => handleOpenMultiPostInTelegram(task, url)}
                                  className="flex-1 py-1 px-1.5 rounded-lg bg-[#1e2330] hover:bg-[#252b3b] text-neutral-300 text-[10px] border border-[#2e3648] min-h-[34px] touch-manipulation font-mono truncate"
                                >
                                  Пост {task.postIds ? `#${task.postIds[idx]}` : `#${idx + 1}`}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* ИИ-генератор комментариев для SMART_COMMENT */}
                          {isComment && (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => handleGenerateSmartComments(task)}
                                disabled={generatingCommentTaskId === task.taskId}
                                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600/30 to-violet-600/30 hover:from-blue-600/40 hover:to-violet-600/40 border border-blue-500/40 text-blue-300 font-medium text-xs flex items-center justify-center gap-1.5 min-h-[40px] active:scale-[0.98] transition-all touch-manipulation"
                              >
                                <span>{generatingCommentTaskId === task.taskId ? '⏳' : '✨'}</span>
                                <span>
                                  {generatingCommentTaskId === task.taskId
                                    ? 'OmniAI генерирует варианты...'
                                    : '✨ Сгенерировать комментарий по теме'}
                                </span>
                              </button>

                              {taskComments[task.taskId] && taskComments[task.taskId].length > 0 && (
                                <div className="p-2.5 rounded-xl bg-[#101216] border border-blue-500/30 space-y-2">
                                  <div className="text-[11px] text-neutral-400 font-medium flex items-center justify-between">
                                    <span>🎯 Варианты комментариев:</span>
                                    <span className="text-blue-400 text-[10px]">Кликните для копирования</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    {taskComments[task.taskId].map((commentText, cIdx) => {
                                      const isCopied = copiedCommentKey === `${task.taskId}_${cIdx}`;
                                      return (
                                        <div
                                          key={cIdx}
                                          onClick={() => handleCopyComment(task.taskId, cIdx, commentText)}
                                          className={`p-2 rounded-lg text-xs leading-relaxed cursor-pointer border transition-all flex items-center justify-between gap-2 ${
                                            isCopied
                                              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                                              : 'bg-[#16181d] border-neutral-800 hover:border-blue-500/50 text-neutral-200'
                                          }`}
                                        >
                                          <span className="flex-1">{commentText}</span>
                                          <span className="shrink-0 px-2 py-1 rounded bg-[#23272f] text-[10px] font-semibold text-neutral-300">
                                            {isCopied ? '✅ Скопировано!' : '📋 Копировать'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Интерактивная кнопка действия */}
                          {!isOpened ? (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => handleOpenPostInTelegram(task)}
                                className="w-full h-11 rounded-xl bg-[#0080ff] hover:bg-[#0070ee] active:bg-[#0060df] text-white font-bold text-xs md:text-sm shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] touch-manipulation"
                              >
                                <span className="text-sm">👉</span>
                                <span>
                                  {isMulti
                                    ? `Открыть 3 поста в Telegram (+${taskReward} PTS)`
                                    : `Открыть пост в Telegram (+${taskReward} PTS)`}
                                </span>
                              </button>

                              {/* Быстрые действия: Пропуск / Уже смотрел / Мой пост */}
                              <div className="grid grid-cols-3 gap-2 pt-0.5 w-full">
                                <button
                                  type="button"
                                  onClick={() => handleSkipTask(task, 'ALREADY_VIEWED')}
                                  disabled={skippingTaskId === task.taskId}
                                  className="w-full h-10 px-1 rounded-xl bg-[#1e2330] hover:bg-[#252b3b] border border-[#2e3648] text-neutral-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 touch-manipulation transition-all active:scale-[0.98] whitespace-nowrap overflow-hidden"
                                  title="Я уже смотрел этот пост ранее"
                                >
                                  <span className="shrink-0 text-sm">👁️</span>
                                  <span className="truncate">Смотрел</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSkipTask(task, 'OWN_POST')}
                                  disabled={skippingTaskId === task.taskId}
                                  className="w-full h-10 px-1 rounded-xl bg-[#1e2330] hover:bg-[#252b3b] border border-[#2e3648] text-neutral-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 touch-manipulation transition-all active:scale-[0.98] whitespace-nowrap overflow-hidden"
                                  title="Это мой канал или мой пост"
                                >
                                  <span className="shrink-0 text-sm">👤</span>
                                  <span className="truncate">Мой пост</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSkipTask(task, 'USER_SKIP')}
                                  disabled={skippingTaskId === task.taskId}
                                  className="w-full h-10 px-1 rounded-xl bg-[#1e2330] hover:bg-[#252b3b] border border-[#2e3648] text-neutral-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 touch-manipulation transition-all active:scale-[0.98] whitespace-nowrap overflow-hidden"
                                  title="Пропустить задание"
                                >
                                  <span className="shrink-0 text-sm">⏭️</span>
                                  <span className="truncate">Пропуск</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <button
                                type="button"
                                onClick={() => handleVerifyAndClaimTask(task)}
                                disabled={isVerifying}
                                className="w-full h-11 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white font-bold text-xs md:text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] touch-manipulation animate-pulse"
                              >
                                <span>{isVerifying ? '⏳' : '✅'}</span>
                                <span>
                                  {isVerifying ? 'Проверяем выполнение...' : `Проверить и забрать +${taskReward} PTS`}
                                </span>
                              </button>
                              <div className="grid grid-cols-2 gap-2 pt-0.5 w-full">
                                <button
                                  type="button"
                                  onClick={() => handleOpenPostInTelegram(task)}
                                  className="w-full h-9 px-2 rounded-xl bg-[#1e2330] hover:bg-[#252b3b] border border-[#2e3648] text-neutral-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1 touch-manipulation transition-all"
                                >
                                  <span>🔄</span>
                                  <span>Открыть повторно</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSkipTask(task, 'ALREADY_VIEWED')}
                                  disabled={skippingTaskId === task.taskId}
                                  className="w-full h-9 px-2 rounded-xl bg-[#1e2330] hover:bg-[#252b3b] border border-[#2e3648] text-neutral-300 hover:text-rose-400 text-[11px] font-medium flex items-center justify-center gap-1 touch-manipulation transition-all"
                                >
                                  <span>⏭️</span>
                                  <span>Заменить</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Статус проверки / начисления */}
                          {feedback && (
                            <div
                              className={`p-2.5 rounded-xl text-xs space-y-2 ${
                                feedback.success
                                  ? 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-semibold text-center'
                                  : 'bg-rose-950/80 border border-rose-700/60 text-rose-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span>{feedback.message}</span>
                              </div>
                              {!feedback.success && (
                                <button
                                  type="button"
                                  onClick={() => handleSkipTask(task, 'EXPIRED')}
                                  disabled={skippingTaskId === task.taskId}
                                  className="w-full py-2 px-3 rounded-lg bg-rose-900/50 hover:bg-rose-900/80 border border-rose-500/50 text-rose-100 font-semibold text-xs flex items-center justify-center gap-1.5 min-h-[40px] shadow transition-all active:scale-[0.98] touch-manipulation"
                                >
                                  <span>🔄</span>
                                  <span>Заменить зависшее задание на новое</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : feedTasks.length > 0 && filteredFeedTasks.length === 0 ? (
                  /* Пустая категория при наличии других заданий */
                  <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/60 text-center space-y-1.5">
                    <span className="text-xl block">🔍</span>
                    <p className="text-xs font-semibold text-neutral-300">
                      Нет доступных заданий в этой категории
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Попробуйте выбрать категорию «Все» или обновите ленту.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFeedFilterCategory('ALL')}
                      className="mt-1 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-200 text-xs font-medium hover:bg-neutral-700 transition-colors touch-manipulation min-h-[34px]"
                    >
                      Показать все ({feedTasks.length})
                    </button>
                  </div>
                ) : (
                  /* Пустая очередь заданий */
                  <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/60 text-center space-y-2">
                    <span className="text-2xl block">📭</span>
                    <p className="text-xs font-semibold text-neutral-300">
                      В очереди пока нет заданий
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Вы выполнили все доступные задания или очередь пуста — создайте своё первое задание ниже!
                    </p>
                    <div className="flex gap-2 justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => loadCommunityFeed(nodeId)}
                        className="py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium min-h-[40px] inline-flex items-center gap-1.5 transition-all touch-manipulation"
                      >
                        <span>🔄</span>
                        <span>Проверить снова</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBoostPanel(true)}
                        className="py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs min-h-[40px] inline-flex items-center gap-1.5 shadow active:scale-95 transition-all touch-manipulation"
                      >
                        <span>🚀</span>
                        <span>Создать буст</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Содержимое вкладки: ЗАВЕРШЕННЫЕ */}
            {feedViewTab === 'COMPLETED' && (
              <>
                {filteredCompletedTasks.length > 0 ? (
                  <div className="space-y-2">
                    {filteredCompletedTasks.map((item) => {
                      const isMulti = item.type === 'MULTI_POST';
                      const isComment = item.type === 'SMART_COMMENT';
                      const isReact = item.type.startsWith('REACT_POST');
                      return (
                        <div
                          key={`${item.taskId}_${item.completedAt}`}
                          className="p-3.5 bg-[#12141a] border border-neutral-800/80 rounded-2xl space-y-2.5 hover:border-neutral-700/80 transition-all shadow-sm"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-medium text-neutral-200">
                              <span className="text-emerald-400 font-bold">✅</span>
                              <span className="text-[#38bdf8] font-bold text-sm tracking-tight">@{item.channel}</span>
                              {item.postId && (
                                <span className="text-neutral-500 text-xs font-mono">#{item.postId}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-neutral-400">
                                {formatRelativeTime(item.completedAt)}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                +{item.earnedReward} PTS
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-0.5">
                            <span className="flex items-center gap-1">
                              {isMulti ? (
                                <span className="text-violet-300">📚 3 поста</span>
                              ) : isComment ? (
                                <span className="text-blue-300">💬 Комментарий</span>
                              ) : isReact ? (
                                <span>{item.reactionEmoji || '🔥'} Реакция</span>
                              ) : (
                                <span>👁 Просмотр</span>
                              )}
                              <span className="text-neutral-600">•</span>
                              <span className="text-emerald-400/90 font-medium">Награда получена</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const tg = getTg();
                                if (tg?.openTelegramLink) tg.openTelegramLink(item.postUrl);
                                else window.open(item.postUrl, '_blank');
                              }}
                              className="text-neutral-400 hover:text-white underline text-[10px] touch-manipulation min-h-[30px] flex items-center gap-0.5"
                            >
                              <span>Пост в TG</span>
                              <span>↗</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {completedFeedTasks.length > 0 && (
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCompletedFeedTasks([]);
                            completedTaskIdsRef.current.clear();
                            completedTargetKeysRef.current.clear();
                            try {
                              if (typeof window !== 'undefined' && nodeId) {
                                localStorage.removeItem(`depin_completed_${nodeId}`);
                              }
                            } catch {
                              // ignore
                            }
                            if (nodeId) {
                              void loadCommunityFeed(nodeId);
                            }
                          }}
                          className="text-[10px] text-neutral-500 hover:text-rose-400 underline touch-manipulation py-1 transition-colors min-h-[30px]"
                        >
                          🗑️ Сбросить выполненные
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            skippedTaskIdsRef.current.clear();
                            skippedTargetKeysRef.current.clear();
                            try {
                              if (typeof window !== 'undefined' && nodeId) {
                                localStorage.removeItem(`depin_skipped_${nodeId}`);
                              }
                            } catch {
                              // ignore
                            }
                            setSkipToast('✨ История пропущенных заданий очищена');
                            setTimeout(() => setSkipToast(null), 3000);
                            if (nodeId) {
                              void loadCommunityFeed(nodeId);
                            }
                          }}
                          className="text-[10px] text-neutral-500 hover:text-cyan-400 underline touch-manipulation py-1 transition-colors min-h-[30px]"
                        >
                          🔄 Сбросить пропущенные
                        </button>
                      </div>
                    )}
                  </div>
                ) : completedFeedTasks.length > 0 && filteredCompletedTasks.length === 0 ? (
                  <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/60 text-center space-y-1.5">
                    <span className="text-xl block">🔍</span>
                    <p className="text-xs font-semibold text-neutral-300">
                      Нет выполненных заданий в этой категории
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Переключитесь на «Все», чтобы увидеть всю историю выполненных заданий.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFeedFilterCategory('ALL')}
                      className="mt-1 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-200 text-xs font-medium hover:bg-neutral-700 transition-colors touch-manipulation min-h-[34px]"
                    >
                      Показать все ({completedFeedTasks.length})
                    </button>
                  </div>
                ) : (
                  <div className="p-5 rounded-xl bg-neutral-950/60 border border-neutral-800/60 text-center space-y-2">
                    <span className="text-2xl block">🎯</span>
                    <p className="text-xs font-semibold text-neutral-300">
                      У вас пока нет выполненных заданий
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Выполняйте задания во вкладке «Доступные» — за каждое вы получите от +10 до +35 PTS!
                    </p>
                    <button
                      type="button"
                      onClick={() => setFeedViewTab('AVAILABLE')}
                      className="mt-2 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs min-h-[40px] inline-flex items-center gap-1.5 shadow transition-all touch-manipulation"
                    >
                      <span>🔥</span>
                      <span>Перейти к доступным заданиям</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Быстрый апселл SMMplan (Просмотры от 39 ₽) ── */}
          <div className="w-full p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-orange-500/10 border border-amber-500/30 rounded-2xl space-y-2 shadow-sm shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <span className="text-xs font-bold text-amber-300">Не хотите выполнять задания руками?</span>
              </div>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                от 39 ₽
              </span>
            </div>
            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Купите 1000 просмотров от 39 ₽ на SMMplan без задержек и выполнения чужих заданий.
            </p>
            <a
              href="https://smmplan.pro/catalog"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow min-h-[44px] active:scale-[0.98] transition-all touch-manipulation"
            >
              <span>🛒</span>
              <span>В каталог SMMplan (от 39 ₽)</span>
              <span>→</span>
            </a>
          </div>

          {/* ── P2P Буст своего канала ────────────────────────────────────── */}
          <div className="w-full shrink-0">
            {!showBoostPanel ? (
              <button
                type="button"
                onClick={() => setShowBoostPanel(true)}
                className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 transition-all active:scale-[0.98] min-h-[44px] touch-manipulation"
              >
                <span>🚀</span>
                <span>Продвинуть свой канал за очки</span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">P2P</span>
              </button>
            ) : (
              <form onSubmit={handleCreateP2PBoost} className="p-4 bg-[#16181d] border border-violet-800/40 rounded-2xl space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🚀</span>
                    <span className="text-xs font-semibold text-white">Взаимный буст поста</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBoostPanel(false)}
                    className="text-neutral-400 hover:text-white text-xs w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-neutral-800 transition-colors"
                    aria-label="Закрыть"
                  >
                    ✕
                  </button>
                </div>

                {/* Выбор типа буста */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBoostType('VIEW')}
                    className={`py-2 px-2 text-xs rounded-xl border transition-all min-h-[40px] flex items-center justify-center ${
                      boostType === 'VIEW'
                        ? 'bg-violet-600 text-white border-violet-500 font-semibold shadow-sm'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                  >
                    👁 Просмотр (2 PTS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoostType('REACT')}
                    className={`py-2 px-2 text-xs rounded-xl border transition-all min-h-[40px] flex items-center justify-center ${
                      boostType === 'REACT'
                        ? 'bg-violet-600 text-white border-violet-500 font-semibold shadow-sm'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                  >
                    🔥 Реакция (5 PTS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoostType('MULTI_POST')}
                    className={`py-2 px-2 text-xs rounded-xl border transition-all min-h-[40px] flex items-center justify-center ${
                      boostType === 'MULTI_POST'
                        ? 'bg-violet-600 text-white border-violet-500 font-semibold shadow-sm'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                  >
                    📚 3 поста (5 PTS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoostType('SMART_COMMENT')}
                    className={`py-2 px-2 text-xs rounded-xl border transition-all min-h-[40px] flex items-center justify-center ${
                      boostType === 'SMART_COMMENT'
                        ? 'bg-violet-600 text-white border-violet-500 font-semibold shadow-sm'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                  >
                    💬 Комментарий (15 PTS)
                  </button>
                </div>

                {/* Выбор эмодзи если выбраны реакции */}
                {boostType === 'REACT' && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-neutral-400">Выберите конкретную реакцию:</p>
                    <div className="flex gap-1.5 justify-between">
                      {['🔥', '❤️', '👍', '🎉', '👏', '💩'].map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setBoostReactionEmoji(em)}
                          className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-lg transition-transform touch-manipulation ${
                            boostReactionEmoji === em
                              ? 'bg-amber-500/20 border-2 border-amber-400 scale-105 shadow-sm'
                              : 'bg-neutral-800 border border-neutral-700 opacity-60 hover:opacity-100'
                          }`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Пояснение для типов MULTI_POST и SMART_COMMENT */}
                {boostType === 'MULTI_POST' && (
                  <p className="text-[11px] text-violet-300/90 bg-violet-950/40 p-2 rounded-xl border border-violet-800/40">
                    📚 Пользователи сети DePIN просмотрят этот пост и 2 предыдущих в канале для естественной глубины просмотра.
                  </p>
                )}
                {boostType === 'SMART_COMMENT' && (
                  <p className="text-[11px] text-blue-300/90 bg-blue-950/40 p-2 rounded-xl border border-blue-800/40">
                    💬 Участники DePIN оставят осмысленные комментарии по теме публикации (генерация через Gemini 3 Flash).
                  </p>
                )}

                {/* Поле ввода ссылки */}
                <div className="space-y-1">
                  <input
                    type="url"
                    placeholder="https://t.me/channel/123"
                    value={boostPostUrl}
                    onChange={(e) => setBoostPostUrl(e.target.value)}
                    required
                    className="w-full py-2.5 px-3 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 min-h-[42px]"
                  />
                </div>

                {/* Выбор количества */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400 text-[11px]">Количество:</span>
                  <div className="flex gap-1.5">
                    {[10, 25, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBoostCount(amt)}
                        className={`px-3 py-1.5 min-h-[36px] rounded-lg text-[11px] border touch-manipulation ${
                          boostCount === amt
                            ? 'bg-white text-black font-bold border-white shadow-sm'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Итоговая стоимость и кнопка отправки */}
                {(() => {
                  const p2pUnitCost =
                    boostType === 'SMART_COMMENT'
                      ? 15
                      : boostType === 'REACT' || boostType === 'MULTI_POST'
                      ? 5
                      : 2;
                  const p2pTotalCost = boostCount * p2pUnitCost;

                  return (
                    <div className="pt-2 flex items-center justify-between gap-3 border-t border-neutral-800/80">
                      <div className="text-[11px] text-neutral-400">
                        Итого: <span className="text-white font-bold text-xs">{p2pTotalCost} PTS</span>
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmittingBoost || credits < p2pTotalCost}
                        className="min-h-[44px] py-2 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs transition-all shadow-md active:scale-95 touch-manipulation"
                      >
                        {isSubmittingBoost ? 'Запуск...' : 'Запустить буст'}
                      </button>
                    </div>
                  );
                })()}

                {/* Статусные сообщения + кнопка Friends Squad */}
                {boostStatusMessage && (
                  <div className={`p-3 rounded-xl text-xs space-y-2.5 ${
                    boostStatusMessage.type === 'success'
                      ? 'bg-emerald-950/70 border border-emerald-700/60 text-emerald-300'
                      : 'bg-rose-950/70 border border-rose-700/60 text-rose-300'
                  }`}>
                    <div>{boostStatusMessage.text}</div>
                    {boostStatusMessage.type === 'success' && lastCreatedTargetId && (
                      <button
                        type="button"
                        onClick={() => handleShareSquadPost(lastCreatedTargetId, lastCreatedPostUrl || boostPostUrl)}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow min-h-[44px] active:scale-95 touch-manipulation"
                      >
                        <span>🤝</span>
                        <span>Попросить друзей поддержать пост</span>
                      </button>
                    )}
                  </div>
                )}
              </form>
            )}
          </div>

          {/* ── Вирусный реферальный модуль «Пригласить друга» ── */}
          <div className="w-full p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl space-y-2.5 shadow-sm shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">👥</span>
                <div>
                  <h4 className="text-xs font-semibold text-white">Приглашай друзей в DePIN</h4>
                  <p className="text-[10px] text-neutral-400">+100 PTS за друга • 10% роялти навсегда</p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                +100 PTS
              </span>
            </div>

            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Друг сразу получает <span className="text-amber-400 font-bold">+50 PTS</span> на первый буст своего канала. Вы получаете <span className="text-emerald-400 font-bold">+100 PTS</span> после его первых 20 тапов и <span className="text-cyan-400 font-bold">10%</span> от всех его выполненных задач!
            </p>

            {referralStats && (
              <div className="grid grid-cols-3 gap-2 py-1">
                <div className="bg-neutral-950/60 p-2 rounded-xl border border-neutral-800/60 text-center">
                  <span className="text-[10px] text-neutral-500 block">Друзей</span>
                  <span className="text-xs font-bold text-white tabular-nums">{referralStats.totalInvited}</span>
                </div>
                <div className="bg-neutral-950/60 p-2 rounded-xl border border-neutral-800/60 text-center">
                  <span className="text-[10px] text-neutral-500 block">Активных</span>
                  <span className="text-xs font-bold text-emerald-400 tabular-nums">{referralStats.qualifiedFriends}</span>
                </div>
                <div className="bg-neutral-950/60 p-2 rounded-xl border border-neutral-800/60 text-center">
                  <span className="text-[10px] text-neutral-500 block">Доход</span>
                  <span className="text-xs font-bold text-amber-400 tabular-nums">+{referralStats.earnedBonusCredits + referralStats.earnedRoyaltyCredits} PTS</span>
                </div>
              </div>
            )}

            <div className="pt-1 flex gap-2">
              <button
                type="button"
                onClick={handleShareWithFriend}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow min-h-[44px] active:scale-98 touch-manipulation"
              >
                <span>🚀</span>
                <span>Поделиться с другом</span>
              </button>
              <button
                type="button"
                onClick={handleCopyReferralLink}
                className="px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-xs flex items-center justify-center min-h-[44px] min-w-[44px] transition-colors touch-manipulation"
                title="Копировать ссылку"
              >
                {copiedRefLink ? '✅' : '📋'}
              </button>
            </div>
          </div>

          {/* ── Бонусный кликер энергии (Тап-геймификация) ── */}
          <div className="w-full p-4 bg-neutral-900/90 border border-neutral-800 rounded-2xl flex flex-col items-center space-y-4 shadow-sm shrink-0">
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🪙</span>
                <div>
                  <h4 className="text-xs font-semibold text-white">Бонусный кликер энергии</h4>
                  <p className="text-[10px] text-neutral-400">Тапайте монету для бонуса • +1 PTS за клик</p>
                </div>
              </div>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                +1 PTS
              </span>
            </div>

            {/* Анимированная монетка */}
            <div className="relative flex items-center justify-center my-2">
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
                <div className="pulse-ring absolute w-40 h-40 rounded-full border-2 border-amber-400/60" />
              )}

              <button
                type="button"
                onClick={handleCoinTap}
                disabled={energy < ENERGY_PER_TAP}
                className={`w-36 h-36 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500
                  shadow-2xl shadow-amber-500/40 active:shadow-amber-500/20
                  flex items-center justify-center text-6xl select-none
                  transition-transform duration-75 border-4 border-amber-300/40
                  disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation
                  ${isCoinAnim ? 'coin-tap' : ''}
                `}
                aria-label="Тапнуть бонусную монету"
              >
                Ω
              </button>
            </div>

            {/* Шкала энергии */}
            <div className="w-full space-y-1.5">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>⚡ Энергия</span>
                <span className="tabular-nums font-mono text-neutral-300">{energy} / {ENERGY_MAX}</span>
              </div>
              <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700/50">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300 rounded-full"
                  style={{ width: `${(energy / ENERGY_MAX) * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-neutral-500 text-center">
                +2 энергии в секунду • Накопленные тапы синхронизируются с базой
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          Вкладка 2: AI Чат
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ai' && (
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col min-h-[calc(100dvh-120px)]">
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
        <main className="w-full max-w-md mx-auto px-4 py-4 space-y-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
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
        </main>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          Вкладка 4: Настройки — типы задач DePIN-узла
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'settings' && (
        <main className="w-full max-w-md mx-auto px-4 py-4 space-y-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">

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

          {/* Тоггл 2: Реакции с интерактивным выбором эмодзи */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
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
                      await updateNodePreferencesAction({
                        nodeId,
                        acceptsReactTasks: val,
                        allowedReactions,
                        hasTelegramPremium,
                      });
                    }}
                  />
                  <div className="w-11 h-6 bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>
            </div>

            {/* Селектор разрешенных эмодзи */}
            {acceptsReactTasks && (
              <div className="pt-2.5 border-t border-neutral-800/80 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Какие реакции ставить:</span>
                  <span className="text-emerald-400 font-semibold">{allowedReactions.length} выбрано</span>
                </div>
                <div className="flex gap-2 justify-between">
                  {['👍', '❤️', '🔥', '🎉', '👏', '💩'].map((em) => {
                    const isSelected = allowedReactions.includes(em);
                    return (
                      <button
                        key={em}
                        type="button"
                        onClick={async () => {
                          const next = isSelected
                            ? allowedReactions.filter((r) => r !== em)
                            : [...allowedReactions, em];
                          if (next.length === 0) return; // минимум 1 реакция
                          setAllowedReactions(next);
                          await updateNodePreferencesAction({
                            nodeId,
                            acceptsReactTasks,
                            allowedReactions: next,
                            hasTelegramPremium,
                          });
                        }}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-transform ${
                          isSelected
                            ? 'bg-neutral-800 border-2 border-emerald-400 scale-105 shadow-sm'
                            : 'bg-neutral-950 border border-neutral-800 opacity-40 hover:opacity-80'
                        }`}
                      >
                        {em}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Тоггл 2.5: Telegram Premium статус */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-purple-900/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-2xl shrink-0">⭐</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-100">Telegram Premium</p>
                <p className="text-[11px] text-purple-300/80 truncate">~2% риска • +25 кредитов / задание</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-bold text-purple-400">+25 кр.</span>
              <label className="relative inline-flex items-center cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={hasTelegramPremium}
                  className="sr-only peer"
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setHasTelegramPremium(val); // optimistic
                    await updateNodePreferencesAction({
                      nodeId,
                      acceptsReactTasks,
                      allowedReactions,
                      hasTelegramPremium: val,
                    });
                  }}
                />
                <div className="w-11 h-6 bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
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
        </main>
      )}

      </div>
    </div>
  );
}
