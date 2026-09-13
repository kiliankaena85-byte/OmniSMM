import fs from 'fs';
import path from 'path';
import {
  SkillRoutingResult,
  SkillRouteMatch,
  SkillDomain
} from '../src/types/skills-contract';

const SKILLS_DIR = path.resolve(__dirname, '../.agents/skills');

interface SkillRuleDef {
  name: string;
  title: string;
  domain: SkillDomain;
  keywords: string[];
}

const SKILL_RULES: SkillRuleDef[] = [
  {
    name: 'concurrency-acid-guard',
    title: 'Финансовая целостность, BigInt & Concurrency',
    domain: 'concurrency_acid',
    keywords: ['баланс', 'списание', 'пополнение', 'деньги', 'walletops', 'exactmath', 'транзакция', 'возврат', 'p2002', 'гонка', 'lock', 'idempotency']
  },
  {
    name: 'ddd-aggregate-invariants',
    title: 'DDD Агрегаты & Drip-Feed Floor',
    domain: 'domain_boundary',
    keywords: ['заказ', 'статус', 'отмена заказа', 'drip-feed', 'drip', 'floor', 'агрегат', 'shadow catalog', 'переход статуса']
  },
  {
    name: 'compliance-54fz-auditor',
    title: 'Фискальный комплаенс 54-ФЗ & НДС 2026',
    domain: 'domain_boundary',
    keywords: ['54-фз', 'чек', 'фискальный', 'ндс', 'усн', 'vat_code', 'онлайн-касса', 'аванс', 'офд', 'юkassa чек']
  },
  {
    name: 'arch-boundary-guard',
    title: 'Чистота слоев Clean Architecture & Server Actions',
    domain: 'domain_boundary',
    keywords: ['clean architecture', 'слои', 'server action', 'page.tsx', 'use server', 'use client', 'компонент', 'dto']
  },
  {
    name: 'docker-lean-build-ops',
    title: 'Бережливая сборка Docker & Защита от фризов ПК',
    domain: 'infra_host_ops',
    keywords: ['docker', 'сборка', 'build', 'зависание', 'фриз', 'cpu', 'affinity', 'belownormal', 'prune', 'память', 'bloat', 'lean']
  },
  {
    name: 'owasp-asvs-sentinel',
    title: 'Пентест-иммунитет OWASP Top 10:2025 & CSP Nonce',
    domain: 'security_defense',
    keywords: ['безопасность', 'security', 'owasp', 'csp', 'nonce', 'strict-dynamic', 'idor', 'bola', 'hmac', 'ratelimit']
  },
  {
    name: 'multi-tenant-isolation-arch',
    title: 'Изоляция Мульти-Тенантов SMMplan & SMMflux',
    domain: 'resilience_multitenant',
    keywords: ['tenant', 'тенант', 'мульти-тенант', 'smmflux', 'smmplan', 'brand', 'утечка', 'ст. 54.1']
  },
  {
    name: 'ui-design-system-steward',
    title: 'Хранитель Дизайн-Системы & Семантических Токенов Tailwind 4',
    domain: 'frontend_ui',
    keywords: ['токен', 'семантическ', 'tailwind', 'цвет', 'хардкод', '@theme', 'дизайн', 'палитр', 'стилизаци']
  },
  {
    name: 'viewport-responsive-density',
    title: 'Плотность Данных, Viewport 100% Fit & Zero-Scroll',
    domain: 'frontend_ui',
    keywords: ['скролл', 'горизонтальн', 'плотност', 'таблиц', 'modal hoisting', 'колонки', 'truncate', 'zero-scroll', 'модал']
  },
  {
    name: 'mobile-cro-interaction',
    title: 'Мобильный Чекаут (CRO), Степперы & Touch Targets >= 44px',
    domain: 'frontend_ui',
    keywords: ['мобильн', 'визард', 'touch', 'тач-таргет', 'степпер', 'кнопк', 'внизу', 'pb-safe', 'inputmode', 'cro']
  },
  {
    name: 'heroui-v3-compound-guard',
    title: 'HeroUI v3 Compound Components Dot-Notation Standard',
    domain: 'frontend_ui',
    keywords: ['heroui', 'nextui', 'table.header', 'compound', 'selectedkeys', 'selectionmode', 'dot-notation', 'emptycontent', 'таблиц']
  },
  {
    name: 'react-19-next-16-ui-engine',
    title: 'React 19 Actions, Optimistic UI & Streaming SSR Suspense',
    domain: 'frontend_ui',
    keywords: ['react 19', 'useactionstate', 'useoptimistic', 'useformstatus', 'action', 'suspense', 'скелетон', 'стриминг', 'оптимистич']
  },
  {
    name: 'client-hydration-perf-guard',
    title: 'Zero Hydration Mismatch, Dynamic Imports & First Load JS < 150KB',
    domain: 'frontend_ui',
    keywords: ['гидратаци', 'hydration', 'mismatch', 'tolocaledatestring', 'next dynamic', 'динамическ', 'график', 'бандл', 'safe svg']
  },
  {
    name: 'omnismm-checkout-integrity-guard',
    title: 'OmniSMM Checkout & Wizard Integrity (ExactMath, Drip-Feed Floor & Mobile CRO)',
    domain: 'domain_boundary',
    keywords: ['чекаут', 'checkout', 'визард', 'wizard', 'drip-feed', 'drip', 'floor', 'exactmath', 'оформление заказа', 'расчет цены', 'калькулятор заказа', 'smmplanorderwizard', 'fluxdashboardorderwizard']
  },
  {
    name: 'antigravity-flash-ui-refactor',
    title: 'Прецизионный рефакторинг UI под Gemini Flash (Chunked Diff & 200 Lines)',
    domain: 'frontend_ui',
    keywords: ['рефакторинг', 'gemini flash', 'flash', 'chunked diff', 'antigravity ui', '200 строк', 'монолит', 'переписать']
  },
  {
    name: 'antigravity-widget-studio',
    title: 'Интерактивная студия Generative UI виджетов (agent-embed & Live Preview)',
    domain: 'frontend_ui',
    keywords: ['виджет', 'widget', 'agent-embed', 'generative ui', 'калькулятор', 'прототип', 'интерактивн']
  },
  {
    name: 'flash-component-decomposer',
    title: 'Архитектурная декомпозиция компонентов (View vs Logic Decoupling)',
    domain: 'frontend_ui',
    keywords: ['декомпозици', 'разделение', 'view', 'хук', 'use', 'god component', 'modal hoisting']
  },
  {
    name: 'google-stitch-architect',
    title: 'Google Stitch Generative UI & Zero-Slop Architecture',
    domain: 'frontend_ui',
    keywords: ['stitch', 'google stitch', 'дизайн-код', 'генерация ui', 'zero-slop', 'клише', 'дизайн-днк', 'макет']
  },
  {
    name: 'yandex-gravity-ui-steward',
    title: 'Дизайн-система Yandex Gravity UI & Enterprise Tables',
    domain: 'frontend_ui',
    keywords: ['gravity ui', 'gravity', 'yandex ui', 'яндекс ui', 'uikit', 'таблиц', 'enterprise']
  },
  {
    name: 'yandex-seo-search-architect',
    title: 'Яндекс SEO, Вебмастер, ИКС & Микроразметка Schema.org',
    domain: 'resilience_multitenant',
    keywords: ['ceo', 'seo', 'яндекс поиск', 'вебмастер', 'икс', 'сниппет', 'schema.org', 'микроразметк', 'баден-баден', 'clean-param', 'sitemap', 'yandexbot']
  },
  {
    name: 'yandex-services-integrator',
    title: 'Сервисы Yandex: SmartCaptcha, Metrika & Yandex Pay',
    domain: 'security_defense',
    keywords: ['yandex', 'яндекс', 'smartcaptcha', 'капч', 'метрик', 'metrika', 'вебвизор', 'webvisor', 'yandex pay']
  },
  {
    name: 'mobile-first-responsive-architect',
    title: 'Mobile-First Responsive Engineering (Смартфон -> Десктоп)',
    domain: 'frontend_ui',
    keywords: ['телефон', 'смартфон', 'mobile first', 'мобильн', 'адаптив', 'десктоп', 'safe area', 'dvh', 'thumb zone', 'тач', '44px', 'зум', 'авто-зум', 'safari', 'touch']
  }
];

