/**
 * (c) 2026 SMMplan / SMMflux.
 * Content Guard & Legal Compliance Validator.
 * Enforces strict zero-tolerance prohibition of government, political, election,
 * extremist, and state agency promotion across all ordering pipelines.
 */

// 1. Blacklist of Government, State Agency & Public Voting Domains
export const PROHIBITED_GOVERNMENT_DOMAINS = [
  'gosuslugi.ru',
  'госуслуги.рф',
  'roi.ru',
  'роис.рф',
  'kremlin.ru',
  'президент.рф',
  'government.ru',
  'правительство.рф',
  'duma.gov.ru',
  'дума.рф',
  'council.gov.ru',
  'genproc.gov.ru',
  'mvd.ru',
  'мвд.рф',
  'mvd.gov.ru',
  'fsb.ru',
  'фсб.рф',
  'mil.ru',
  'минобороны.рф',
  'sudrf.ru',
  'vsrf.ru',
  'ksrf.ru',
  'cikrf.ru',
  'цик.рф',
  'nalog.gov.ru',
  'nalog.ru',
  'налог.рф',
  'cbr.ru',
  'цб.рф',
  'customs.gov.ru',
  'fss.gov.ru',
  'fssprus.ru',
  'sfr.gov.ru',
  'pfr.gov.ru',
  'mos.ru',
  'spb.ru',
  'rkn.gov.ru',
  'fas.gov.ru',
  'rospotrebnadzor.ru',
  'mchs.gov.ru',
  'fsin.gov.ru',
  'fsin.ru',
  'minjust.gov.ru',
  'minjust.ru',
  'mid.ru',
  'ombudsmanrf.org',
  'change.org',
  'podpishi.org',
];

// 2. Prohibited Political & Government Slug / Keyword Patterns
const PROHIBITED_LINK_PATTERNS = [
  /\.gov\.ru/i,
  /\.mil\.ru/i,
  /\.mvd\.ru/i,
  /\.fsb\.ru/i,
  /\.sudrf\.ru/i,
  /\.duma\.ru/i,
  /(?:^|[^a-z0-9])(?:vybory|elect|vybor|cikrf|gosuslugi|kremlin|mvd_official|fsb_official|fsin_official)(?:[^a-z0-9]|$)/i,
];

// 3. Prohibited Text Patterns in Custom Comments / Custom Data
const PROHIBITED_TEXT_PATTERNS = [
  /(?:выбор|голос|кандидат|предвыборн|бюллетен|избирательн|госуслуг|петици|митинг|протест|забастовк)/iu,
  /(?:свержение власти|госпереворот|несанкционированн|террорист|экстремист)/iu,
  /(?:дискредитаци|фейк.*арми|взрывчат|изготовлени.*оруж)/iu,
  /(?:фбк|навальн|легион свобод|рпк|терроризм|экстремизм)/iu,
];

export interface ContentValidationResult {
  isAllowed: boolean;
  error?: string;
  code?: 'GOVERNMENT_SERVICE_PROHIBITED' | 'POLITICAL_CONTENT_PROHIBITED' | 'EXTREMIST_CONTENT_PROHIBITED';
}

/**
 * Validates a target link and optional custom comment text against
 * the prohibited political, governmental, and extremist content matrices.
 */
export function validateProhibitedContent(link: string, customData?: string): ContentValidationResult {
  if (!link) {
    return { isAllowed: true };
  }

  const normalizedLink = link.toLowerCase().trim();

  // Check 1: Prohibited Government Domains
  for (const domain of PROHIBITED_GOVERNMENT_DOMAINS) {
    if (normalizedLink.includes(domain)) {
      return {
        isAllowed: false,
        code: 'GOVERNMENT_SERVICE_PROHIBITED',
        error: 'Продвижение государственных служб, ведомств, органов власти и систем голосования категорически запрещено (п. 2.1 Правил сервиса).'
      };
    }
  }

  // Check 2: Prohibited Government & Political Link Patterns
  for (const pattern of PROHIBITED_LINK_PATTERNS) {
    if (pattern.test(normalizedLink)) {
      return {
        isAllowed: false,
        code: 'POLITICAL_CONTENT_PROHIBITED',
        error: 'Продвижение ресурсов с государственной или политической направленностью запрещено правилами платформы (п. 2.1 Правил сервиса).'
      };
    }
  }

  // Check 3: Prohibited Custom Comment / Text Content
  if (customData && customData.trim().length > 0) {
    const normalizedText = customData.toLowerCase();
    for (const pattern of PROHIBITED_TEXT_PATTERNS) {
      if (pattern.test(normalizedText)) {
        return {
          isAllowed: false,
          code: 'POLITICAL_CONTENT_PROHIBITED',
          error: 'Указанный текст содержит запрещённую политическую, агитационную или противоправную тематику (п. 2.1 Правил сервиса).'
        };
      }
    }
  }

  return { isAllowed: true };
}
