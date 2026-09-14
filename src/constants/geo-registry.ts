/**
 * Shared Canonical Geography Registry (OmniSMM 1.0 SIL-2026)
 * Single Source of Truth for geo-detection across services and name-tokenizers.
 */

export const GEO_MAP: Record<string, string[]> = {
    'RU': ['россия', 'рф', 'ru', '🇷🇺', 'русские'],
    'USA': ['сша', 'usa', '🇺🇸', 'english', 'worldwide'],
    'KZ': ['казахстан', 'кз', 'kz', '🇰🇿'],
    'UZ': ['узбекистан', 'uz', '🇺🇿'],
    'UA': ['украина', 'ua', '🇺🇦'],
    'TR': ['турция', 'tr', '🇹🇷', 'turkey'],
    'IN': ['индия', 'in', '🇮🇳', 'india'],
    'BR': ['бразилия', 'br', '🇧🇷'],
    'IL': ['израиль', 'il', '🇮🇱'],
    'AR': ['араб', 'arabic', '🇦🇪'],
    'CN': ['китай', 'china', '🇨🇳'],
};

export const GEO_LABELS: Record<string, string> = {
    'RU': 'Россия / РФ',
    'USA': 'США / Worldwide',
    'KZ': 'Казахстан',
    'UZ': 'Узбекистан',
    'UA': 'Украина',
    'TR': 'Турция',
    'IN': 'Индия',
    'BR': 'Бразилия',
    'IL': 'Израиль',
    'AR': 'Арабские страны',
    'CN': 'Китай',
    'WORLDWIDE': 'Весь мир',
};