export function routeSkillIntent(query: string): SkillRoutingResult {
  const normalizedQuery = query.toLowerCase();
  const matchedSkills: SkillRouteMatch[] = [];

  for (const rule of SKILL_RULES) {
    const matchedKeywords = rule.keywords.filter(kw => normalizedQuery.includes(kw));
    if (matchedKeywords.length > 0) {
      const confidence = Math.min(1, Math.round((matchedKeywords.length / 2) * 100) / 100);
      const corePath = path.join(SKILLS_DIR, rule.name, 'CORE.md');
      const deepPath = path.join(SKILLS_DIR, rule.name, 'SKILL.md');

      let coreContent = '';
      if (fs.existsSync(corePath)) {
        coreContent = fs.readFileSync(corePath, 'utf-8');
      }

      matchedSkills.push({
        name: rule.name,
        title: rule.title,
        domain: rule.domain,
        confidence,
        matchedKeywords,
        corePath,
        deepPath,
        coreContent
      });
    }
  }

  // Сортировка по уверенности
  matchedSkills.sort((a, b) => b.confidence - a.confidence);

  // Оценка токенов (1 токен ~ 4 символа для английского/кода, ~ 2 для русского)
  let totalChars = 0;
  matchedSkills.forEach(s => {
    if (s.coreContent) totalChars += s.coreContent.length;
  });
  const totalTokensEstimated = Math.ceil(totalChars / 3.2);

  // Сборка готового бандла для промпта
  const promptParts = [
    '# 🎯 JIT ACTIVE ARCHITECTURAL INVARIANTS (L1 Core)',
    `Activated for query: "${query}"`,
    '--------------------------------------------------'
  ];

  for (const skill of matchedSkills) {
    if (skill.coreContent) {
      promptParts.push(skill.coreContent.trim());
      promptParts.push('--------------------------------------------------');
    }
  }

  return {
    query,
    matchedSkills,
    totalTokensEstimated,
    bundledCorePrompt: promptParts.join('\n\n')
  };
}

// CLI Execution
if (require.main === module) {
  const queryArg = process.argv.slice(2).join(' ');
  if (!queryArg) {
    console.log('Usage: npx tsx scripts/skill-router.ts "<task description or query>"');
    process.exit(1);
  }

  const result = routeSkillIntent(queryArg);
  console.log('\n======================================================');
  console.log('  OmniSMM JIT Skill Router (v2.0)                     ');
  console.log('======================================================');
  console.log(`Query: "${result.query}"`);
  console.log(`Matched Skills: ${result.matchedSkills.length}`);
  console.log(`Estimated Context Budget: ${result.totalTokensEstimated} tokens (L1 Core)\n`);

  for (const match of result.matchedSkills) {
    console.log(`⭐ [${match.name}] (Confidence: ${Math.round(match.confidence * 100)}%)`);
    console.log(`   Title: ${match.title}`);
    console.log(`   Keywords: ${match.matchedKeywords.join(', ')}`);
    console.log(`   Core Path: ${match.corePath}`);
  }
  console.log('======================================================\n');
}
