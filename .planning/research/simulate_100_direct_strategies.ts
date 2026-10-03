/**
 * simulate_100_direct_strategies.ts
 * 
 * Моделирование и NPU-арбитраж 100 вариантов рекламных стратегий в Яндекс.Директ
 * для платформы SMMplan (smmplan.pro).
 * 
 * Соответствует спецификациям:
 * - docs/specs/SPEC-2026-09-30-LOCAL-JEV-DECISION-MCP.md (System 1 Decision Engine)
 * - .agents/skills/yandex-direct-cold-start-launcher/SKILL.md
 * - .agents/skills/yandex-direct-autostrategy-tuner/SKILL.md
 * - .agents/skills/yandex-direct-anti-clickfraud-shield/SKILL.md
 * - .agents/skills/yandex-direct-copywriter-policy15/SKILL.md
 * - .agents/skills/ppc-campaign-strategist/SKILL.md
 */

import fs from 'fs';
import path from 'path';

export interface StrategyModel {
  id: string;
  name: string;
  budgetTier: 'PILOT' | 'GROWTH' | 'SCALE' | 'DOMINANCE';
  budgetRubWeekly: number;
  budgetRubMonthly: number;
  channel: 'SEARCH' | 'YAN' | 'UPC' | 'RETARGETING' | 'MASTER';
  cluster: 'TELEGRAM' | 'VK' | 'MAX' | 'COMPETITORS' | 'B2B_WHOLESALE' | 'OMNI_MIX';
  bidding: 'MANUAL_CAPPED' | 'MAX_CLICKS' | 'MICRO_CPA' | 'MACRO_CPA' | 'PAY_PER_CONV' | 'TARGET_ROAS';
  shielding: 'HARDENED' | 'DEFAULT';
  autotargeting: 'STRICT' | 'BROAD';

  // Projected metrics
  projectedCpc: number;
  projectedCtr: number;
  weeklyClicks: number;
  cr1Reg: number;
  weeklyRegistrations: number;
  cpaReg: number;
  cr2Pay: number;
  weeklyPayingUsers: number;
  cacPay: number;
  aovRub: number;
  ltv90d: number;
  grossMarginPct: number;
  weeklyRevenueFirstTouch: number;
  weeklyRevenueCohort90d: number;
  roasFirstTouchPct: number;
  roasCohort90dPct: number;

  // Decision vector scores (0 - 100)
  coldStartScore: number;
  unitEconomicsScore: number;
  clickfraudScore: number;
  policy15Score: number;
  speedToFirstValueScore: number;
  npuTotalScore: number;
  verdict: 'TOP_RECOMMENDED' | 'VIABLE_ALTERNATIVE' | 'HIGH_RISK_REJECT';
  keyAdvantage: string;
  keyRisk: string;
}

// 1. Базовые бенчмарки аукциона Яндекс.Директ и Wordstat 2026
const CPC_BASE: Record<string, number> = {
  TELEGRAM: 36.5,
  VK: 31.0,
  MAX: 22.0,
  COMPETITORS: 52.0,
  B2B_WHOLESALE: 68.0,
  OMNI_MIX: 38.0
};

const AOV_BASE: Record<string, number> = {
  TELEGRAM: 780,
  VK: 650,
  MAX: 920,
  COMPETITORS: 1450,
  B2B_WHOLESALE: 8500,
  OMNI_MIX: 1100
};

const LTV_BASE: Record<string, number> = {
  TELEGRAM: 2950,
  VK: 2400,
  MAX: 4100,
  COMPETITORS: 5800,
  B2B_WHOLESALE: 52000,
  OMNI_MIX: 4600
};

// 25 архитектурных шаблонов для каждого бюджета
interface ArchetypeDef {
  code: string;
  name: string;
  channel: 'SEARCH' | 'YAN' | 'UPC' | 'RETARGETING' | 'MASTER';
  cluster: 'TELEGRAM' | 'VK' | 'MAX' | 'COMPETITORS' | 'B2B_WHOLESALE' | 'OMNI_MIX';
  bidding: 'MANUAL_CAPPED' | 'MAX_CLICKS' | 'MICRO_CPA' | 'MACRO_CPA' | 'PAY_PER_CONV' | 'TARGET_ROAS';
  shielding: 'HARDENED' | 'DEFAULT';
  autotargeting: 'STRICT' | 'BROAD';
  keyAdvantage: string;
  keyRisk: string;
}

