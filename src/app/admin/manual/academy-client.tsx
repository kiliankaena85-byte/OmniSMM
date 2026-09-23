'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  GraduationCap, 
  Gamepad2, 
  BookOpen, 
  Sparkles, 
  ShieldCheck, 
  Copy, 
  Check, 
  AlertTriangle, 
  ArrowRight, 
  RotateCcw, 
  Search, 
  ExternalLink,
  Zap,
  Award,
  ArrowLeft,
  Compass,
  Calculator,
  UserCheck,
  TrendingUp,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  SUPPORT_SCENARIOS, 
  SUPPORT_CHEAT_SHEETS, 
  DifficultyLevel,
  ScenarioCategory
} from '@/data/support-training-scenarios';
import { InteractiveTextbook } from '@/components/admin/manual/interactive-textbook';

interface AcademyClientProps {
  manualHtml: string;
  supportManualHtml?: string;
  sidebarItems: { id: string; title: string; level: number }[];
}

export function AcademyClient({ manualHtml, supportManualHtml, sidebarItems }: AcademyClientProps) {
  // Navigation Modes: SHIFT (на смене) vs LEARN (обучение)
  const [activeMode, setActiveMode] = useState<'SHIFT' | 'LEARN'>('LEARN');
  const [activeTab, setActiveTab] = useState<'simulator' | 'matrix' | 'cheatsheet' | 'handbook' | 'exam' | 'tech_db' | 'tech_analyzer' | 'tech_services' | 'tech_buttons' | 'tech_queues' | 'tech_multitenant' | 'tech_settings'>('handbook');
  const [manualPresentationMode, setManualPresentationMode] = useState<'INTERACTIVE' | 'TEXT'>('INTERACTIVE');
  const [selectedManualType, setSelectedManualType] = useState<'admin' | 'support'>('admin');
  const [buttonSearch, setButtonSearch] = useState('');
  const [handbookSearch, setHandbookSearch] = useState('');
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [showDay1Sos, setShowDay1Sos] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Simulator State
  const [activeCategory, setActiveCategory] = useState<ScenarioCategory | 'ALL'>('ALL');
  const [activeDifficulty, setActiveDifficulty] = useState<DifficultyLevel | 'ALL'>('ALL');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(SUPPORT_SCENARIOS[0].id);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isEvaluated, setIsEvaluated] = useState(false);
  const [completedScenarios, setCompletedScenarios] = useState<Record<string, number>>({});
  
  // Decision Matrix State
  const [matrixLtv, setMatrixLtv] = useState<'NOVICE' | 'REGULAR' | 'VIP' | 'ABUSER'>('NOVICE');
  const [matrixRefill, setMatrixRefill] = useState<'NO_REFILL' | 'REFILL'>('NO_REFILL');
  const [matrixIssue, setMatrixIssue] = useState<'DROP' | 'STUCK' | 'COUNTER_LAG' | 'WRONG_LINK' | 'PRIVATE'>('DROP');

  // Cheat Sheet State
  const [cheatSearch, setCheatSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Exam State
  const [examStep, setExamStep] = useState(0);
  const [examAnswers, setExamAnswers] = useState<Record<number, string>>({});
  const [examFinished, setExamFinished] = useState(false);

  const activeScenario = SUPPORT_SCENARIOS.find(s => s.id === selectedScenarioId) || SUPPORT_SCENARIOS[0];

  const filteredScenarios = SUPPORT_SCENARIOS.filter(s => {
    if (activeCategory !== 'ALL' && s.category !== activeCategory) return false;
    if (activeDifficulty !== 'ALL' && s.difficulty !== activeDifficulty) return false;
    return true;
  });

  const totalScore = Object.values(completedScenarios).reduce((a, b) => a + b, 0);
  const maxPossibleScore = SUPPORT_SCENARIOS.length * 100;
  const progressPercent = Math.round((Object.keys(completedScenarios).length / SUPPORT_SCENARIOS.length) * 100);

  // Global search matching (Scenarios + Cheatsheets)
  const globalMatches = globalSearch.trim().length > 1 ? {
    cheats: SUPPORT_CHEAT_SHEETS.flatMap(c => c.items.filter(i => 
      i.title.toLowerCase().includes(globalSearch.toLowerCase()) || 
      i.situation.toLowerCase().includes(globalSearch.toLowerCase()) ||
      i.script.toLowerCase().includes(globalSearch.toLowerCase())
    ).map(i => ({ ...i, categoryTitle: c.category }))),
    scenarios: SUPPORT_SCENARIOS.filter(s => 
      s.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
      s.clientMessage.toLowerCase().includes(globalSearch.toLowerCase())
    )
  } : null;

  const handleOptionSelect = (optionId: string) => {
    if (isEvaluated) return;
    setSelectedOptionId(optionId);
  };

  const handleEvaluate = () => {
    if (!selectedOptionId) {
      toast.error('Выберите один из вариантов ответа');
      return;
    }
    const chosen = activeScenario.options.find(o => o.id === selectedOptionId);
    if (!chosen) return;

    setIsEvaluated(true);
    setCompletedScenarios(prev => ({
      ...prev,
      [activeScenario.id]: Math.max(prev[activeScenario.id] || 0, chosen.score)
    }));

    if (chosen.isCorrect) {
      toast.success(`🎉 Отлично! +${chosen.score} XP`);
    } else {
      toast.error(`⚠️ Ответ содержит риски. Оценка: ${chosen.score}/100 XP`);
    }
  };

  const handleResetScenario = () => {
    setSelectedOptionId(null);
    setIsEvaluated(false);
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success('Текст ответа скопирован в буфер!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Не удалось скопировать текст');
    }
  };

  // Switch Mode handler
  const handleModeSwitch = (mode: 'SHIFT' | 'LEARN') => {
    setActiveMode(mode);
    if (mode === 'SHIFT') {
      setActiveTab('cheatsheet');
    } else {
      setActiveTab('simulator');
    }
  };

  // Exam Questions generated from scenarios
  const examScenarios = SUPPORT_SCENARIOS.slice(0, 5);
  const currentExamScenario = examScenarios[examStep];

  const handleExamOption = (optId: string) => {
    setExamAnswers(prev => ({ ...prev, [examStep]: optId }));
  };

  const handleNextExamQuestion = () => {
    if (!examAnswers[examStep]) {
      toast.error('Выберите ответ перед переходом');
      return;
    }
    if (examStep < examScenarios.length - 1) {
      setExamStep(prev => prev + 1);
    } else {
      setExamFinished(true);
    }
  };

  const calculateExamResult = () => {
    let earned = 0;
    examScenarios.forEach((sc, idx) => {
      const ansId = examAnswers[idx];
      const opt = sc.options.find(o => o.id === ansId);
      if (opt?.isCorrect) earned += 1;
    });
    return { earned, total: examScenarios.length, percent: Math.round((earned / examScenarios.length) * 100) };
  };

  // Dynamic Decision Matrix Recommendation Logic
  const getMatrixRecommendation = () => {
    if (matrixIssue === 'WRONG_LINK' || matrixIssue === 'PRIVATE') {
      return {
        action: 'Объяснить техническую причину + авто-возврат на баланс',
        policy: 'Техническая ошибка настроек клиента. Деньги в безопасности на балансе.',
        script: '«Здравствуйте! Заказ был автоматически отменен из-за неверного формата ссылки / закрытого профиля. Вся сумма уже в полном объеме вернулась на ваш баланс. Откройте профиль / укажите корректную ссылку и запустите заказ заново с баланса в 1 клик!»',
        badge: '100% Авто-рефанд в ЛК',
        badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
      };
    }

    if (matrixIssue === 'COUNTER_LAG') {
      return {
        action: 'Проверить startCount + объяснить кэширование счетчика',
        policy: 'Провайдер выполнил заказ. Задержка обновления в клиенте Telegram/Instagram.',
        script: '«Здравствуйте! Мы проверили: провайдер успешно выполнил заказ (стартовый счетчик был X, доставлено Y). В мобильных клиентах счетчик обновляется с задержкой в 5–15 минут. Пожалуйста, перезапустите приложение или проверьте через веб-инкогнито!»',
        badge: 'Без финансовых трат',
        badgeColor: 'bg-primary/10 text-primary border-primary/20'
      };
    }

    if (matrixIssue === 'STUCK') {
      return {
        action: 'Синхронизировать статус API или отменить с авто-возвратом средств',
        policy: 'Зависание на стороне оптового провайдера. Отмена через WalletOps.',
        script: '«Здравствуйте! Из-за перегрузки серверов поставщика запуск задержался. Мы отменили заказ, вся сумма уже вернулась на ваш баланс. Вы можете выбрать альтернативный скоростной тариф прямо из каталога!»',
        badge: '100% Возврат на баланс',
        badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/20'
      };
    }

    // Drop situation (Списания)
    if (matrixRefill === 'REFILL') {
      return {
        action: 'Бесплатная активация Refill (Докрутка в 1 клик)',
        policy: 'Обязательство сервиса по гарантийному тарифу (30–365 дней).',
        script: '«Здравствуйте! Так как вы выбрали тариф с гарантией, мы уже отправили бесплатную команду на докрутку (Refill) провайдеру. Показатели будут автоматически восстановлены в течение 12–24 часов!»',
        badge: 'Гарантийный Refill',
        badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
      };
    }

    // Drop with NO REFILL (Самая сложная развилка!)
    if (matrixLtv === 'NOVICE') {
      return {
        action: 'Goodwill-компенсация: Начислить бонус лояльности (до 150 ₽)',
        policy: 'Удержание новичка для первого позитивного впечатления и перехода на Refill.',
        script: '«Здравствуйте! Этот эконом-тариф не предусматривает гарантии. Однако, так как это ваш первый опыт в нашем сервисе, мы в качестве подарка зачислили 100 ₽ на ваш баланс и рекомендуем стабильную линейку [Гарантия 30 дней Refill]!»',
        badge: 'Goodwill Новичок (+100 ₽)',
        badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20'
      };
    }

    if (matrixLtv === 'VIP' || matrixLtv === 'REGULAR') {
      return {
        action: 'VIP Goodwill: Частичная компенсация 50% + персональная скидка 7%',
        policy: 'Сохранение доходного API-клиента с высоким LTV.',
        script: '«Здравствуйте! Мы ценим сотрудничество с вами. Несмотря на то, что тариф без гарантии, мы в качестве исключения компенсировали 50% на ваш баланс и подключили для вашего аккаунта постоянную скидку 7% на все надежные тарифы с гарантией!»',
        badge: 'VIP Goodwill (50% + Скидка)',
        badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/20'
      };
    }

    // ABUSER
    return {
      action: 'Вежливый, но твердый отказ по п. 4.2 Оферты',
      policy: 'Защита юнит-экономики от потребительского экстремизма.',
      script: '«Здравствуйте! В карточке выбранной вами услуги было явное предупреждение: "Без гарантии / Возможны списания". Заказ был выполнен провайдером по себестоимости. Для гарантированного удержания рекомендуем тарифы с пометкой [Refill].»',
      badge: 'Отказ по Оферте',
      badgeColor: 'bg-rose-500/10 text-rose-600 border-rose-500/20'
    };
  };

  const matrixRec = getMatrixRecommendation();

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 min-h-full pb-12">
      {/* Header & Gamification Bar */}
      <div className="flex flex-col gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> На дашборд
          </Link>

          {/* Gamified XP & Qualification Indicator */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setShowDay1Sos(!showDay1Sos);
                if (!showDay1Sos) setShowQuickGuide(false);
              }}
              className="px-2.5 py-1 text-xs font-bold rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>{showDay1Sos ? 'Скрыть SOS' : '🚨 SOS Первый день'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowQuickGuide(!showQuickGuide);
                if (!showQuickGuide) setShowDay1Sos(false);
              }}
              className="px-2.5 py-1 text-xs font-bold rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{showQuickGuide ? 'Скрыть гид' : '💡 Как пользоваться?'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tech_buttons')}
              className="px-2.5 py-1 text-xs font-bold rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>🔬</span>
              <span>Визуальный Двойник</span>
            </button>

            <a
              href="/manual/OMNISMM_ADMIN_DESK_HANDBOOK_2026.docx"
              download="OMNISMM_ADMIN_DESK_HANDBOOK_2026.docx"
              className="px-2.5 py-1 text-xs font-bold rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center gap-1 cursor-pointer"
              title="Скачать полную настольную книгу администратора в формате Microsoft Word (DOCX) для распечатки"
            >
              <Download className="w-3.5 h-3.5" />
              <span>📄 DOCX для печати</span>
            </a>

            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-400 font-bold text-xs">
              <Award className="w-4 h-4 text-amber-500" />
              <span>{totalScore} / {maxPossibleScore} XP</span>
            </div>

            <div className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
              progressPercent >= 80 
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                : 'bg-muted/60 text-muted-foreground border-border/60'
            }`}>
              {progressPercent >= 80 ? 'Допущен к смене ✅' : `Обучение: ${progressPercent}%`}
            </div>
          </div>
        </div>

        {/* Expandable SOS Day-1 Card */}
        {showDay1Sos && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/5 border border-rose-500/30 shadow-md animate-in slide-in-from-top-2 duration-300 space-y-4">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
              <h3 className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" /> 🚨 SOS-Памятка Новичка: Первый день на смене (3 минуты)
              </h3>
              <span className="text-[10px] px-2 py-0.5 bg-rose-500/10 text-rose-600 rounded-md font-bold">
                Zero-Training Shield
              </span>
            </div>

            <div className="p-3 rounded-xl bg-background/80 border border-rose-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> 🪄 Магическая фраза-таймаут (если вопрос сложный или клиент злится):
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('«Здравствуйте! Взял ваш вопрос в работу. Сейчас поднимаю технические логи серверов по заказу и связываюсь со старшим инженером. Вернусь к вам с детальным решением в течение 10–15 минут!»', 'sos-magic')}
                  className="px-2.5 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copiedId === 'sos-magic' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId === 'sos-magic' ? 'Скопировано!' : 'Скопировать спасительный скрипт'}</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40 leading-relaxed font-sans">
                «Здравствуйте! Взял ваш вопрос в работу. Сейчас поднимаю технические логи серверов по заказу и связываюсь со старшим инженером. Вернусь к вам с детальным решением в течение 10–15 минут!»
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-background/60 border border-border/60 space-y-1">
                <span className="font-bold text-rose-600 dark:text-rose-400 block">❌ 1. Возврат на карту:</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  НИКОГДА не обещайте возврат на карту. Все возвраты — <strong>только на баланс в ЛК</strong> (п. 2 ст. 781 ГК РФ).
                </p>
              </div>
              <div className="p-3 rounded-xl bg-background/60 border border-border/60 space-y-1">
                <span className="font-bold text-rose-600 dark:text-rose-400 block">❌ 2. Пароли в чат:</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  НИКОГДА не пишите пароли («12345678») в открытый чат. Выдавайте только <strong>Magic Link (15 мин)</strong>.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-background/60 border border-border/60 space-y-1">
                <span className="font-bold text-rose-600 dark:text-rose-400 block">❌ 3. Запрещенный сленг:</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Запрещено: «боты», «накрутка», «сервера сдохли». Пишите: «маршрутизация трафика», «очередь серверов».
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Expandable Quick Guide Card */}
        {showQuickGuide && (
          <div className="p-4 rounded-2xl bg-card border border-primary/20 shadow-sm animate-in slide-in-from-top-2 duration-300 space-y-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" /> Экспресс-Гид: Как работать с Академией
              </h3>
              <span className="text-[11px] text-muted-foreground font-medium">Краткая памятка оператора</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> 1. Когда вы НА СМЕНЕ (клиент ждет ответ):
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Используйте строку <strong>«Умного поиска»</strong> выше или вкладку <strong>«Шпаргалка»</strong>. 
                  Для сложных списаний откройте <strong>«Матрицу решений»</strong>. Скопируйте готовый Dual-Core скрипт за 1 клик!
                </p>
              </div>

              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                <div className="font-bold text-primary flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" /> 2. Когда вы ОБУЧАЕТЕСЬ (стажировка):
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Изучите 12 глав в <strong>«Базе знаний»</strong>, решите 20 кейсов в <strong>«Тренажере»</strong> (+XP) 
                  и пройдите <strong>«Экзамен»</strong> (нужно ≥90%), чтобы получить допуск к сменам.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Title & Mode Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-2xl ring-1 ring-primary/20 shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2 flex-wrap">
                Академия саппорта & Помощник оператора
                <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-[10px] font-black uppercase">
                  v4.0 Enterprise
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Готовые скрипты, Матрица Goodwill, регламенты 152-ФЗ / 54-ФЗ и симулятор инцидентов
              </p>
            </div>
          </div>

          {/* TWO PRIMARY MODES: SHIFT (На смене) vs LEARN (Обучение) */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => handleModeSwitch('SHIFT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer select-none ${
                activeMode === 'SHIFT'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>⚡ На смене (Быстрые ответы)</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('LEARN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer select-none ${
                activeMode === 'LEARN'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>🎓 Обучение & Экзамен</span>
            </button>
          </div>
        </div>

        {/* Global Quick Search Bar */}
        <div className="relative w-full">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="🔍 Умный поиск: введите проблему (например: опечатка в почте, закрытый опрос, списания, чек)..."
              className="w-full h-10 pl-10 pr-10 text-xs rounded-xl bg-card border border-border/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-xs"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute right-3 text-xs text-muted-foreground hover:text-foreground font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Search Instant Results Dropdown */}
          {globalMatches && (globalMatches.cheats.length > 0 || globalMatches.scenarios.length > 0) && (
            <div className="absolute top-12 left-0 right-0 z-50 bg-card border border-border rounded-2xl p-4 shadow-xl space-y-3 max-h-96 overflow-y-auto animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-[11px] font-black uppercase text-primary tracking-wider">
                  Найдено совпадений: {globalMatches.cheats.length + globalMatches.scenarios.length}
                </span>
                <span className="text-[10px] text-muted-foreground">Нажмите «Копировать» для вставки в тикет</span>
              </div>

              {globalMatches.cheats.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{item.title}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.script, `gs-${idx}`)}
                      className="px-2.5 py-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === `gs-${idx}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === `gs-${idx}` ? 'Скопировано!' : 'Копировать ответ'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground bg-background/80 p-2 rounded-lg border border-border/40">
                    {item.script}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SUB-TABS NAVIGATION (Filtered by Mode) */}
        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/50 self-start overflow-x-auto w-full sm:w-auto">
          {activeMode === 'SHIFT' ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('cheatsheet')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                  activeTab === 'cheatsheet'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>⚡ Шпаргалка ответов</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                  activeTab === 'matrix'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>🧭 Матрица решений (Goodwill)</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('handbook')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                  activeTab === 'handbook'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>📘 Мастер-Инструкция (18 Экранов)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tech_db')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                  activeTab === 'tech_db'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span>🗄️ Схема Базы Данных</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tech_analyzer')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                  activeTab === 'tech_analyzer'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span>🪄 Анализатор Ссылок</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tech_services')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                  activeTab === 'tech_services'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span>📦 Услуги & Таксономия</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tech_buttons')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                  activeTab === 'tech_buttons'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span>🕹️ Атлас Кнопок</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tech_queues')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                  activeTab === 'tech_queues'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span>⚙️ Очереди BullMQ</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tech_multitenant')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                  activeTab === 'tech_multitenant'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span>🏢 Мульти-Тенант</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tech_settings')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                  activeTab === 'tech_settings'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span>⚙️ Настройки Системы</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('simulator')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                  activeTab === 'simulator'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>🎮 Тренажер ({SUPPORT_SCENARIOS.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('exam')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                  activeTab === 'exam'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>🏆 Аттестация</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: INTERACTIVE CASE SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (4 cols): Scenario Selector */}
          <aside className="lg:col-span-4 space-y-4">
            <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-4 shadow-sm ring-1 ring-border/5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Выберите кейс ({filteredScenarios.length})
                </h3>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 flex-wrap pb-1">
                {(['ALL', 'SECURITY', 'ORDERS', 'FINANCE', 'LEGAL', 'API'] as const).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {cat === 'ALL' ? 'Все' : cat}
                  </button>
                ))}
              </div>

              {/* List of Scenarios */}
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                {filteredScenarios.map(sc => {
                  const isSelected = sc.id === activeScenario.id;
                  const score = completedScenarios[sc.id];
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => {
                        setSelectedScenarioId(sc.id);
                        handleResetScenario();
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer border flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-primary/10 border-primary/40 text-foreground ring-1 ring-primary/20 shadow-2xs'
                          : 'bg-background/40 border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <span className="text-lg">{sc.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold truncate text-foreground">{sc.title}</span>
                          {score !== undefined && (
                            <span className={`text-[10px] font-black font-mono px-1.5 py-0.2 rounded ${
                              score >= 100 ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'
                            }`}>
                              {score} XP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                            sc.difficulty === 'JUNIOR' ? 'bg-emerald-500/10 text-emerald-600' :
                            sc.difficulty === 'MIDDLE' ? 'bg-amber-500/10 text-amber-600' :
                            'bg-rose-500/10 text-rose-600'
                          }`}>
                            {sc.difficulty}
                          </span>
                          <span className="text-muted-foreground font-medium truncate">{sc.category}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Right Column (8 cols): Interactive Simulator Card */}
          <main className="lg:col-span-8 space-y-6">
            <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm ring-1 ring-border/5 space-y-6">
              {/* Scenario Header */}
              <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-4">
                <div className="flex items-start gap-3">
                  <span className="text-3xl p-2 bg-muted/40 rounded-2xl border border-border/50">{activeScenario.icon}</span>
                  <div>
                    <h2 className="text-lg font-black text-foreground tracking-tight">{activeScenario.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{activeScenario.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetScenario}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted border border-border/50 rounded-xl transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Сброс
                </button>
              </div>

              {/* Client Chat Bubble Simulator */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                  💬 Сообщение от клиента в тикете / чате:
                </span>
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 text-foreground text-sm font-medium leading-relaxed">
                  {activeScenario.clientMessage}
                </div>
              </div>

              {/* Context Data Snapshot */}
              <div className="p-3.5 rounded-xl bg-background/50 border border-border/50 text-xs font-mono grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activeScenario.contextData.userEmail && (
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block">Email в базе</span>
                    <span className="font-bold">{activeScenario.contextData.userEmail}</span>
                  </div>
                )}
                {activeScenario.contextData.totalSpentRub !== undefined && (
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block">LTV Клиента</span>
                    <span className="font-bold text-primary">{activeScenario.contextData.totalSpentRub.toFixed(2)} ₽</span>
                  </div>
                )}
                {activeScenario.contextData.balanceRub !== undefined && (
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block">Баланс в ЛК</span>
                    <span className="font-bold text-emerald-600">{activeScenario.contextData.balanceRub.toFixed(2)} ₽</span>
                  </div>
                )}
                {activeScenario.contextData.lastOrder && (
                  <div className="col-span-2">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block">Последний заказ</span>
                    <span className="font-bold">{activeScenario.contextData.lastOrder.service} — Статус: {activeScenario.contextData.lastOrder.status}</span>
                  </div>
                )}
                {activeScenario.contextData.lastPayment && (
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block">Шлюз</span>
                    <span className="font-bold">{activeScenario.contextData.lastPayment.gateway} ({activeScenario.contextData.lastPayment.amountRub} ₽)</span>
                  </div>
                )}
              </div>

              {/* Interactive Options */}
              <div className="space-y-3">
                <span className="text-[11px] uppercase font-bold tracking-wider text-foreground block">
                  👉 Выберите действие оператора поддержки:
                </span>
                <div className="space-y-2.5">
                  {activeScenario.options.map(opt => {
                    const isSelected = selectedOptionId === opt.id;
                    let stateClass = 'bg-background/40 border-border/60 text-foreground hover:bg-muted/40';
                    
                    if (isEvaluated) {
                      if (opt.isCorrect) {
                        stateClass = 'bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-500/30';
                      } else if (isSelected) {
                        stateClass = 'bg-rose-500/15 border-rose-500 text-rose-950 dark:text-rose-200 ring-1 ring-rose-500/30';
                      }
                    } else if (isSelected) {
                      stateClass = 'bg-primary/10 border-primary text-foreground ring-1 ring-primary/30';
                    }

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleOptionSelect(opt.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 select-none ${stateClass}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold mt-0.5 shrink-0 ${
                            isSelected ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                          }`}>
                            {isSelected ? '✓' : ''}
                          </div>
                          <div className="flex-1">
                            <span className="text-xs font-bold block mb-0.5">{opt.label}</span>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{opt.action}</p>
                          </div>
                        </div>

                        {/* Analysis Card if Evaluated */}
                        {isEvaluated && isSelected && (
                          <div className={`p-3 rounded-xl text-xs font-medium mt-2 border ${
                            opt.isCorrect ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                          }`}>
                            <div className="font-bold flex items-center gap-1 mb-1">
                              {opt.isCorrect ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                              Разбор решения ({opt.score}/100 XP):
                            </div>
                            <p className="leading-relaxed">{opt.analysis}</p>
                            {opt.risks && opt.risks.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-border/40 text-[11px] space-y-0.5">
                                <span className="font-bold text-rose-600 block">Предотвращенные риски:</span>
                                {opt.risks.map((r, i) => (
                                  <div key={i}>• {r}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Submit Button */}
              {!isEvaluated ? (
                <button
                  type="button"
                  onClick={handleEvaluate}
                  disabled={!selectedOptionId}
                  className="w-full h-11 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Проверить ответ и разобрать последствия</span>
                </button>
              ) : (
                <div className="space-y-4 pt-2">
                  {/* Ideal Response Script */}
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> Эталонный ответ клиенту (Legal & Marketing Symbiosis):
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeScenario.idealResponseScript, 'ideal-script')}
                        className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                      >
                        {copiedId === 'ideal-script' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === 'ideal-script' ? 'Скопировано!' : 'Копировать'}</span>
                      </button>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                      {activeScenario.idealResponseScript}
                    </pre>
                  </div>

                  {/* Step-by-Step Operator Action Guide */}
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                    <span className="text-xs font-bold text-foreground block">
                      🛠️ Алгоритм действий в админ-панели SMMplan:
                    </span>
                    <ul className="space-y-1 text-xs text-muted-foreground font-medium">
                      {activeScenario.operatorActionSteps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>

                    {/* Relevant Admin Links */}
                    <div className="flex items-center gap-2 pt-2 flex-wrap">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Быстрый переход:</span>
                      {activeScenario.relevantAdminLinks.map((lnk, idx) => (
                        <Link
                          key={idx}
                          href={lnk.href}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-background text-primary border border-border rounded-lg text-xs font-bold hover:bg-muted transition-all"
                        >
                          <span>{lnk.label}</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* TAB 2: DECISION MATRIX & GOODWILL CALCULATOR */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm ring-1 ring-border/5 space-y-6">
            <div>
              <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Compass className="w-5 h-5 text-primary" />
                Интерактивная карта решений: «Услуга БЕЗ гарантии & Списания»
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Выберите вводные данные по клиенту и заказу, чтобы получить юридически и экономически выверенное решение.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-y border-border/50 py-5">
              {/* 1. LTV / Сегмент клиента */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-primary" /> 1. Сегмент клиента (LTV)
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: 'NOVICE', label: '🟢 Новичок (1-й заказ, чек < 300 ₽)' },
                    { id: 'REGULAR', label: '🔵 Постоянный B2C (LTV 1k–5k ₽)' },
                    { id: 'VIP', label: '👑 VIP / Оптовик (LTV > 10 000 ₽)' },
                    { id: 'ABUSER', label: '🔴 Серийный жалобщик / Абузер' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMatrixLtv(item.id as "NOVICE" | "REGULAR" | "VIP" | "ABUSER")}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                        matrixLtv === item.id
                          ? 'bg-primary/10 border-primary text-foreground font-bold ring-1 ring-primary/20'
                          : 'bg-background/40 border-border/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Тип тарифа */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" /> 2. Тариф услуги
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: 'NO_REFILL', label: '⚡ Без гарантии (Эконом, Refill = 0)' },
                    { id: 'REFILL', label: '🛡️ С гарантией (Refill 30–365 дней)' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMatrixRefill(item.id as "NO_REFILL" | "REFILL")}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                        matrixRefill === item.id
                          ? 'bg-primary/10 border-primary text-foreground font-bold ring-1 ring-primary/20'
                          : 'bg-background/40 border-border/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Суть проблемы */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-primary" /> 3. Суть обращения
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: 'DROP', label: '📉 Списались подписчики (Drop)' },
                    { id: 'STUCK', label: '⏳ Заказ завис в очереди (Stuck)' },
                    { id: 'COUNTER_LAG', label: '👁️ Завершен, но не обновилось' },
                    { id: 'WRONG_LINK', label: '🔗 Ошибка в ссылке (Target Type)' },
                    { id: 'PRIVATE', label: '🔒 Закрытый профиль (Private)' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMatrixIssue(item.id as "DROP" | "STUCK" | "COUNTER_LAG" | "WRONG_LINK" | "PRIVATE")}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                        matrixIssue === item.id
                          ? 'bg-primary/10 border-primary text-foreground font-bold ring-1 ring-primary/20'
                          : 'bg-background/40 border-border/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Matrix Output Result Card */}
            <div className="p-5 rounded-2xl bg-muted/30 border border-border/60 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Рекомендованная стратегия:</span>
                  <span className="text-sm font-black text-foreground">{matrixRec.action}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-xl text-xs font-black border uppercase tracking-wider self-start sm:self-auto ${matrixRec.badgeColor}`}>
                  {matrixRec.badge}
                </span>
              </div>

              <div className="text-xs text-muted-foreground font-medium">
                <span className="font-bold text-foreground">Политика регламента: </span>
                {matrixRec.policy}
              </div>

              {/* Ready-to-use Script */}
              <div className="p-4 rounded-xl bg-background border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-primary" /> Готовый скрипт для ответа:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(matrixRec.script, 'matrix-script')}
                    className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  >
                    {copiedId === 'matrix-script' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'matrix-script' ? 'Скопировано!' : 'Копировать'}</span>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                  {matrixRec.script}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: QUICK CHEAT SHEET */}
      {activeTab === 'cheatsheet' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <input
                type="text"
                value={cheatSearch}
                onChange={e => setCheatSearch(e.target.value)}
                placeholder="Поиск скрипта (возврат, списание, чек, очередь)..."
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-border/60 bg-card text-xs font-medium text-foreground outline-none focus:border-primary transition-all"
              />
            </div>
            <span className="text-xs font-bold text-muted-foreground">
              Все шаблоны соответствуют нормам 54-ФЗ / 152-ФЗ
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SUPPORT_CHEAT_SHEETS.map((cat, idx) => {
              const matchingItems = cat.items.filter(it => 
                it.title.toLowerCase().includes(cheatSearch.toLowerCase()) ||
                it.situation.toLowerCase().includes(cheatSearch.toLowerCase()) ||
                it.script.toLowerCase().includes(cheatSearch.toLowerCase())
              );
              if (matchingItems.length === 0) return null;

              return (
                <div key={idx} className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-5 shadow-sm ring-1 ring-border/5 space-y-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/50 pb-3">
                    <Zap className="w-4 h-4 text-primary" />
                    {cat.category}
                  </h3>

                  <div className="space-y-4">
                    {matchingItems.map((item, iIdx) => {
                      const itemKey = `cheat-${idx}-${iIdx}`;
                      return (
                        <div key={iIdx} className="p-3.5 rounded-xl bg-background/50 border border-border/40 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-foreground block">{item.title}</span>
                              <span className="text-[11px] text-muted-foreground">{item.situation}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.script, itemKey)}
                              className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              {copiedId === itemKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedId === itemKey ? 'Скопировано!' : 'Копировать'}</span>
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground font-sans bg-muted/30 p-2.5 rounded-lg border border-border/30 leading-relaxed">
                            {item.script}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: HANDBOOK & CODEBASE ARCHITECTURE */}
      {activeTab === 'handbook' && (
        <div className="space-y-6">
          {/* Main Format Presentation Switcher */}
          <div className="flex items-center justify-between gap-3 flex-wrap bg-card border border-border/80 rounded-2xl p-2.5 shadow-xs">
            <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setManualPresentationMode('INTERACTIVE')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  manualPresentationMode === 'INTERACTIVE'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>🎨 Интерактивный учебник с иллюстрациями</span>
                <span className="px-1.5 py-0.2 rounded bg-background/20 text-[10px]">ГОСТ ЕСПД</span>
              </button>

              <button
                type="button"
                onClick={() => setManualPresentationMode('TEXT')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  manualPresentationMode === 'TEXT'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>📄 Полный текст руководства (Markdown)</span>
              </button>
            </div>

            <span className="text-[11px] text-muted-foreground font-semibold px-2">
              {manualPresentationMode === 'INTERACTIVE'
                ? 'Режим иллюстрированного учебника с диаграммами и скриншотами'
                : 'Режим классического чтения документации'}
            </span>
          </div>

          {manualPresentationMode === 'INTERACTIVE' ? (
            <InteractiveTextbook />
          ) : (
            <div className="space-y-4">
              {/* Top Manual Switcher Bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap bg-card border border-border/80 rounded-2xl p-2 shadow-xs">
                <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setSelectedManualType('admin')}
                    className={`px-3.5 py-1.5 rounded-lg transition-all ${
                      selectedManualType === 'admin'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    📘 Мастер-Руководство OmniSMM 1.0 (Сисадмин & MVP)
                  </button>
                  {supportManualHtml && (
                    <button
                      type="button"
                      onClick={() => setSelectedManualType('support')}
                      className={`px-3.5 py-1.5 rounded-lg transition-all ${
                        selectedManualType === 'support'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      🎓 Академия Саппорта & Политики
                    </button>
                  )}
                </div>

                {/* Section Quick Jump Buttons */}
                {selectedManualType === 'admin' && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold flex-wrap">
                    <a href="#раздел-0-архитектура-и-ключевые-инварианты" className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors">
                      0. Стек
                    </a>
                    <a href="#раздел-1-каталог-услуг-таксономия-и-импорт" className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors">
                      1. Каталог & Услуги
                    </a>
                    <a href="#раздел-2-операционный-центр-и-обработка-заказов" className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors">
                      2. Заказы & Refills
                    </a>
                    <a href="#раздел-3-финансы-54-фз-чеки-и-биллинг" className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors">
                      3. Финансы & 54-ФЗ
                    </a>
                    <a href="#раздел-4-команда-настройки-и-мульти-тенант" className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors">
                      4. Команда & Настройки
                    </a>
                    <a href="#чек-лист-готовности-к-запуску-mvp" className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold transition-colors">
                      🎯 Чек-Лист MVP
                    </a>
                  </div>
                )}
              </div>

          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Sidebar TOC */}
            <aside className="lg:col-span-3 bg-card border border-border/80 rounded-2xl p-4 sticky top-6 max-h-[calc(100vh-140px)] overflow-y-auto shadow-xs">
              <h2 className="text-xs font-black uppercase text-muted-foreground mb-3 tracking-wider">
                {selectedManualType === 'admin' ? 'Разделы Руководства' : 'Разделы Саппорта'}
              </h2>
              <nav className="space-y-1">
                {sidebarItems.map((item, idx) => (
                  <a
                    key={idx}
                    href={`#${item.id}`}
                    className={`block text-xs py-1.5 rounded-lg font-bold transition-all duration-200 ${
                      item.level === 1
                        ? 'text-foreground hover:text-primary pl-0 border-l-2 border-primary/40 pl-2'
                        : 'text-muted-foreground hover:text-primary pl-4 font-semibold'
                    }`}
                  >
                    {item.title}
                  </a>
                ))}
              </nav>
            </aside>

            {/* Main Reading Canvas (High-contrast, light background, clear typography) */}
            <main className="lg:col-span-9 bg-card border border-border/80 rounded-3xl p-6 md:p-10 shadow-sm leading-relaxed">
              <div 
                className="prose dark:prose-invert max-w-none prose-sm font-sans"
                dangerouslySetInnerHTML={{ __html: selectedManualType === 'admin' ? manualHtml : (supportManualHtml || manualHtml) }}
              />
            </main>
          </div>
        </div>
      )}
        </div>
      )}

      {/* TAB TECH 1: DATABASE SCHEMA & DEPENDENCIES */}
      {activeTab === 'tech_db' && (
        <div className="space-y-6">
          <div className="bg-card border border-border/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                  <span>🗄️</span> Архитектурная Схема Базы Данных & Связи Сущностей
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  PostgreSQL 16 + Prisma ORM: Реляционные графы, каскадные правила и финансовая изоляция
                </p>
              </div>
              <span className="px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-xl border border-primary/20">
                PostgreSQL + Prisma 5
              </span>
            </div>

            {/* Visual Architecture Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-primary">1. Каталог & Таксономия</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-md">1:N Связи</span>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground font-mono">
                  <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                    Network (Соцсеть)
                  </div>
                  <div className="text-center text-[10px] text-muted-foreground">↓ (1 : N)</div>
                  <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                    Category (Категория + activityType)
                  </div>
                  <div className="text-center text-[10px] text-muted-foreground">↓ (1 : N)</div>
                  <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                    Service (Услуга + targetType)
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400">2. Исполнение Заказов</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-md">BullMQ</span>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground font-mono">
                  <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                    User (Клиент)
                  </div>
                  <div className="text-center text-[10px] text-muted-foreground">↓ (1 : N)</div>
                  <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                    Order (Заказ + ProviderId)
                  </div>
                  <div className="text-center text-[10px] text-muted-foreground">↓ (1 : N)</div>
                  <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                    Refill (Заявка на докрутку)
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-amber-600 dark:text-amber-400">3. Финансы & Биллинг</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-md">Immutable</span>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground font-mono">
                  <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                    Payment (ЮKassa / CryptoBot)
                  </div>
                  <div className="text-center text-[10px] text-muted-foreground">↓ (1 : N)</div>
                  <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                    LedgerEntry (Проводка WalletOps)
                  </div>
                  <div className="text-center text-[10px] text-muted-foreground">↓ (Trigger)</div>
                  <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                    User.balance (BigInt Копейки)
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-purple-600 dark:text-purple-400">4. Безопасность & Vault</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-500/10 text-purple-600 rounded-md">AES-256</span>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground font-mono">
                  <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                    SystemSetting (Ключи API)
                  </div>
                  <div className="text-center text-[10px] text-muted-foreground">↓ (AES-GCM)</div>
                  <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                    VaultService (Шифрование)
                  </div>
                  <div className="text-center text-[10px] text-muted-foreground">↓ (RBAC)</div>
                  <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                    StaffRole (Права доступа)
                  </div>
                </div>
              </div>
            </div>

            {/* Cascade Rules & Immutability Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/60 text-xs">
              <div className="space-y-3">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                  <span>🛡️</span> Правила Каскадного Удаления (Cascades & Safe Archive)
                </h3>
                <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2 text-muted-foreground leading-relaxed">
                  <p>
                    <strong className="text-foreground">onDelete: Restrict (Защита денег):</strong> Запрещено удалять <code>Service</code> или <code>User</code>, если с ними связан хотя бы один заказ <code>Order</code> или финансовая проводка <code>LedgerEntry</code>.
                  </p>
                  <p>
                    <strong className="text-foreground">Safe Archive (Безопасная архивация):</strong> При клике «Удалить услугу» она не стирается из PostgreSQL, а помечается <code>isActive: false</code>, сохраняя целостность всей финансовой истории.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                  <span>🔒</span> Неизменяемый Финансовый Реестр (PostgreSQL Trigger)
                </h3>
                <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2 text-muted-foreground leading-relaxed">
                  <p>
                    В базе данных активен нативный триггер <code>block_ledger_mutation()</code>: любые операции <code>UPDATE</code> и <code>DELETE</code> над таблицей <code>LedgerEntry</code> <strong>физически заблокированы на уровне СУБД</strong>.
                  </p>
                  <p>
                    Корректировка баланса возможна только созданием новой встречной записи <code>COMPENSATION</code> или <code>REFUND</code> через модуль <code>WalletOps</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB TECH 2: LINK ANALYZER & DATA FLOW */}
      {activeTab === 'tech_analyzer' && (
        <div className="space-y-6">
          <div className="bg-card border border-border/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                  <span>🪄</span> Пайплайн Анализатора Ссылок & No-Code RegEx Studio
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  5-этапный конвейер очистки трекеров, ReDoS-аудита и распознавания типов ссылок
                </p>
              </div>
              <span className="px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-xl border border-primary/20">
                gemini-3-flash + ReDoS Guard
              </span>
            </div>

            {/* 5-Step Pipeline Flow */}
            <div className="space-y-3">
              <h3 className="font-bold text-foreground text-sm">5-Этапный Конвейер Обработки Ссылки (Pipeline Flow)</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1.5">
                  <div className="font-extrabold text-primary flex items-center gap-1">
                    <span>1.</span> Ввод Сырого URL
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Клиент вставляет ссылку из приложения (содержит UTM-метки, <code>?si=...</code>, <code>?igsh=...</code>).
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1.5">
                  <div className="font-extrabold text-primary flex items-center gap-1">
                    <span>2.</span> UrlCleaner
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Срезает трекеры, схлопывает мобильные зеркала (<code>m.vk.com</code> $\to$ <code>vk.com</code>, <code>youtu.be</code> $\to$ <code>youtube.com</code>).
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1.5">
                  <div className="font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span>3.</span> ReDoS Guard
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Статический AST-аудит блокирует опасные квантификаторы <code>(a+)+</code> и зависания Event Loop.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1.5">
                  <div className="font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span>4.</span> LinkAnalyzer
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Сопоставление с шаблонами <code>UrlPattern</code>, извлечение соцсети и параметров (канал, пост, рилс).
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1.5">
                  <div className="font-extrabold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <span>5.</span> Order Wizard
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Мастер заказа фильтрует список услуг, оставляя только совместимые по <code>targetType</code>.
                  </p>
                </div>
              </div>
            </div>

            {/* Supported Patterns Table */}
            <div className="space-y-3 pt-4 border-t border-border/60">
              <h3 className="font-bold text-foreground text-sm">Справочник Распознавания по Соцсетям</h3>
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 text-muted-foreground font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">Соцсеть</th>
                      <th className="px-4 py-2.5">Формат Ссылки</th>
                      <th className="px-4 py-2.5">targetType</th>
                      <th className="px-4 py-2.5">Извлекаемые Данные</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr className="hover:bg-muted/20">
                      <td className="px-4 py-2 font-bold text-foreground">Telegram</td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">t.me/channel/123 или @channel</td>
                      <td className="px-4 py-2 font-semibold text-primary">CHANNEL / POST</td>
                      <td className="px-4 py-2 text-muted-foreground">Канал: channel, ID поста: 123</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="px-4 py-2 font-bold text-foreground">VKontakte</td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">vk.com/wall-123_456</td>
                      <td className="px-4 py-2 font-semibold text-primary">POST / PROFILE</td>
                      <td className="px-4 py-2 text-muted-foreground">Владелец: -123, Пост: 456</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="px-4 py-2 font-bold text-foreground">Instagram</td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">instagram.com/p/Cx789...</td>
                      <td className="px-4 py-2 font-semibold text-primary">POST / REEL / PROFILE</td>
                      <td className="px-4 py-2 text-muted-foreground">Shortcode: Cx789...</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="px-4 py-2 font-bold text-foreground">YouTube</td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">youtube.com/watch?v=AbCd123</td>
                      <td className="px-4 py-2 font-semibold text-primary">POST / CHANNEL</td>
                      <td className="px-4 py-2 text-muted-foreground">VideoId: AbCd123</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB TECH 3: SERVICES LIFECYCLE & TAXONOMY */}
      {activeTab === 'tech_services' && (
        <div className="space-y-6">
          <div className="bg-card border border-border/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                  <span>📦</span> Жизненный Цикл Услуг, 4-Уровневая Таксономия & Импорт
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  От оптового шлюза API до витрины розничного клиента
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl border border-emerald-500/20">
                Cherry-Pick + Redis Buffer
              </span>
            </div>

            {/* 4-Level Taxonomy Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-1.5 text-xs">
                <span className="font-extrabold text-primary block">Уровень 1: Соцсеть</span>
                <p className="text-muted-foreground text-[11px]">
                  Модель <code>Network</code>. Telegram, VK, Instagram, YouTube, TikTok. Имеет иконку и свой набор <code>UrlPattern</code>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-1.5 text-xs">
                <span className="font-extrabold text-primary block">Уровень 2: Категория</span>
                <p className="text-muted-foreground text-[11px]">
                  Модель <code>Category</code>. Привязана к <code>activityType</code> (FOLLOWERS, LIKES, VIEWS, COMMENTS, POLL).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-1.5 text-xs">
                <span className="font-extrabold text-primary block">Уровень 3: Услуга</span>
                <p className="text-muted-foreground text-[11px]">
                  Модель <code>Service</code>. Привязана к <code>providerId</code> и <code>externalId</code>. Определяет <code>targetType</code> и розничную цену.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-1.5 text-xs">
                <span className="font-extrabold text-primary block">Уровень 4: Тариф</span>
                <p className="text-muted-foreground text-[11px]">
                  Метаданные <code>features</code>. Скорость (⚡), Старт (⏱), Гарантия (🛡), качество и география (Живые, СНГ, РФ).
                </p>
              </div>
            </div>

            {/* Cherry Pick Import Pipeline */}
            <div className="space-y-3 pt-4 border-t border-border/60 text-xs">
              <h3 className="font-bold text-foreground text-sm">Пайплайн Cherry-Pick Импорта (Redis Shadow Buffer)</h3>
              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3 leading-relaxed text-muted-foreground">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-xl bg-background border border-border space-y-1">
                    <strong className="text-foreground block font-bold">1. Буферизация в Redis</strong>
                    <p className="text-[11px]">
                      Сырой каталог провайдера (5000+ услуг) кэшируется в Redis ключ <code>provider:{'{id}'}:catalog</code> без засорения БД PostgreSQL.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-background border border-border space-y-1">
                    <strong className="text-foreground block font-bold">2. Эвристический Анализ</strong>
                    <p className="text-[11px]">
                      Модуль <code>SmartAnalyzerLogic</code> извлекает теги скорости и гарантии, автоматически переводя их на русский язык.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-background border border-border space-y-1">
                    <strong className="text-foreground block font-bold">3. Формирование Цены (₽/шт)</strong>
                    <p className="text-[11px]">
                      Цена рассчитывается по формуле: <code>(Rate * Markup * USD_Rate) / 1000</code> с округлением копеек.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB TECH 4: OMNI-BUTTON ACTION MATRIX */}
      {activeTab === 'tech_buttons' && (
        <div className="space-y-6">
          <div className="bg-card border border-border/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                  <span>🕹️</span> Атлас Кнопок & Управляющих Действий (Omni-Matrix)
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Справочник всех кнопок админ-панели: RBAC права, вызываемый Server Action, последствия и защита
                </p>
              </div>
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Поиск по кнопке или действию..."
                  value={buttonSearch}
                  onChange={(e) => setButtonSearch(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-xl bg-muted/60 border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Кнопка / Элемент</th>
                    <th className="px-4 py-3">Где находится</th>
                    <th className="px-4 py-3">RBAC Роль</th>
                    <th className="px-4 py-3">Server Action</th>
                    <th className="px-4 py-3">Последствия & Реакция системы</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {[
                    { name: '🔄 Перезапустить', screen: '/admin/orders', role: 'SUPPORT, ADMIN', action: 'retryOrderAction', effect: 'Сбрасывает статус в PENDING и отправляет задачу в BullMQ очередь повторно' },
                    { name: '🚫 Отменить с возвратом', screen: '/admin/orders', role: 'SUPPORT, ADMIN', action: 'cancelOrderRefundAction', effect: '100% списанной суммы возвращается клиенту через WalletOps.refund()' },
                    { name: '✂️ Частичный возврат', screen: '/admin/orders', role: 'SUPPORT, ADMIN', action: 'partialRefundAction', effect: 'Рассчитывает остаток (remains) и возвращает деньги за невыполненную часть' },
                    { name: '👁️ Скрыть категорию', screen: '/admin/catalog/categories', role: 'CATALOG, ADMIN', action: 'toggleCategoryAction', effect: 'Мгновенно скрывает все услуги выбранной категории с витрины клиентского сайта' },
                    { name: '🔀 Объединить (Merge)', screen: '/admin/catalog/categories', role: 'ADMIN', action: 'mergeCategoriesAction', effect: 'Переносит все услуги в целевую категорию и безопасно удаляет исходную' },
                    { name: '🪄 Сгенерировать AI', screen: '/admin/catalog/patterns', role: 'CATALOG, ADMIN', action: 'generateAiRegexAction', effect: 'Gemini 3 Flash создает безопасное правило и 5 автотестов по 2-3 примерам' },
                    { name: '🧪 Dry Run по 200 заказам', screen: '/admin/catalog/patterns', role: 'CATALOG, ADMIN', action: 'dryRunPatternsAction', effect: 'Фоновый прогон правила по реальным заказам из базы для проверки точности' },
                    { name: '💰 Начислить баланс', screen: '/admin/clients', role: 'FINANCE, SUPERADMIN', action: 'adjustClientBalanceAction', effect: 'Создает запись LedgerEntry с обязательным обоснованием и idempotencyKey' },
                    { name: '🚨 Maintenance Mode', screen: '/admin/settings', role: 'SUPERADMIN', action: 'toggleMaintenanceAction', effect: 'Мгновенно закрывает витрину для клиентов с показом экрана техобслуживания' },
                    { name: '📥 Импортировать выбранные', screen: '/admin/providers/import', role: 'CATALOG, ADMIN', action: 'importServicesAction', effect: 'Импортирует выбранные услуги из Redis буфера с наценкой и авто-переводом' },
                  ]
                    .filter(b => !buttonSearch || b.name.toLowerCase().includes(buttonSearch.toLowerCase()) || b.screen.toLowerCase().includes(buttonSearch.toLowerCase()) || b.effect.toLowerCase().includes(buttonSearch.toLowerCase()))
                    .map((btn, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-bold text-foreground flex items-center gap-1.5">{btn.name}</td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">{btn.screen}</td>
                        <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-[10px]">{btn.role}</span></td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground text-[11px]">{btn.action}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{btn.effect}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB TECH 5: BULLMQ QUEUES & BACKGROUND WORKERS */}
      {activeTab === 'tech_queues' && (
        <div className="space-y-6">
          <div className="bg-card border border-border/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                  <span>⚙️</span> Очереди Redis BullMQ & Фоновые Воркеры
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Топология асинхронной обработки заказов, синхронизации статусов и мониторинга цен
                </p>
              </div>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs rounded-xl border border-amber-500/20">
                Redis + BullMQ
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <span className="font-extrabold text-xs text-primary block">1. order-dispatch-queue</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Отправка новых оплаченных заказов в API внешних поставщиков. 5 воркеров, до 3 повторов с экспоненциальным бэкоффом.
                </p>
                <div className="text-[10px] font-mono text-muted-foreground bg-background p-1.5 rounded-lg border border-border">
                  Retry: 10s, 30s, 60s
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 block">2. order-status-sync-queue</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Циклический опрос активных заказов (IN_PROGRESS) каждые 60 секунд. Пакетная сверка до 100 заказов за вызов.
                </p>
                <div className="text-[10px] font-mono text-muted-foreground bg-background p-1.5 rounded-lg border border-border">
                  Интервал: 60 сек
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <span className="font-extrabold text-xs text-amber-600 dark:text-amber-400 block">3. refill-sync-queue</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Отправка команд гарантийной докрутки провайдеру и отслеживание статуса восстановления показателей.
                </p>
                <div className="text-[10px] font-mono text-muted-foreground bg-background p-1.5 rounded-lg border border-border">
                  SLA: до 24 часов
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <span className="font-extrabold text-xs text-purple-600 dark:text-purple-400 block">4. provider-price-sync-queue</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Ночная сверка оптовых тарифов. При скачке цены &gt; 30% переводит услугу в Карантин (isQuarantined: true).
                </p>
                <div className="text-[10px] font-mono text-muted-foreground bg-background p-1.5 rounded-lg border border-border">
                  Триггер: 03:00 МСК
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2 text-xs text-muted-foreground">
              <strong className="text-foreground block font-bold">Регламент действий при Stalled Jobs (зависании очереди):</strong>
              <p>1. Проверить соединение с Redis: <code>redis-cli ping</code> (должен вернуть <code>PONG</code>).</p>
              <p>2. Проверить память Redis: <code>redis-cli info memory</code> (не должна превышать 80%).</p>
              <p>3. Перезапустить процесс воркеров: <code>pm2 restart smmplan-workers</code> или <code>docker restart smmplan-worker</code>.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB TECH 6: MULTI-TENANT MATRIX */}
      {activeTab === 'tech_multitenant' && (
        <div className="space-y-6">
          <div className="bg-card border border-border/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                  <span>🏢</span> Матрица Изоляции Мульти-Тенантности (SMMplan vs SMMflux)
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Правила разделения и совместного использования данных между брендами платформы
                </p>
              </div>
              <span className="px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-xl border border-primary/20">
                SMMplan.pro & SMMflux.ru
              </span>
            </div>

            {/* 3 Interactive Architectural Explanations */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <span className="font-extrabold text-primary block">1. Edge Middleware Resolution</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Next.js 16 Edge Middleware перехватывает домен (<code>smmplan.pro</code> или <code>smmflux.ru</code>), удаляет спуфинговые заголовки и выставляет доверенный <code>x-tenant-id</code>.
                </p>
                <div className="p-2 rounded-lg bg-background border border-border font-mono text-[10px] text-foreground">
                  requestHeaders.set(&apos;x-tenant-id&apos;, tenantId)
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block">2. Header Global Switcher</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Переключатель <code>&lt;TenantSwitcher /&gt;</code> в шапке пишет куку <code>x_admin_tenant</code>, обновляет параметр <code>?tenant=...</code> и вызывает <code>router.refresh()</code> для SSR.
                </p>
                <div className="p-2 rounded-lg bg-background border border-border font-mono text-[10px] text-foreground">
                  document.cookie = &quot;x_admin_tenant=flux; ...&quot;
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <span className="font-extrabold text-amber-600 dark:text-amber-400 block">3. Prisma & Cache Partitioning</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Пользователи изолированы индексом <code>@@unique([email, tenantId])</code>, а кэш <code>unstable_cache</code> тегируется как <code>catalog-${'{tenantId}'}</code>.
                </p>
                <div className="p-2 rounded-lg bg-background border border-border font-mono text-[10px] text-foreground">
                  WHERE tenantId = &apos;smmplan&apos; | &apos;flux&apos;
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Сущность платформы</th>
                    <th className="px-4 py-3">Режим Изоляции</th>
                    <th className="px-4 py-3">Поведение для Администратора</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-bold text-foreground">Балансы провайдеров API</td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">🌐 ОБЩИЕ</span></td>
                    <td className="px-4 py-2.5 text-muted-foreground">Оптовые шлюзы и депозиты едины для обоих сайтов</td>
                  </tr>
                  <tr className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-bold text-foreground">Ключи ЮKassa / Robokassa</td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">🌐 ОБЩИЕ</span></td>
                    <td className="px-4 py-2.5 text-muted-foreground">Платежные шлюзы и фискальные кассы 54-ФЗ едины</td>
                  </tr>
                  <tr className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-bold text-foreground">Ключи Google Gemini AI</td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">🌐 ОБЩИЕ</span></td>
                    <td className="px-4 py-2.5 text-muted-foreground">Пул нейросетевых ключей ротируется глобально</td>
                  </tr>
                  <tr className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-bold text-foreground">Сотрудники и Табель Смен</td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">🌐 ОБЩИЕ</span></td>
                    <td className="px-4 py-2.5 text-muted-foreground">Единый штат операторов поддержки и график 2/2</td>
                  </tr>
                  <tr className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-bold text-foreground">Клиенты (User.tenantId)</td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold text-[10px]">🔒 ИЗОЛИРОВАНЫ</span></td>
                    <td className="px-4 py-2.5 text-muted-foreground">Аккаунты SMMplan не имеют доступа к кабинету SMMflux</td>
                  </tr>
                  <tr className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-bold text-foreground">Заказы (Order.tenantId)</td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold text-[10px]">🔒 ИЗОЛИРОВАНЫ</span></td>
                    <td className="px-4 py-2.5 text-muted-foreground">Реестры заказов строго разделены в админке по фильтру сайта</td>
                  </tr>
                  <tr className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-bold text-foreground">Балансы Клиентов</td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold text-[10px]">🔒 ИЗОЛИРОВАНЫ</span></td>
                    <td className="px-4 py-2.5 text-muted-foreground">Деньги клиента хранятся строго в рамках своего тенанта</td>
                  </tr>
                  <tr className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-bold text-foreground">Промокоды & Скидки</td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold text-[10px]">🔒 ИЗОЛИРОВАНЫ</span></td>
                    <td className="px-4 py-2.5 text-muted-foreground">Промокод для SMMflux не сработает на SMMplan</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB TECH 7: SYSTEM SETTINGS & ARCHITECTURE */}
      {activeTab === 'tech_settings' && (
        <div className="space-y-6">
          <div className="bg-card border border-border/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                  <span>⚙️</span> Архитектура Настроек Системы & Безопасность (OmniSMM 1.0)
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Конфигурация параметров платформы, управление секретами Vault, аварийные механизмы и разграничение прав
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/admin/settings"
                  className="px-3 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-xs hover:opacity-90 transition-opacity flex items-center gap-1.5"
                >
                  <span>Открыть раздел настроек</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Grid of Settings Modules */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-foreground flex items-center gap-1.5">
                    <span>🛑</span> Режим техработ (KillSwitch)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 font-bold text-[10px]">HTTP 503</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Аварийный рубильник в SystemSettings. Переводит витрины в защитный режим с сообщением о технических работах, не затрагивая админку.
                </p>
                <Link
                  href="/admin/settings?tab=general"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  Общие настройки & KillSwitch →
                </Link>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-foreground flex items-center gap-1.5">
                    <span>📢</span> Telegram Bot P0 & Алерты
                  </span>
                  <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 font-bold text-[10px]">P0 Alert</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Мгновенные оповещения в дежурный Telegram-канал при сбоях провайдеров, блокировках и финансовых аномалиях с защитой от 409 Conflict.
                </p>
                <Link
                  href="/admin/settings?tab=telegram"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  Настройки Telegram-бота →
                </Link>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-foreground flex items-center gap-1.5">
                    <span>🌐</span> Прокси-пулы Провайдеров
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold text-[10px]">SOCKS5 / HTTP</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Маршрутизация запросов к API внешних провайдеров через изолированные прокси-ноды для обхода блокировок РКН и Cloudflare.
                </p>
                <Link
                  href="/admin/settings?tab=proxies"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  Управление прокси →
                </Link>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-foreground flex items-center gap-1.5">
                    <span>🛡️</span> Роли и Доступы (RBAC)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 font-bold text-[10px]">16 секций</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Матрица прав доступа: OWNER, ADMIN, SUPPORT, ACCOUNTANT с гранулярным контролем (Full, Read-Only, None) по каждому экрану.
                </p>
                <Link
                  href="/admin/settings?tab=roles"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  Матрица прав персонала →
                </Link>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-foreground flex items-center gap-1.5">
                    <span>🎨</span> Брендинг и Мульти-Тенант
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 font-bold text-[10px]">SMMplan / SMMflux</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Логотипы, цветовые схемы, фавиконы и метаданные брендов для smmplan.pro и smmflux.ru с независимой изоляцией.
                </p>
                <Link
                  href="/admin/settings?tab=branding"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  Брендинг и домены →
                </Link>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-foreground flex items-center gap-1.5">
                    <span>🚩</span> Feature Flags & CMS
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">Zero-Downtime</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Мгновенное включение и отключение экспериментальных фичей (Drip-Feed, Free Promotion, CryptoBot) без пересборки контейнеров.
                </p>
                <Link
                  href="/admin/system/features"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  Переключатели фич →
                </Link>
              </div>
            </div>

            {/* Quick Action to open Textbook domain */}
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">📖</span>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Интерактивный учебник по Настройкам и Безопасности</h4>
                  <p className="text-[11px] text-muted-foreground">Глава 45 ГОСТ ЕСПД: регламенты, хотспоты скриншотов, чек-листы и схемы</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('handbook');
                  setManualPresentationMode('INTERACTIVE');
                }}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-xs hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1"
              >
                <span>Читать главу в Учебнике</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: QUALIFICATION EXAM */}
      {activeTab === 'exam' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm ring-1 ring-border/5 space-y-6">
            {!examFinished ? (
              <>
                <div className="flex items-center justify-between border-b border-border/50 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Квалификационный экспресс-экзамен</h3>
                    <p className="text-xs text-muted-foreground">Вопрос {examStep + 1} из {examScenarios.length}</p>
                  </div>
                  <div className="text-xs font-black px-2.5 py-1 bg-primary/10 text-primary rounded-xl">
                    Тестирование саппорта
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-foreground block">{currentExamScenario.title}</span>
                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground">
                    {currentExamScenario.clientMessage}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-foreground block">Как вы поступите?</span>
                  {currentExamScenario.options.map(opt => {
                    const isSelected = examAnswers[examStep] === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleExamOption(opt.id)}
                        className={`p-3.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                          isSelected ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary/30' : 'bg-background/40 border-border/60 text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0 ${
                          isSelected ? 'bg-primary text-primary-foreground border-primary' : 'border-border'
                        }`}>
                          {isSelected ? '✓' : ''}
                        </div>
                        <span>{opt.label}</span>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleNextExamQuestion}
                  className="w-full h-11 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{examStep < examScenarios.length - 1 ? 'Следующий вопрос' : 'Завершить экзамен'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="text-center space-y-5 py-4">
                {(() => {
                  const res = calculateExamResult();
                  const isPassed = res.percent >= 80;
                  return (
                    <>
                      <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl border shadow-sm bg-primary/10 border-primary/30 text-primary">
                        {isPassed ? '🏆' : '📚'}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-foreground">
                          {isPassed ? 'Экзамен успешно сдан!' : 'Экзамен не пройден. Требуется повторение'}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Правильных ответов: {res.earned} из {res.total} ({res.percent}%)
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 text-xs text-muted-foreground max-w-md mx-auto text-left">
                        {isPassed ? (
                          <span className="text-emerald-600 font-bold block">
                            ✅ Вы подтвердили знание 152-ФЗ, 54-ФЗ, лимитов Escrow и архитектуры Smmplan. Допуск к сменам открыт.
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold block">
                            ⚠️ Пройдите интерактивный тренажер кейсов еще раз, чтобы закрепить алгоритмы поиска по чекам и заморозки при взломе.
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setExamStep(0);
                          setExamAnswers({});
                          setExamFinished(false);
                        }}
                        className="px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
                      >
                        Пройти экзамен заново
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
