import { assertSafeUrl } from '../../src/utils/ssrf-guard';

export interface TelegramPriceMention {
  service: string;
  price: number;
  currency: string;
  rawMatch: string;
}

export interface TelegramPost {
  postId: string;
  channelSlug: string;
  postUrl: string;
  publishedAt: string;
  rawText: string;
  cleanText: string;
  detectedApis: string[];
  detectedBots: string[];
  detectedKeywords: string[];
  detectedPrices: TelegramPriceMention[];
  views?: string;
}

export interface TelegramChannelReport {
  channelSlug: string;
  channelTitle: string;
  channelUrl: string;
  scannedAt: string;
  postsScanned: number;
  trustScore: number;
  discoveredApis: string[];
  discoveredBots: string[];
  wholesalePricing: TelegramPriceMention[];
  posts: TelegramPost[];
  status: 'SUCCESS' | 'EMPTY' | 'ERROR';
  errorMessage?: string;
}

export class TelegramChannelHarvester {
  private static readonly USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

  /**
   * Загружает публичный HTML-снапшот канала через официальный веб-шлюз t.me/s/
   */
  public static async fetchChannelHtml(
    channelSlug: string,
    timeoutMs: number = 8000
  ): Promise<string> {
    const cleanSlug = channelSlug.replace(/^@/, '').trim();
    if (!cleanSlug || !/^[a-zA-Z0-9_]{4,}$/.test(cleanSlug)) {
      throw new Error(`Некорректный slug Telegram канала: "${channelSlug}"`);
    }

    const targetUrl = `https://t.me/s/${cleanSlug}`;
    await assertSafeUrl(targetUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} при обращении к ${targetUrl}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Извлекает сообщения и метаданные из HTML-страницы канала
   */
  public static parseChannelHtml(
    html: string,
    channelSlug: string
  ): { title: string; posts: TelegramPost[] } {
    const cleanSlug = channelSlug.replace(/^@/, '').trim();

    // Извлечение заголовка канала
    let title = cleanSlug;
    const titleMatch = html.match(/<div class="tgme_channel_info_header_title"[^>]*><span[^>]*>(.*?)<\/span>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    } else {
      const ogTitle = html.match(/<meta property="og:title" content="(.*?)"/i);
      if (ogTitle && ogTitle[1]) {
        title = ogTitle[1].trim();
      }
    }

    const posts: TelegramPost[] = [];
    const messageWrapRegex = /<div class="tgme_widget_message_wrap[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
    const individualMsgRegex = /data-post="([^"]+)"[\s\S]*?(?:<time[^>]*datetime="([^"]+)"[^>]*>)?[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

    let match: RegExpExecArray | null;
    while ((match = individualMsgRegex.exec(html)) !== null) {
      const fullPostId = match[1]; // e.g. "channel_slug/1234"
      const publishedAt = match[2] || new Date().toISOString();
      const rawTextHtml = match[3];

      // Очистка HTML тегов и извлечение ссылок
      const cleanText = rawTextHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      const analysis = this.analyzePostText(cleanText, rawTextHtml);

      // Извлечение просмотров поста, если есть
      const viewsMatch = rawTextHtml.match(/<span class="tgme_widget_message_views"[^>]*>([\s\S]*?)<\/span>/i);
      const views = viewsMatch ? viewsMatch[1].replace(/<[^>]+>/g, '').trim() : undefined;

      posts.push({
        postId: fullPostId,
        channelSlug: cleanSlug,
        postUrl: `https://t.me/${fullPostId}`,
        publishedAt,
        rawText: rawTextHtml,
        cleanText,
        detectedApis: analysis.apis,
        detectedBots: analysis.bots,
        detectedKeywords: analysis.keywords,
        detectedPrices: analysis.prices,
        views,
      });
    }

    return { title, posts };
  }

  /**
   * Анализирует текст поста на наличие API-эндпоинтов, Telegram-ботов, прайс-матриц и ключевых тегов
   */
  public static analyzePostText(
    text: string,
    rawHtml: string = ''
  ): {
    apis: string[];
    bots: string[];
    keywords: string[];
    prices: TelegramPriceMention[];
  } {
    const apis: Set<string> = new Set();
    const bots: Set<string> = new Set();
    const keywords: Set<string> = new Set();
    const prices: TelegramPriceMention[] = [];

    const combinedSource = `${text}\n${rawHtml}`;

    // 1. Поиск API эндпоинтов и SMM панелей
    const apiRegexes = [
      /https?:\/\/[a-zA-Z0-9.-]+\/(?:api\/v2|api\/v1|api)\b[^\s"'<>]*/gi,
      /https?:\/\/(?:www\.)?[a-zA-Z0-9-]+\.(?:ru|com|pro|cc|net|io|shop|biz|im|org|me)\b[^\s"'<>]*(?:action=services|api)/gi,
      /https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:smm|boost|nakrutka|panel|liker|soc)[a-zA-Z0-9-]*\.(?:ru|com|pro|cc|net|io|shop|biz|im)\b/gi,
    ];

    for (const regex of apiRegexes) {
      const matches = combinedSource.match(regex);
      if (matches) {
        for (const m of matches) {
          const cleanUrl = m.replace(/[),.;]+$/, '');
          if (!cleanUrl.includes('t.me') && !cleanUrl.includes('telegram.org')) {
            apis.add(cleanUrl);
          }
        }
      }
    }

    // 2. Поиск Telegram-ботов (@...bot)
    const botRegex = /@([a-zA-Z0-9_]{3,32}(?:bot|Bot|BOT))\b/g;
    let botMatch: RegExpExecArray | null;
    while ((botMatch = botRegex.exec(combinedSource)) !== null) {
      bots.add(`@${botMatch[1]}`);
    }

    // 3. Поиск ключевых отраслевых маркеров
    const keywordSignatures = [
      { tag: 'API_V2', re: /(?:api[\s/_-]*v2|action=services|api_key|endpoints?|#api\b)/i },
      { tag: 'TG_BOOSTS', re: /(?:буст|бусты|boosts?|level\s*boost|буст\s*канал)/iu },
      { tag: 'TG_STARS', re: /(?:звезд|звезды|stars?|telegram\s*stars?)/iu },
      { tag: 'MINI_APPS', re: /(?:mini\s*apps?|рефералы|referrals?|кликер|clicker)/iu },
      { tag: 'WHOLESALE', re: /(?:опт|оптом|реселлер|reseller|поставщик|дилер|первоисточник)/iu },
      { tag: 'DISCOUNT', re: /(?:промокод|скидк|акция|бонус|discount|coupon)/iu },
      { tag: 'STREAMS', re: /(?:twitch|kick|youtube\s*стрим|онлайн\s*зрител|stream\s*viewers?)/iu },
    ];

    for (const kw of keywordSignatures) {
      if (kw.re.test(text)) {
        keywords.add(kw.tag);
      }
    }

    // 4. Поиск тарифов и цен
    const pricePatterns = [
      {
        service: 'Telegram Бусты',
        re: /(?:буст|boost)\w*\s*(?:от|—|-|:)?\s*(\d+[.,]?\d*)\s*(₽|руб|коп|\$|usd|usdt)/gi,
      },
      {
        service: 'Telegram Stars',
        re: /(?:звезд|stars?)\s*(?:от|—|-|:)?\s*(\d+[.,]?\d*)\s*(₽|руб|\$|usd|usdt)/gi,
      },
      {
        service: 'Просмотры',
        re: /(?:просмотр|views?)\s*(?:от|—|-|:)?\s*(\d+[.,]?\d*)\s*(₽|руб|коп|\$|usd)/gi,
      },
      {
        service: 'Подписчики',
        re: /(?:подписчик|members?|followers?)\s*(?:от|—|-|:)?\s*(\d+[.,]?\d*)\s*(₽|руб|\$|usd)/gi,
      },
      {
        service: 'Реакции',
        re: /(?:реакци|reactions?)\s*(?:от|—|-|:)?\s*(\d+[.,]?\d*)\s*(₽|руб|коп|\$|usd)/gi,
      },
    ];

    for (const pattern of pricePatterns) {
      let pMatch: RegExpExecArray | null;
      while ((pMatch = pattern.re.exec(text)) !== null) {
        const rawNum = pMatch[1].replace(',', '.');
        const num = parseFloat(rawNum);
        const rawCurr = pMatch[2].toLowerCase();
        let currency = 'RUB';
        if (rawCurr.includes('$') || rawCurr.includes('usd') || rawCurr.includes('usdt')) {
          currency = 'USD';
        } else if (rawCurr.includes('коп')) {
          currency = 'KOP';
        }

        if (!isNaN(num) && num > 0) {
          prices.push({
            service: pattern.service,
            price: currency === 'KOP' ? num / 100 : num,
            currency: currency === 'KOP' ? 'RUB' : currency,
            rawMatch: pMatch[0],
          });
        }
      }
    }

    return {
      apis: Array.from(apis),
      bots: Array.from(bots),
      keywords: Array.from(keywords),
      prices,
    };
  }

  /**
   * Вычисляет Heuristic Trust Score канала (0.0 — 10.0)
   */
  public static calculateTrustScore(
    channelTitle: string,
    posts: TelegramPost[],
    discoveredApis: string[]
  ): number {
    let score = 5.0; // Базовый нейтральный скор

    if (posts.length === 0) return 1.0;

    // +2.0 за обнаружение реального API эндпоинта
    if (discoveredApis.length > 0) {
      score += 2.0;
    }

    // +1.5 за наличие активных постов с тарифами
    const postsWithPrices = posts.filter((p) => p.detectedPrices.length > 0);
    if (postsWithPrices.length >= 2) {
      score += 1.5;
    }

    // +1.0 за наличие специализированных ключевых тегов (API_V2, TG_BOOSTS)
    const hasApiKeyword = posts.some((p) => p.detectedKeywords.includes('API_V2'));
    if (hasApiKeyword) score += 1.0;

    const hasBoostKeyword = posts.some((p) => p.detectedKeywords.includes('TG_BOOSTS'));
    if (hasBoostKeyword) score += 0.5;

    // Штрафы за признаки скама:
    const scamSignals = posts.filter((p) =>
      /(?:карта физлица|перевод на сбер|киви без сайта|без гарантий|100% предоплата в лс)/i.test(
        p.cleanText
      )
    );
    if (scamSignals.length > 0) {
      score -= 3.0;
    }

    // Нормализация в диапазон [0.0, 10.0]
    return Math.max(0.0, Math.min(10.0, Math.round(score * 10) / 10));
  }

  /**
   * Сканирует Telegram-канал и формирует структурированный аналитический отчет
   */
  public static async harvestChannel(
    channelSlug: string,
    options?: { maxPosts?: number; timeoutMs?: number }
  ): Promise<TelegramChannelReport> {
    const cleanSlug = channelSlug.replace(/^@/, '').trim();
    const channelUrl = `https://t.me/${cleanSlug}`;

    try {
      const html = await this.fetchChannelHtml(cleanSlug, options?.timeoutMs);
      const { title, posts } = this.parseChannelHtml(html, cleanSlug);

      const targetPosts = options?.maxPosts ? posts.slice(-options.maxPosts) : posts;

      const discoveredApis = Array.from(new Set(targetPosts.flatMap((p) => p.detectedApis)));
      const discoveredBots = Array.from(new Set(targetPosts.flatMap((p) => p.detectedBots)));
      const wholesalePricing = targetPosts.flatMap((p) => p.detectedPrices);

      const trustScore = this.calculateTrustScore(title, targetPosts, discoveredApis);

      return {
        channelSlug: cleanSlug,
        channelTitle: title,
        channelUrl,
        scannedAt: new Date().toISOString(),
        postsScanned: targetPosts.length,
        trustScore,
        discoveredApis,
        discoveredBots,
        wholesalePricing,
        posts: targetPosts,
        status: targetPosts.length > 0 ? 'SUCCESS' : 'EMPTY',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        channelSlug: cleanSlug,
        channelTitle: cleanSlug,
        channelUrl,
        scannedAt: new Date().toISOString(),
        postsScanned: 0,
        trustScore: 0.0,
        discoveredApis: [],
        discoveredBots: [],
        wholesalePricing: [],
        posts: [],
        status: 'ERROR',
        errorMessage: msg,
      };
    }
  }

  /**
   * Пакетный сбор данных по нескольким Telegram-каналам
   */
  public static async harvestMultipleChannels(
    channelSlugs: string[],
    options?: { maxPosts?: number; delayBetweenMs?: number }
  ): Promise<TelegramChannelReport[]> {
    const results: TelegramChannelReport[] = [];
    const delay = options?.delayBetweenMs ?? 1000;

    for (const slug of channelSlugs) {
      const report = await this.harvestChannel(slug, options);
      results.push(report);

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  /**
   * Предустановленный каталог известных отраслевых Telegram-каналов поставщиков
   */
  public static readonly KNOWN_SMM_CHANNELS = [
    'smm_boost_news',
    'tgpanel_alerts',
    'tegram_channel',
    'vexboost_news',
    'soc_rocket_news',
    'easyliker_updates',
    'smmway_official',
    'marketsmm_feed',
    'smmboom_news',
    'streampromotion_ru',
    'nakrutka_cc_official',
    'prskill_news',
    'prosmm_channel',
    'bosslike_news',
    'vktarget_feed',
    'mystars_tg_news',
    'gramix_alerts',
    'smmflash_channel',
    'fixedmember_news',
    'tgpanel_org_feed',
    'qcomment_official',
    'aviso_feed',
  ];

  /**
   * Зондирует обнаруженный SMM API эндпоинт методом action=services
   */
  public static async probeApiEndpoint(apiUrl: string, timeoutMs: number = 6000): Promise<{
    reachable: boolean;
    servicesCount: number;
    error?: string;
  }> {
    try {
      await assertSafeUrl(apiUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const probeUrl = apiUrl.includes('?') ? `${apiUrl}&action=services` : `${apiUrl}?action=services`;
      const res = await fetch(probeUrl, {
        method: 'GET',
        headers: {
          'User-Agent': this.USER_AGENT,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return { reachable: false, servicesCount: 0, error: `HTTP ${res.status}` };
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        return { reachable: true, servicesCount: data.length };
      }
      return { reachable: true, servicesCount: 0 };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { reachable: false, servicesCount: 0, error: msg };
    }
  }
}

// ── CLI Runner ─────────────────────────────────────────────────────────────────
async function runCli() {
  const args = process.argv.slice(2);
  const scanKnown = args.includes('--scan-known');
  const probeApis = args.includes('--probe-api');
  let channels = args.filter((a) => !a.startsWith('--'));

  if (scanKnown) {
    channels = TelegramChannelHarvester.KNOWN_SMM_CHANNELS;
  }

  if (channels.length === 0) {
    console.log('========================================================================');
    console.log('   OmniSMM 1.0 — Telegram SMM Intelligence Harvester CLI                ');
    console.log('========================================================================');
    console.log('Использование:');
    console.log('  npx tsx scripts/providers/telegram-channel-harvester.ts <channel1> <channel2> ...');
    console.log('  npx tsx scripts/providers/telegram-channel-harvester.ts --scan-known');
    console.log('  npx tsx scripts/providers/telegram-channel-harvester.ts --scan-known --probe-api\n');
    console.log('Пример:');
    console.log('  npx tsx scripts/providers/telegram-channel-harvester.ts smm_boost_news tgpanel_alerts');
    process.exit(0);
  }

  console.log(`[INFO] Запуск Telegram Harvester для каналов (${channels.length}): ${channels.join(', ')}...`);
  const reports = await TelegramChannelHarvester.harvestMultipleChannels(channels, {
    maxPosts: 20,
    delayBetweenMs: 500,
  });

  let totalApisFound = 0;
  let totalBotsFound = 0;

  for (const rep of reports) {
    console.log('\n========================================================================');
    console.log(`Канал: @${rep.channelSlug} ("${rep.channelTitle}")`);
    console.log(`Статус: ${rep.status} | Постов: ${rep.postsScanned} | Trust Score: ${rep.trustScore}/10`);
    if (rep.discoveredApis.length > 0) {
      totalApisFound += rep.discoveredApis.length;
      console.log('Найденные SMM API эндпоинты:');
      for (const api of rep.discoveredApis) {
        if (probeApis) {
          const probe = await TelegramChannelHarvester.probeApiEndpoint(api);
          console.log(`  • ${api} -> [${probe.reachable ? `ДОСТУПЕН (${probe.servicesCount} услуг)` : `ОШИБКА: ${probe.error}`}]`);
        } else {
          console.log(`  • ${api}`);
        }
      }
    }
    if (rep.discoveredBots.length > 0) {
      totalBotsFound += rep.discoveredBots.length;
      console.log('Найденные Telegram-боты:');
      rep.discoveredBots.forEach((bot) => console.log(`  • ${bot}`));
    }
    if (rep.wholesalePricing.length > 0) {
      console.log('Замеченные оптовые тарифы:');
      rep.wholesalePricing.slice(0, 5).forEach((p) => {
        console.log(`  • ${p.service}: ${p.price} ${p.currency} (фрагмент: "${p.rawMatch}")`);
      });
    }
    if (rep.errorMessage) {
      console.log(`[ОШИБКА]: ${rep.errorMessage}`);
    }
    console.log('========================================================================');
  }

  console.log(`\n[ИТОГ] Просканировано каналов: ${reports.length} | Найдено API: ${totalApisFound} | Ботов: ${totalBotsFound}`);
}

if (require.main === module) {
  runCli().catch((err) => {
    console.error('[FATAL] Ошибка CLI:', err);
    process.exit(1);
  });
}

