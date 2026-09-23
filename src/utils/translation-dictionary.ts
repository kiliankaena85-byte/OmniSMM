/**
 * SMMplan Translation & Normalization Dictionary
 * Сгенерировано ИИ (Antigravity) на основе кластеризации 5000+ услуг провайдеров.
 * Обеспечивает строгий детерминированный перевод (без галлюцинаций LLM в продакшене).
 */

const GeoDictionary: Record<string, string> = {
    // СНГ / Россия
    'RU': 'Россия',
    'RUSSIA': 'Россия',
    'CIS': 'СНГ',
    'UKRAINE': 'Украина',
    'BELARUS': 'Беларусь',
    'KAZAKHSTAN': 'Казахстан',
    'UZBEKISTAN': 'Узбекистан',
    
    // Азия / Арабы
    'ARAB': 'Арабские страны',
    'UAE': 'ОАЭ',
    'TURKEY': 'Турция',
    'INDIA': 'Индия',
    'IRAN': 'Иран',
    'ASIA': 'Азия',

    // Запад
    'USA': 'США',
    'UK': 'Великобритания',
    'EUROPE': 'Европа',
    'LATAM': 'Латинская Америка',
    'BRAZIL': 'Бразилия',

    // Глобал
    'WORLDWIDE': 'Весь мир',
    'MIX': 'Весь мир (Смешанное)',
    'GLOBAL': 'Весь мир',
};

const QualityTiers = {
    REAL: 'Живые',
    PREMIUM: 'Премиум',
    STANDARD: 'Стандарт',
    ECONOMY: 'Эконом',
};

const TranslationPatterns = [
    // Гарантии (Refill)
    { pattern: /no\s*drop/i, translation: 'Без отписок', isRefill: true, warrantyDays: 30 },
    { pattern: /r\s*30/i, translation: 'Гарантия 30 дней', isRefill: true, warrantyDays: 30 },
    { pattern: /гарантия\s*30д/i, translation: 'Гарантия 30 дней', isRefill: true, warrantyDays: 30 },
    { pattern: /гарантия\s*14д/i, translation: 'Гарантия 14 дней', isRefill: true, warrantyDays: 14 },
    { pattern: /r\s*60/i, translation: 'Гарантия 60 дней', isRefill: true, warrantyDays: 60 },
    { pattern: /r\s*99/i, translation: 'Вечная гарантия (99 дней)', isRefill: true, warrantyDays: 99 },
    { pattern: /refill\s*30/i, translation: 'Гарантия 30 дней', isRefill: true, warrantyDays: 30 },
    { pattern: /lifetime/i, translation: 'Пожизненная гарантия', isRefill: true, warrantyDays: 365 },
    { pattern: /no\s*refill/i, translation: 'Без гарантии', isRefill: false, warrantyDays: 0 },
    { pattern: /без\s*гарантии/i, translation: 'Без гарантии', isRefill: false, warrantyDays: 0 },
    
    // Качество (Quality)
    { pattern: /uhq/i, translation: 'Сверхвысокое качество (UHQ)', tier: QualityTiers.PREMIUM },
    { pattern: /hq/i, translation: 'Высокое качество', tier: QualityTiers.PREMIUM },
    { pattern: /high\s*quality/i, translation: 'Высокое качество', tier: QualityTiers.PREMIUM },
    { pattern: /lq/i, translation: 'Низкое качество', tier: QualityTiers.ECONOMY },
    { pattern: /low\s*quality/i, translation: 'Низкое качество', tier: QualityTiers.ECONOMY },
    { pattern: /real/i, translation: 'Реальные аккаунты', tier: QualityTiers.PREMIUM },
    { pattern: /ру\s*сим/i, translation: 'Регистрация на RU-симкарты', tier: QualityTiers.PREMIUM },
    { pattern: /ии\s*ключевые\s*слова/i, translation: 'Интеллектуальная накрутка (ИИ)', tier: QualityTiers.PREMIUM },
    { pattern: /active/i, translation: 'Активные пользователи', tier: QualityTiers.PREMIUM },
    { pattern: /bots/i, translation: 'Боты', tier: QualityTiers.ECONOMY },
    { pattern: /fake/i, translation: 'Фейки', tier: QualityTiers.ECONOMY },
    { pattern: /mix/i, translation: 'Смешанное качество', tier: QualityTiers.STANDARD },
    { pattern: /микс/i, translation: 'Смешанное качество', tier: QualityTiers.STANDARD },
    
    // Скорость (Speed)
    { pattern: /instant/i, translation: 'Моментальный старт', velocityScore: 100 },
    { pattern: /fast/i, translation: 'Высокая скорость', velocityScore: 80 },
    { pattern: /slow/i, translation: 'Медленная скорость', velocityScore: 20 },
    { pattern: /gradual/i, translation: 'Плавное выполнение', velocityScore: 40 },
    { pattern: /\d+к\/д/i, translation: 'Высокая скорость (десятки тысяч в сутки)', velocityScore: 80 },
    
    // Специфика / Исключения (Edge cases)
    { pattern: /non?\s*drop/i, translation: 'Минимальные отписки', isRefill: true },
    { pattern: /возможны\s*списания/i, translation: 'Возможны списания (без восстановления)' },
    { pattern: /списания\s*возможны/i, translation: 'Возможны списания (без восстановления)' },
    { pattern: /targeted/i, translation: 'Целевая аудитория' },
    { pattern: /auto/i, translation: 'Автоматически (на новые посты)' },
    { pattern: /views\s*with\s*impressions/i, translation: 'Просмотры с охватом' },
    { pattern: /retention/i, translation: 'С удержанием' },
];

/**
 * Нормализует гео-тег из квадратных скобок (например, [RU] -> Россия)
 */
export function normalizeGeo(rawGeo: string | undefined): string {
    if (!rawGeo) return GeoDictionary['WORLDWIDE'];
    const clean = rawGeo.replace(/\[|\]/g, '').toUpperCase().trim();
    return GeoDictionary[clean] || `Уточняется (${clean})`;
}

/**
 * Парсер-компилятор: проходит по паттернам и собирает метрики
 */
export function compileServiceMetrics(serviceName: string, basePriceUsd: number) {
    let descriptionChunks: string[] = [];
    let isRefill = false;
    let warrantyDays = 0;
    let velocityScore = 50; // default
    let tier = QualityTiers.ECONOMY; // default for safety (Anti-Liar)

    TranslationPatterns.forEach(rule => {
        if (rule.pattern.test(serviceName)) {
            descriptionChunks.push(rule.translation);
            
            if (rule.isRefill !== undefined) isRefill = rule.isRefill;
            if (rule.warrantyDays !== undefined) warrantyDays = rule.warrantyDays;
            if (rule.velocityScore !== undefined) velocityScore = rule.velocityScore;
            
            // Если правило диктует качество
            if (rule.tier) {
                // Исключение: Живые/Premium не могут стоить копейки (Anti-Liar Matrix)
                if ((rule.tier === QualityTiers.REAL || rule.tier === QualityTiers.PREMIUM) && basePriceUsd < 1.0) {
                    // Даунгрейд тарифа, если цена подозрительно низкая
                    tier = QualityTiers.STANDARD;
                    descriptionChunks.push('Заявлено высокое качество (не подтверждено)');
                } else {
                    tier = rule.tier;
                }
            }
        }
    });

    // Дедупликация чанков описания
    descriptionChunks = Array.from(new Set(descriptionChunks));

    return {
        tier,
        isRefill,
        warrantyDays,
        velocityScore,
        translatedTags: descriptionChunks
    };
}
