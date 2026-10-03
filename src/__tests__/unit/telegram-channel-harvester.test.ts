import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramChannelHarvester } from '../../../scripts/providers/telegram-channel-harvester';

describe('TelegramChannelHarvester', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const MOCK_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="SMM Wholesale & Boost Provider Official">
</head>
<body>
  <div class="tgme_channel_info_header_title">
    <span>SMM Wholesale & Boost Provider Official</span>
  </div>

  <div class="tgme_widget_message_wrap">
    <div class="tgme_widget_message" data-post="smm_boost_channel/101">
      <time datetime="2026-09-29T12:00:00+00:00"></time>
      <div class="tgme_widget_message_text">
        🔥 Внимание! Запущен новый API v2 шлюз для реселлеров!<br>
        Документация и заказ: https://boostprovider-api.com/api/v2?action=services<br>
        Связь с ботом поддержки: @boost_master_bot<br>
        Бусты каналов от 12.50 руб, просмотры от 0.35 руб.<br>
        #api #smm #бусты #оптом
      </div>
      <span class="tgme_widget_message_views">1.2K</span>
    </div>
  </div>

  <div class="tgme_widget_message_wrap">
    <div class="tgme_widget_message" data-post="smm_boost_channel/102">
      <time datetime="2026-09-29T14:30:00+00:00"></time>
      <div class="tgme_widget_message_text">
        ⚡ Снижение тарифов на Telegram Stars!<br>
        Оптовая цена: звезд от 1.45 руб за 1 шт.<br>
        Подписчики от 110 руб за 1 000 шт.<br>
        Зеркало панели: https://panel-root-smm.pro<br>
        Для заказа обращаться к @smm_manager_bot
      </div>
      <span class="tgme_widget_message_views">2.5K</span>
    </div>
  </div>
</body>
</html>
`;

  it('должен корректно парсить заголовок канала и извлекать посты из HTML', () => {
    const { title, posts } = TelegramChannelHarvester.parseChannelHtml(MOCK_HTML, 'smm_boost_channel');

    expect(title).toBe('SMM Wholesale & Boost Provider Official');
    expect(posts).toHaveLength(2);

    expect(posts[0].postId).toBe('smm_boost_channel/101');
    expect(posts[0].channelSlug).toBe('smm_boost_channel');
    expect(posts[0].postUrl).toBe('https://t.me/smm_boost_channel/101');
    expect(posts[0].cleanText).toContain('Запущен новый API v2 шлюз');

    expect(posts[1].postId).toBe('smm_boost_channel/102');
  });

  it('должен извлекать API эндпоинты, ботов, теги и цены из текста поста', () => {
    const analysis = TelegramChannelHarvester.analyzePostText(`
      Новый оптовый шлюз https://api.mysmm-gate.com/api/v2 доступен!
      Бот для пополнения: @mysmm_order_bot
      Буст от 13.90 руб, просмотры от 0.25 коп, Telegram Stars от 1.50 руб
      #api #smm #бусты
    `);

    expect(analysis.apis).toContain('https://api.mysmm-gate.com/api/v2');
    expect(analysis.bots).toContain('@mysmm_order_bot');
    expect(analysis.keywords).toContain('API_V2');
    expect(analysis.keywords).toContain('TG_BOOSTS');
    expect(analysis.keywords).toContain('TG_STARS');

    const boostPrice = analysis.prices.find((p) => p.service === 'Telegram Бусты');
    expect(boostPrice).toBeDefined();
    expect(boostPrice?.price).toBe(13.9);
    expect(boostPrice?.currency).toBe('RUB');

    const starsPrice = analysis.prices.find((p) => p.service === 'Telegram Stars');
    expect(starsPrice).toBeDefined();
    expect(starsPrice?.price).toBe(1.5);
  });

  it('должен рассчитывать Heuristic Trust Score с учетом API, цен и ключевых слов', () => {
    const { title, posts } = TelegramChannelHarvester.parseChannelHtml(MOCK_HTML, 'smm_boost_channel');
    const apis = Array.from(new Set(posts.flatMap((p) => p.detectedApis)));

    const score = TelegramChannelHarvester.calculateTrustScore(title, posts, apis);

    // Базовый 5.0 + 2.0 (API) + 1.5 (цены >= 2) + 1.0 (API_V2) + 0.5 (TG_BOOSTS) = 10.0
    expect(score).toBeGreaterThanOrEqual(8.0);
    expect(score).toBeLessThanOrEqual(10.0);
  });

  it('должен снижать Trust Score при наличии маркеров мошенничества', () => {
    const scamPost = {
      postId: 'scam/1',
      channelSlug: 'scam',
      postUrl: 'https://t.me/scam/1',
      publishedAt: '2026-09-29T00:00:00Z',
      rawText: 'Перевод на сбер физлица, 100% предоплата в лс без сайта',
      cleanText: 'Перевод на сбер физлица, 100% предоплата в лс без сайта',
      detectedApis: [],
      detectedBots: [],
      detectedKeywords: [],
      detectedPrices: [],
    };

    const score = TelegramChannelHarvester.calculateTrustScore('Scam Channel', [scamPost], []);
    expect(score).toBeLessThan(5.0);
  });

  it('должен блокировать некорректные или небезопасные slug каналов', async () => {
    await expect(TelegramChannelHarvester.fetchChannelHtml('ab')).rejects.toThrow(
      'Некорректный slug Telegram канала'
    );
    await expect(TelegramChannelHarvester.fetchChannelHtml('bad slug with spaces!')).rejects.toThrow(
      'Некорректный slug Telegram канала'
    );
  });

  it('должен возвращать статус ERROR при сетевом сбое', async () => {
    // Подмена fetch на падающий
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    try {
      const report = await TelegramChannelHarvester.harvestChannel('test_broken_channel');
      expect(report.status).toBe('ERROR');
      expect(report.errorMessage).toContain('Network failure');
      expect(report.postsScanned).toBe(0);
      expect(report.trustScore).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('должен успешно обрабатывать валидный канал при успешном fetch', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => MOCK_HTML,
    } as Response);

    try {
      const report = await TelegramChannelHarvester.harvestChannel('smm_boost_channel');
      expect(report.status).toBe('SUCCESS');
      expect(report.postsScanned).toBe(2);
      expect(report.discoveredApis.length).toBeGreaterThan(0);
      expect(report.discoveredBots).toContain('@boost_master_bot');
      expect(report.discoveredBots).toContain('@smm_manager_bot');
      expect(report.trustScore).toBeGreaterThanOrEqual(8.0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