const ARCHETYPES: ArchetypeDef[] = [
  // 1-5: Telegram
  { code: 'TG_SEARCH_MANUAL', name: 'Telegram Core • Поиск • Ручные ставки с лимитом', channel: 'SEARCH', cluster: 'TELEGRAM', bidding: 'MANUAL_CAPPED', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: '100% горячий спрос, мгновенный старт за 2ч, нулевой риск срыва алгоритма', keyRisk: 'Ручной мониторинг поисковых отчетов' },
  { code: 'TG_SEARCH_CLICKS', name: 'Telegram Core • Поиск • Максимум кликов', channel: 'SEARCH', cluster: 'TELEGRAM', bidding: 'MAX_CLICKS', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Максимальный охват целевых запросов в рамках дневного бюджета', keyRisk: 'Возможен временный разогрев CPC в пиковые часы' },
  { code: 'TG_SEARCH_MICROCPA', name: 'Telegram Core • Поиск • Максимум конверсий (Регистрация)', channel: 'SEARCH', cluster: 'TELEGRAM', bidding: 'MICRO_CPA', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Быстрое преодоление барьера 10 конверсий/нед, точный LAL портрет', keyRisk: 'Требует 3-5 дней на стабильное обучение' },
  { code: 'TG_SEARCH_MACROCPA', name: 'Telegram Core • Поиск • Максимум конверсий (Оплата)', channel: 'SEARCH', cluster: 'TELEGRAM', bidding: 'MACRO_CPA', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Прямая оптимизация под окупаемость инвестиций', keyRisk: 'При бюджете <35k срыв Правила 10 конверсий' },
  { code: 'TG_SEARCH_PAYCPA', name: 'Telegram Core • Поиск • Оплата за оплату (CPA Pay)', channel: 'SEARCH', cluster: 'TELEGRAM', bidding: 'PAY_PER_CONV', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Нулевой риск слива бюджета (оплата строго за факт пополнения)', keyRisk: 'Яндекс может урезать показы из-за нехватки данных' },

  // 6-8: VK
  { code: 'VK_SEARCH_MANUAL', name: 'VK Сообщества • Поиск • Ручные ставки с лимитом', channel: 'SEARCH', cluster: 'VK', bidding: 'MANUAL_CAPPED', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Стабильный спрос на группы и паблики, контролируемый CPC', keyRisk: 'Чуть ниже средний чек по сравнению с Telegram' },
  { code: 'VK_SEARCH_CLICKS', name: 'VK Сообщества • Поиск • Максимум кликов', channel: 'SEARCH', cluster: 'VK', bidding: 'MAX_CLICKS', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Высокая плотность недорогих кликов', keyRisk: 'Околоцелевые запросы требуют минусовки' },
  { code: 'VK_SEARCH_MICROCPA', name: 'VK Сообщества • Поиск • Оптимизация на регистрации', channel: 'SEARCH', cluster: 'VK', bidding: 'MICRO_CPA', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Предсказуемая цена лида ~160-190 ₽', keyRisk: 'Период первичной калибровки' },

  // 9-11: MAX Messenger (Эксклюзив)
  { code: 'MAX_SEARCH_MANUAL', name: 'MAX Мессенджер • Поиск • Ручные ставки', channel: 'SEARCH', cluster: 'MAX', bidding: 'MANUAL_CAPPED', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Голубой океан, первый поставщик, маржинальность 85%, CPC <20 ₽', keyRisk: 'Меньший базовый спрос Wordstat' },
  { code: 'MAX_SEARCH_CLICKS', name: 'MAX Мессенджер • Поиск • Максимум кликов', channel: 'SEARCH', cluster: 'MAX', bidding: 'MAX_CLICKS', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Выкуп 90%+ всего доступного поискового трафика в РФ', keyRisk: 'Омонимичные минус-слова (AirMax, IMAX, Mara)' },
  { code: 'MAX_SEARCH_MICROCPA', name: 'MAX Мессенджер • Поиск • Оптимизация на регистрации', channel: 'SEARCH', cluster: 'MAX', bidding: 'MICRO_CPA', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Сверхвысокая конверсия в регистрацию (новизна продукта)', keyRisk: 'Узкая ниша' },

  // 12-14: Перехват конкурентов
  { code: 'COMPETITORS_MANUAL', name: 'Конкуренты (smmprime, doctorsmm, smmlaba, lowcost) • Ручные', channel: 'SEARCH', cluster: 'COMPETITORS', bidding: 'MANUAL_CAPPED', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Готовая теплая платящая аудитория, AOV в 1.8x выше, высокий LTV', keyRisk: 'Повышенный CPC (50-65 ₽)' },
  { code: 'COMPETITORS_CLICKS', name: 'Конкуренты • Поиск • Максимум кликов', channel: 'SEARCH', cluster: 'COMPETITORS', bidding: 'MAX_CLICKS', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Постоянный перехват трафика чужих брендов', keyRisk: 'Аукционная конкуренция' },
  { code: 'COMPETITORS_ROAS', name: 'Конкуренты • Поиск • Оптимизация по рентабельности ROAS', channel: 'SEARCH', cluster: 'COMPETITORS', bidding: 'TARGET_ROAS', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Высокая окупаемость за счет повторных чеков реселлеров', keyRisk: 'Требует сквозную передачу доходов в Метрику' },

  // 15-17: B2B API Wholesale
  { code: 'B2B_SEARCH_MANUAL', name: 'B2B Оптовики и API • Поиск • Ручные ставки', channel: 'SEARCH', cluster: 'B2B_WHOLESALE', bidding: 'MANUAL_CAPPED', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Крупный чек 8 500 ₽, 90d LTV свыше 50 000 ₽, ROAS > 1000%', keyRisk: 'Низкая частотность запросов, высокий CPC' },
  { code: 'B2B_SEARCH_CLICKS', name: 'B2B Оптовики • Поиск • Максимум кликов', channel: 'SEARCH', cluster: 'B2B_WHOLESALE', bidding: 'MAX_CLICKS', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Захват всех профильных реселлеров', keyRisk: 'Долгий цикл первой оплаты' },
  { code: 'B2B_SEARCH_MACROCPA', name: 'B2B Оптовики • Поиск • Оплата первого пополнения', channel: 'SEARCH', cluster: 'B2B_WHOLESALE', bidding: 'MACRO_CPA', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Привлечение крупных клиентов с фиксированным CAC', keyRisk: 'Редкие конверсии, сложно обучить' },

  // 18-20: РСЯ (Сети)
  { code: 'YAN_CLICKS_HARDENED', name: 'РСЯ Сети • Защищенный блеклист 1200+ DSP • Клики', channel: 'YAN', cluster: 'TELEGRAM', bidding: 'MAX_CLICKS', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Дешевый охват заинтересованных вебмастеров (CPC 15 ₽)', keyRisk: 'Холодная аудитория, ниже CR' },
  { code: 'YAN_MICROCPA_HARDENED', name: 'РСЯ Сети • Защищенный блеклист • Оптимизация на регистрации', channel: 'YAN', cluster: 'OMNI_MIX', bidding: 'MICRO_CPA', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Огромный объем регистраций по минимальной стоимости', keyRisk: 'Требует обязательной проверки качества трафика' },
  { code: 'YAN_UNSHIELDED_RAW', name: 'РСЯ Сети • БЕЗ ЗАЩИТЫ (Default baseline benchmark)', channel: 'YAN', cluster: 'TELEGRAM', bidding: 'MAX_CLICKS', shielding: 'DEFAULT', autotargeting: 'BROAD', keyAdvantage: 'Иллюзорно низкий CPC 12 ₽', keyRisk: 'КРИТИЧЕСКИЙ РИСК: 60%+ бюджета сжирают боты в мобильных играх' },

  // 21-22: Ретаргетинг
  { code: 'RETARGET_SMART_MICROCPA', name: 'Смарт-ретаргетинг • Брошенная регистрация/корзина', channel: 'RETARGETING', cluster: 'OMNI_MIX', bidding: 'MICRO_CPA', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Рекордный CR1 21% и CR2 35%, возврат самых горячих лидов', keyRisk: 'Ограничен размером базы ретаргетинга сайта' },
  { code: 'RETARGET_SMART_MANUAL', name: 'Смарт-ретаргетинг • Ручное управление ставками', channel: 'RETARGETING', cluster: 'TELEGRAM', bidding: 'MANUAL_CAPPED', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Полный контроль над частотой показа объявлений догоняющим', keyRisk: 'Необходим постоянный приток нового трафика' },

  // 23-24: ЕПК (Единая Перформанс-Кампания)
  { code: 'UPC_OMNI_CLICKS', name: 'ЕПК (Поиск + РСЯ) • Мультиплатформа • Максимум кликов', channel: 'UPC', cluster: 'OMNI_MIX', bidding: 'MAX_CLICKS', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Автоматическое синергетическое перераспределение бюджета', keyRisk: 'Может переливать трафик в сети в ущерб Поиску' },
  { code: 'UPC_OMNI_MICROCPA', name: 'ЕПК (Поиск + РСЯ) • Мультиплатформа • Целевой CPA Регистрация', channel: 'UPC', cluster: 'OMNI_MIX', bidding: 'MICRO_CPA', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Умное обучение алгоритмов Яндекса на всем спектре площадок', keyRisk: 'Требует достаточного недельного бюджета' },

  // 25: Мастер Кампаний
  { code: 'MASTER_PAY_CONV', name: 'Мастер Кампаний • Оплата строго за пополнение баланса', channel: 'MASTER', cluster: 'OMNI_MIX', bidding: 'PAY_PER_CONV', shielding: 'HARDENED', autotargeting: 'STRICT', keyAdvantage: 'Идеальная защита инвестора: 0 ₽ списаний до поступления денег', keyRisk: 'Риск затухания показов (Zero Impressions Trap)' }
];

export function generate100SystematicStrategies(): StrategyModel[] {
  const strategies: StrategyModel[] = [];

  const tiers = [
    { tier: 'PILOT' as const, weekly: 28000, monthly: 120000 },
    { tier: 'GROWTH' as const, weekly: 35000, monthly: 150000 },
    { tier: 'SCALE' as const, weekly: 65000, monthly: 280000 },
    { tier: 'DOMINANCE' as const, weekly: 175000, monthly: 750000 }
  ];

  let idCounter = 1;

  for (const t of tiers) {
    for (const a of ARCHETYPES) {
      const id = `STRAT-${String(idCounter).padStart(3, '0')}`;
      const name = `[${t.tier}] ${a.name}`;

      // Моделирование CPC
      let cpc = CPC_BASE[a.cluster];
      if (a.channel === 'YAN') cpc *= 0.42;
      if (a.channel === 'RETARGETING') cpc *= 0.55;
      if (a.channel === 'UPC') cpc *= 0.78;
      if (a.channel === 'MASTER') cpc *= 0.70;
      if (a.bidding === 'MANUAL_CAPPED') cpc *= 0.90;
      if (a.shielding === 'DEFAULT') cpc *= 0.80; // Ботнет удешевляет номинальный клик

      // CTR
      let ctr = a.channel === 'SEARCH' ? (a.cluster === 'COMPETITORS' ? 9.5 : 12.8) : (a.channel === 'RETARGETING' ? 2.4 : 1.1);

      // Клики в неделю
      const weeklyClicks = Math.round(t.weekly / cpc);

      // CR1 (Регистрация)
      let cr1 = a.channel === 'SEARCH' ? 0.135 : (a.channel === 'RETARGETING' ? 0.21 : 0.058);
      if (a.cluster === 'MAX') cr1 *= 1.25;
      if (a.cluster === 'COMPETITORS') cr1 *= 0.95;
      if (a.shielding === 'DEFAULT') cr1 *= 0.45; // Скликивание убивает CR

      const weeklyRegistrations = Math.max(1, Math.round(weeklyClicks * cr1));
      const cpaReg = Math.round(t.weekly / weeklyRegistrations);

      // CR2 (Оплата)
      let cr2 = a.channel === 'SEARCH' ? 0.28 : (a.channel === 'RETARGETING' ? 0.35 : 0.16);
      if (a.cluster === 'B2B_WHOLESALE') cr2 = 0.18;
      if (a.shielding === 'DEFAULT') cr2 *= 0.50;

      const weeklyPayingUsers = Math.max(1, Math.round(weeklyRegistrations * cr2));
      const cacPay = Math.round(t.weekly / weeklyPayingUsers);

      // Финансы
      const aov = AOV_BASE[a.cluster];
      const ltv = LTV_BASE[a.cluster];
      const marginPct = (a.cluster === 'MAX') ? 0.85 : (a.cluster === 'B2B_WHOLESALE' ? 0.55 : 0.68);

      const weeklyRevenueFirstTouch = Math.round(weeklyPayingUsers * aov);
      const weeklyRevenueCohort90d = Math.round(weeklyPayingUsers * ltv);

      const roasFirstTouchPct = Math.round((weeklyRevenueFirstTouch / t.weekly) * 100);
      const roasCohort90dPct = Math.round((weeklyRevenueCohort90d / t.weekly) * 100);

      // NPU СКОРИНГ (Decision Engine System 1)
      let coldStartScore = 80;
      if (a.channel === 'SEARCH') coldStartScore += 15;
      if (a.bidding === 'MANUAL_CAPPED' || a.bidding === 'MAX_CLICKS') coldStartScore += 10;
      if (a.bidding === 'MICRO_CPA') coldStartScore += 5;
      if ((a.bidding === 'MACRO_CPA' || a.bidding === 'PAY_PER_CONV') && weeklyPayingUsers < 10) {
        coldStartScore -= 45; // Штраф за срыв правила 10 конверсий
      }
      if (t.tier === 'PILOT' && a.channel === 'YAN') coldStartScore -= 25; // РСЯ в 1-ю неделю пилота опасна

      const ltvToCac = ltv / cacPay;
      let unitEconomicsScore = Math.min(100, Math.round(ltvToCac * 16));
      if (roasFirstTouchPct >= 100) unitEconomicsScore += 15;

      let clickfraudScore = 75;
      if (a.channel === 'SEARCH') clickfraudScore += 20;
      if (a.shielding === 'HARDENED') clickfraudScore += 15;
      if (a.shielding === 'DEFAULT') clickfraudScore -= 50;

      let policy15Score = 85;
      if (a.cluster === 'B2B_WHOLESALE' || a.cluster === 'MAX') policy15Score += 12;
      if (a.cluster === 'COMPETITORS') policy15Score -= 8;
      if (a.autotargeting === 'BROAD') policy15Score -= 10;

      let speedScore = 70;
      if (a.channel === 'SEARCH') speedScore += 25;
      if (a.bidding === 'MANUAL_CAPPED') speedScore += 15;
      if (a.bidding === 'MACRO_CPA') speedScore -= 20;

      coldStartScore = Math.max(5, Math.min(99, coldStartScore));
      unitEconomicsScore = Math.max(5, Math.min(99, unitEconomicsScore));
      clickfraudScore = Math.max(5, Math.min(99, clickfraudScore));
      policy15Score = Math.max(5, Math.min(99, policy15Score));
      speedScore = Math.max(5, Math.min(99, speedScore));

      const npuTotalScore = Number((
        coldStartScore * 0.25 +
        unitEconomicsScore * 0.30 +
        clickfraudScore * 0.20 +
        policy15Score * 0.15 +
        speedScore * 0.10
      ).toFixed(1));

      let verdict: 'TOP_RECOMMENDED' | 'VIABLE_ALTERNATIVE' | 'HIGH_RISK_REJECT' = 'VIABLE_ALTERNATIVE';
      if (npuTotalScore >= 83) verdict = 'TOP_RECOMMENDED';
      else if (npuTotalScore < 60 || coldStartScore < 45 || clickfraudScore < 40) verdict = 'HIGH_RISK_REJECT';

      strategies.push({
        id,
        name,
        budgetTier: t.tier,
        budgetRubWeekly: t.weekly,
        budgetRubMonthly: t.monthly,
        channel: a.channel,
        cluster: a.cluster,
        bidding: a.bidding,
        shielding: a.shielding,
        autotargeting: a.autotargeting,
        projectedCpc: Number(cpc.toFixed(1)),
        projectedCtr: Number(ctr.toFixed(1)),
        weeklyClicks,
        cr1Reg: Number((cr1 * 100).toFixed(1)),
        weeklyRegistrations,
        cpaReg,
        cr2Pay: Number((cr2 * 100).toFixed(1)),
        weeklyPayingUsers,
        cacPay,
        aovRub: aov,
        ltv90d: ltv,
        grossMarginPct: Number((marginPct * 100).toFixed(0)),
        weeklyRevenueFirstTouch,
        weeklyRevenueCohort90d,
        roasFirstTouchPct,
        roasCohort90dPct,
        coldStartScore,
        unitEconomicsScore,
        clickfraudScore,
        policy15Score,
        speedToFirstValueScore: speedScore,
        npuTotalScore,
        verdict,
        keyAdvantage: a.keyAdvantage,
        keyRisk: a.keyRisk
      });

      idCounter++;
    }
  }

  return strategies;
}

function run() {
  const all100 = generate100SystematicStrategies();
  console.log(`Successfully generated and evaluated EXACTLY ${all100.length} distinct strategies.`);

  // Сортировка по NPU скору
  all100.sort((a, b) => b.npuTotalScore - a.npuTotalScore);

  // Сводка по вердиктам
  const counts = {
    TOP_RECOMMENDED: all100.filter(s => s.verdict === 'TOP_RECOMMENDED').length,
    VIABLE_ALTERNATIVE: all100.filter(s => s.verdict === 'VIABLE_ALTERNATIVE').length,
    HIGH_RISK_REJECT: all100.filter(s => s.verdict === 'HIGH_RISK_REJECT').length,
  };
  console.log('Verdict Breakdown:', counts);

  const bestByTier = {
    PILOT: all100.filter(s => s.budgetTier === 'PILOT' && s.verdict === 'TOP_RECOMMENDED').slice(0, 3),
    GROWTH: all100.filter(s => s.budgetTier === 'GROWTH' && s.verdict === 'TOP_RECOMMENDED').slice(0, 3),
    SCALE: all100.filter(s => s.budgetTier === 'SCALE' && s.verdict === 'TOP_RECOMMENDED').slice(0, 3),
    DOMINANCE: all100.filter(s => s.budgetTier === 'DOMINANCE' && s.verdict === 'TOP_RECOMMENDED').slice(0, 3),
  };

  console.log('\n======================================================');
  console.log('👑 ТОП-3 СТРАТЕГИИ В КАЖДОЙ ИЗ 4 БЮДЖЕТНЫХ КАТЕГОРИЙ:');
  console.log('======================================================');
  for (const [tier, list] of Object.entries(bestByTier)) {
    console.log(`\n### Бюджетная категория: ${tier}`);
    list.forEach((s, idx) => {
      console.log(`  ${idx + 1}. [${s.id}] ${s.name} | Бюджет: ${s.budgetRubWeekly} ₽/нед | CPC: ${s.projectedCpc} ₽ | CAC: ${s.cacPay} ₽ | ROAS 90d: ${s.roasCohort90dPct}% | NPU: ${s.npuTotalScore}/100`);
    });
  }

  // Детальная выборка ключевых платформ в PILOT тире
  console.log('\n======================================================');
  console.log('📊 СРАВНЕНИЕ КЛЮЧЕВЫХ ПЛАТФОРМ В ПИЛОТЕ (28 000 ₽ / нед):');
  console.log('======================================================');
  const pilotList = all100.filter(s => s.budgetTier === 'PILOT');
  const keyArchetypes = [
    'TG_SEARCH_MANUAL',
    'TG_SEARCH_CLICKS',
    'TG_SEARCH_MICROCPA',
    'VK_SEARCH_MANUAL',
    'MAX_SEARCH_MANUAL',
    'COMPETITORS_MANUAL',
    'B2B_SEARCH_MANUAL',
    'RETARGET_SMART_MICROCPA',
    'YAN_CLICKS_HARDENED',
    'YAN_UNSHIELDED_RAW',
    'UPC_OMNI_CLICKS',
    'MASTER_PAY_CONV'
  ];

  const compareRows = pilotList
    .filter(s => keyArchetypes.some(k => s.name.includes(k) || s.id === 'STRAT-001' || s.id === 'STRAT-002' || s.id === 'STRAT-003' || s.id === 'STRAT-006' || s.id === 'STRAT-009' || s.id === 'STRAT-012' || s.id === 'STRAT-015' || s.id === 'STRAT-018' || s.id === 'STRAT-020' || s.id === 'STRAT-021' || s.id === 'STRAT-023' || s.id === 'STRAT-025'))
    .map(s => ({
      ID: s.id,
      Канал: s.channel,
      Кластер: s.cluster,
      Стратегия: s.bidding,
      Защита: s.shielding,
      CPC: `${s.projectedCpc} ₽`,
      Клики: s.weeklyClicks,
      'Лиды (Рег)': s.weeklyRegistrations,
      'CPA Рег': `${s.cpaReg} ₽`,
      Оплаты: s.weeklyPayingUsers,
      CAC: `${s.cacPay} ₽`,
      '1st ROAS': `${s.roasFirstTouchPct}%`,
      '90d ROAS': `${s.roasCohort90dPct}%`,
      'NPU Score': `${s.npuTotalScore}/100`,
      Вердикт: s.verdict
    }));

  console.table(compareRows);

  // Сохраняем полный JSON дамп в .planning/research/
  const outPath = path.resolve(process.cwd(), '.planning', 'research', 'ppc_100_strategies_npu_evaluated.json');
  fs.writeFileSync(outPath, JSON.stringify(all100, null, 2), 'utf-8');
  console.log(`\nПолный отчет по 100 стратегиям сохранен в: ${outPath}`);
}

run();
