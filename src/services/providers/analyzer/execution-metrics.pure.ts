/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Pure Execution Metrics detector (Start Time, Speed, Quality, Custom Data).
 */
import type { Category } from './category-detector.pure';

export function detectCustomDataType(category: Category, fullContent: string): 'NONE' | 'TEXTAREA' | 'NUMBER' {
    if (category === 'POLLS' || fullContent.includes('номер ответ') || fullContent.includes('за вариант')) {
        return 'NUMBER';
    }
    if (
        fullContent.includes('свой текст') ||
        fullContent.includes('свои комментари') ||
        fullContent.includes('кастомные комментари') ||
        (fullContent.includes('кастомн') && fullContent.includes('коммент')) ||
        (fullContent.includes('по списку') && (fullContent.includes('коммент') || fullContent.includes('текст'))) ||
        (fullContent.includes('custom') && (fullContent.includes('comment') || fullContent.includes('text') || fullContent.includes('msg') || fullContent.includes('reply')))
    ) {
        return 'TEXTAREA';
    }
    return 'NONE';
}

export function detectMediaGroupAware(fullContent: string): boolean {
    return fullContent.includes('медиагрупп') || fullContent.includes('media group') || fullContent.includes('альбом');
}

export function extractRequirements(sanitizedDescription: string): string {
    let requirements = '';
    const reqKeywords = ['link:', 'url:', 'формат:', 'link format:', 'требование:', 'пример:', 'ссылка:', 'example:', 'requirement:'];
    const lines = (sanitizedDescription || '').split('\n');
    for (const line of lines) {
        const lowLine = line.toLowerCase();
        if (reqKeywords.some(k => lowLine.includes(k))) {
            requirements += line.trim() + ' ';
        }
    }
    return requirements.trim();
}

export function detectStartTime(name: string, fullContent: string, fallbackStartTime: string): string {
    const startTimeMatch = name.match(/\[?(?:start(?:\s*time)?|старт)\s*:\s*([^\]\s]+(?:\s+[^\]]+)?)\]?/i);
    if (startTimeMatch) {
        const raw = startTimeMatch[1].trim().toLowerCase();
        if (raw.includes('instant') || raw.includes('мгновенн') || raw.includes('моментальн') || raw.includes('автостарт')) return 'Мгновенно';
        if (raw.includes('0-1') || raw.includes('0 - 1') || raw.includes('1 hour') || raw.includes('1 hr')) return '0–1 час';
        if (raw.includes('0-2') || raw.includes('0 - 2') || raw.includes('2 hour') || raw.includes('2 hr')) return '0–2 часа';
        if (raw.includes('0-3') || raw.includes('0 - 3') || raw.includes('3 hour') || raw.includes('3 hr')) return '0–3 часа';
        if (raw.includes('0-8') || raw.includes('0 - 8') || raw.includes('8 hour') || raw.includes('8 hr')) return '0–8 часов';
        if (raw.includes('0-24') || raw.includes('0 - 24') || raw.includes('24 hour') || raw.includes('24 hr')) return '0–24 часа';
        if (raw.includes('48 hour') || raw.includes('48 hr')) return 'до 48 часов';
        if (raw.includes('5-15') || raw.includes('5 - 15') || raw.includes('15 min') || raw.includes('15 мин')) return '5–15 мин';
        if (raw.includes('30 min') || raw.includes('30 мин')) return 'до 30 мин';
        return startTimeMatch[1].trim();
    }
    if (fullContent.includes('instant') || fullContent.includes('мгновенн') || fullContent.includes('моментальн') || fullContent.includes('автостарт')) {
        return 'Мгновенно';
    }
    if (fullContent.includes('0-1') || fullContent.includes('0 - 1')) {
        return '0–1 час';
    }
    if (fullContent.includes('0-24') || fullContent.includes('0 - 24')) {
        return '0–24 часа';
    }
    return fallbackStartTime;
}

export function detectSpeedText(
    name: string,
    fullContent: string,
    velocity: number | null | undefined,
    fallbackSpeedText: string
): string {
    const speedMatch = name.match(/\[?(?:speed|скорость)\s*:\s*([^\]]+)\]?/i);
    if (speedMatch) {
        let s = speedMatch[1].trim();
        s = s.replace(/up\s*to\s*/i, 'до ');
        s = s.replace(/(\d+(?:\.\d+)?)\s*([kmкм])?\s*\/\s*(?:d|day|days|сут|сутки|день)/i, (_, num, mult) => {
            const m = (mult || '').toLowerCase();
            const mStr = m === 'k' || m === 'к' ? 'k' : m === 'm' || m === 'м' ? ' млн' : '';
            return `до ${num}${mStr} / день`;
        });
        if (s.toLowerCase() === 'fast' || s.toLowerCase().includes('быстр')) return 'Быстрая';
        if (s.toLowerCase() === 'gradual' || s.toLowerCase().includes('плавн')) return 'Плавная';
        if (s.toLowerCase() === 'slow' || s.toLowerCase().includes('медленн')) return 'Плавная';
        return s;
    }
    if (velocity) {
        return velocity >= 1000 ? `до ${velocity / 1000}k / день` : `до ${velocity} / день`;
    }
    if (fullContent.includes('fast') || fullContent.includes('быстр') || fullContent.includes('⚡')) {
        return 'Быстрая';
    }
    if (fullContent.includes('gradual') || fullContent.includes('плавн') || fullContent.includes('drip')) {
        return 'Плавная';
    }
    return fallbackSpeedText;
}

export function resolveQualityLabel(
    tokenTier: string | undefined,
    compilerTier: string | undefined,
    fallbackQuality: string
): string {
    const qualityMap: Record<string, string> = {
        PREMIUM: 'Премиум',
        HIGH: 'Живые',
        MEDIUM: 'Стандарт',
        LOW: 'Эконом',
        BOTS: 'Боты',
        UNKNOWN: 'Стандарт'
    };
    const tokenQuality = tokenTier ? qualityMap[tokenTier] : undefined;
    if (compilerTier && compilerTier !== 'Эконом') {
        return compilerTier;
    }
    return tokenQuality || fallbackQuality;
}
