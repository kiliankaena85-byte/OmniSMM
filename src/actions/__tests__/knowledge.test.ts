import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { SettingsProvider } from '@/lib/settings';
import { applyBeautifulRounding } from '@/lib/financial-constants';
import { 
  getArticles, 
  getArticleBySlug, 
  getRecommendedServicesForArticle, 
  createArticle, 
  updateArticle, 
  deleteArticle,
  getGroupedArticlesForTree,
  getRelatedArticles
} from '../knowledge';

// Mock cookies and headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const mockHeadersStore = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'vitest',
});

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeadersStore),
  cookies: vi.fn(async () => mockCookieStore),
}));

// Mock verifySession
vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await (importOriginal as <T>() => Promise<T>)<typeof import('@/lib/session')>();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

describe.sequential('SMMplan Knowledge Base & SEO Blog Server Actions', () => {
  let adminUser: any;
  let regularUser: any;
  let network: any;
  let category: any;
  let service: any;

  beforeEach(async () => {
    // 1. Clean database safely
    await db.article.deleteMany();
    await db.order.deleteMany();
    await db.service.deleteMany();
    await db.category.deleteMany();
    await db.network.deleteMany();
    await db.user.deleteMany({ where: { email: { contains: 'kb_' } } });

    // 2. Set settings
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'global', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    // 3. Create users
    adminUser = await db.user.create({
      data: {
        email: 'kb_admin@smmplan.local',
        role: 'OWNER',
        isActive: true,
      },
    });

    regularUser = await db.user.create({
      data: {
        email: 'kb_user@smmplan.local',
        role: 'USER',
        isActive: true,
      },
    });

    // 4. Create network, category, service
    network = await db.network.create({
      data: { name: 'Telegram', slug: 'telegram' }
    });

    category = await db.category.create({
      data: { name: 'Подписчики Telegram', networkId: network.id }
    });

    service = await db.service.create({
      data: {
        name: 'TG Premium Subscribers',
        categoryId: category.id,
        rate: 0.1, // 0.1 USD
        markup: 3.0, // 300% markup
        minQty: 10,
        maxQty: 10000,
        externalId: 'ext-tg-1',
        isActive: true,
        isQuarantined: false
      }
    });

    vi.clearAllMocks();
  });

  describe('Access Control Guard Tests', () => {
    it('should prevent guest users from creating articles', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);

      const res = await createArticle({
        title: "Новая тестовая статья",
        slug: "new-test-article",
        description: "Краткое описание новой тестовой статьи.",
        content: "Это содержимое новой тестовой статьи для проверки.",
        category: "Подписчики",
        status: "PUBLISHED"
      });
      expect(res.success).toBe(false);
      expect((res as any).error).toBe("Unauthorized access");
    });

    it('should prevent standard users from creating articles', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: regularUser.id });

      const res = await createArticle({
        title: "Новая тестовая статья",
        slug: "new-test-article",
        description: "Краткое описание новой тестовой статьи.",
        content: "Это содержимое новой тестовой статьи для проверки.",
        category: "Подписчики",
        status: "PUBLISHED"
      });
      expect(res.success).toBe(false);
      expect((res as any).error).toBe("Forbidden: Administrator/Staff context required");
    });
  });

  describe('Article Management CRUD Tests', () => {
    it('should allow admin users to create and edit articles successfully with slug validation', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      // 1. Create Article
      const createRes = await createArticle({
        title: "Безопасное продвижение",
        slug: "bezopasnoe-prodvizhenie",
        description: "Описание статьи о продвижении в телеграм.",
        content: "Содержимое статьи на много слов для тестов.",
        category: "Подписчики",
        status: "PUBLISHED"
      }) as any;

      expect(createRes.success).toBe(true);
      expect(createRes.article).toBeDefined();
      expect(createRes.article?.slug).toBe("bezopasnoe-prodvizhenie");

      // 2. Validate field validations
      const badCreateRes = await createArticle({
        title: "A",
        slug: "bad slug",
        description: "Short",
        content: "",
        category: "",
        status: "PUBLISHED"
      }) as any;

      expect(badCreateRes.success).toBe(false);
      expect(badCreateRes.errors).toBeDefined();

      // 3. Update Article
      const updateRes = await updateArticle(createRes.article!.id, {
        title: "Безопасное продвижение v2",
        slug: "bezopasnoe-prodvizhenie-v2",
        description: "Обновленное описание статьи о продвижении.",
        content: "Новое содержимое статьи.",
        category: "Лайки",
        status: "DRAFT"
      }) as any;

      expect(updateRes.success).toBe(true);
      expect(updateRes.article?.title).toBe("Безопасное продвижение v2");
      expect(updateRes.article?.slug).toBe("bezopasnoe-prodvizhenie-v2");
      expect(updateRes.article?.status).toBe("DRAFT");
    });
  });

  describe('Public Article Reading Tests', () => {
    let publishedArticle: any;
    let draftArticle: any;

    beforeEach(async () => {
      publishedArticle = await db.article.create({
        data: {
          title: "Раскрутка каналов в Telegram",
          slug: "raskrutka-kanalov-tg",
          description: "Инструкция как раскрутить канал.",
          content: "Инструкции и шаги: **Шаг 1**, [SMMplan](https://smmplan.ru).",
          category: "Подписчики",
          status: "PUBLISHED",
          viewCount: 10
        }
      });

      draftArticle = await db.article.create({
        data: {
          title: "Секреты админов Telegram",
          slug: "sekrety-adminov",
          description: "Описание черновика.",
          content: "Содержимое черновика.",
          category: "Инструкции",
          status: "DRAFT"
        }
      });
    });

    it('should return published articles only for guests', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);

      const result = await getArticles();
      expect(result.success).toBe(true);
      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].slug).toBe("raskrutka-kanalov-tg");
      expect(result.categories).toContain("Подписчики");
    });

    it('should search published articles by query correctly', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);

      const searchRes1 = await getArticles("Все", "раскрутка");
      expect(searchRes1.articles).toHaveLength(1);

      const searchRes2 = await getArticles("Все", "несуществующий");
      expect(searchRes2.articles).toHaveLength(0);
    });

    it('should protect draft articles from guests but allow them for admins', async () => {
      // 1. Guest request for draft
      vi.mocked(verifySession).mockResolvedValue(null);
      const guestRes = await getArticleBySlug("sekrety-adminov");
      expect(guestRes.success).toBe(false);
      expect(guestRes.error).toContain("черновиках");

      // 2. Admin request for draft
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });
      const adminRes = await getArticleBySlug("sekrety-adminov");
      expect(adminRes.success).toBe(true);
      expect(adminRes.article?.slug).toBe("sekrety-adminov");
    });

    it('should increment view count on successful article fetch', async () => {
      vi.mocked(verifySession).mockResolvedValue(null);
      const res = await getArticleBySlug("raskrutka-kanalov-tg");
      expect(res.success).toBe(true);
      expect(res.article?.viewCount).toBe(11);
    });
  });

  describe('Recommended Services Widget Tests', () => {
    it('should fetch recommended services based on article category and format pricing per unit', async () => {
      const article = await db.article.create({
        data: {
          title: "Как набрать подписчиков",
          slug: "kak-nabrat-podpischikov",
          description: "Инструкция.",
          content: "Текст.",
          category: "Подписчики",
          status: "PUBLISHED"
        }
      });

      const recommended = await getRecommendedServicesForArticle(article.id);
      expect(recommended).toHaveLength(1);
      expect(recommended[0].name).toBe("TG Premium Subscribers");
      
      const usdToRub = await SettingsProvider.getExchangeRateUSD();
      const expectedPrice = applyBeautifulRounding(0.1 * 3.0 * usdToRub) / 1000;
      expect(recommended[0].pricePerUnitRub).toBe(expectedPrice);
    });
  });

  describe('Milestone 8: Author Integrations & URL Match Widget Tests', () => {
    it('should save new article with default authorName and authorRole', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const res = await createArticle({
        title: "Статья без автора",
        slug: "bez-avtora",
        description: "Краткое описание статьи.",
        content: "Содержимое тестовой статьи.",
        category: "Подписчики",
        status: "PUBLISHED"
      }) as any;

      expect(res.success).toBe(true);
      expect(res.article).toBeDefined();
      expect(res.article?.authorName).toBe("Михаил");
      expect(res.article?.authorRole).toBe("Системный архитектор прокси-сетей SMMplan");
    });

    it('should allow admin to create and edit articles with custom authorName and authorRole', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      // 1. Create with custom author
      const createRes = await createArticle({
        title: "SEO оптимизация 2026",
        slug: "seo-opt-2026",
        description: "Краткое описание статьи.",
        content: "Содержимое тестовой статьи.",
        category: "Подписчики",
        status: "PUBLISHED",
        authorName: "Ольга",
        authorRole: "Контент-стратег и SEO-специалист SMMplan"
      }) as any;

      expect(createRes.success).toBe(true);
      expect(createRes.article?.authorName).toBe("Ольга");
      expect(createRes.article?.authorRole).toBe("Контент-стратег и SEO-специалист SMMplan");

      // 2. Edit/Update custom author
      const updateRes = await updateArticle(createRes.article!.id, {
        title: "SEO оптимизация 2026 (Обновлено)",
        slug: "seo-opt-2026-updated",
        description: "Краткое описание статьи.",
        content: "Содержимое тестовой статьи.",
        category: "Подписчики",
        status: "PUBLISHED",
        authorName: "Дмитрий",
        authorRole: "Руководитель SMM-отдела SMMplan"
      }) as any;

      expect(updateRes.success).toBe(true);
      expect(updateRes.article?.authorName).toBe("Дмитрий");
      expect(updateRes.article?.authorRole).toBe("Руководитель SMM-отдела SMMplan");
    });

    it('should validate authorName and authorRole length limits', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

      const res = await createArticle({
        title: "Тест валидации автора",
        slug: "test-author-validation",
        description: "Краткое описание статьи.",
        content: "Содержимое тестовой статьи.",
        category: "Подписчики",
        status: "PUBLISHED",
        authorName: "A", // too short (min 2)
        authorRole: "B"  // too short (min 2)
      }) as any;

      expect(res.success).toBe(false);
      expect(res.errors?.authorName).toContain("Имя автора должно состоять минимум из 2 символов");
      expect(res.errors?.authorRole).toContain("Роль автора должна состоять минимум из 2 символов");
    });

    it('should correctly parse URLs using detectLinkTargetType', async () => {
      const { detectLinkTargetType } = await import('../../app/knowledge/[slug]/UrlMatcherWidget');
      
      // CHANNEL links
      expect(detectLinkTargetType("t.me/username")).toBe("CHANNEL");
      expect(detectLinkTargetType("https://t.me/username")).toBe("CHANNEL");
      expect(detectLinkTargetType("vk.com/username")).toBe("CHANNEL");
      expect(detectLinkTargetType("http://instagram.com/myprofile")).toBe("CHANNEL");

      // POST links
      expect(detectLinkTargetType("t.me/username/123")).toBe("POST");
      expect(detectLinkTargetType("https://t.me/username/4567")).toBe("POST");
      expect(detectLinkTargetType("https://twitter.com/user/status/987654")).toBe("POST");
      expect(detectLinkTargetType("https://instagram.com/p/CgH123/")).toBe("POST");
      expect(detectLinkTargetType("https://vk.com/wall-12345_67890")).toBe("POST");
    });

    it('should generate valid JSON-LD structure with Person author metadata', async () => {
      const article = {
        title: "Тестовая статья для разметки",
        description: "Краткое описание.",
        content: "Контент.",
        createdAt: new Date(),
        updatedAt: new Date(),
        authorName: "Михаил",
        authorRole: "Системный архитектор прокси-сетей SMMplan"
      };

      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": article.title,
        "description": article.description,
        "articleBody": article.content,
        "datePublished": article.createdAt.toString(),
        "dateModified": article.updatedAt.toString(),
        "author": {
          "@type": "Person",
          "name": article.authorName,
          "jobTitle": article.authorRole
        },
        "publisher": {
          "@type": "Organization",
          "name": "SMMplan"
        }
      };

      expect(jsonLd.author["@type"]).toBe("Person");
      expect(jsonLd.author.name).toBe("Михаил");
      expect(jsonLd.author.jobTitle).toBe("Системный архитектор прокси-сетей SMMplan");
      
      const escapedJsonLd = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
      expect(escapedJsonLd).not.toContain("<");
    });
  });

  describe('Milestone 1: Knowledge Base Navigation & Related Articles', () => {
    it('should correctly group articles into tree categories', async () => {
      await db.article.create({
        data: {
          title: "Защита аккаунта",
          slug: "security-acc",
          description: "Описание.",
          content: "Контент.",
          category: "Безопасность соцсетей",
          status: "PUBLISHED"
        }
      });

      const res = await getGroupedArticlesForTree();
      expect(res.success).toBe(true);
      expect(res.grouped["Безопасность соцсетей"]).toHaveLength(1);
      expect(res.grouped["Безопасность соцсетей"][0].slug).toBe("security-acc");
    });

    it('should fetch up to 3 related articles of the same category, excluding current one', async () => {
      const art1 = await db.article.create({
        data: {
          title: "Статья 1",
          slug: "slug-1",
          description: "Описание.",
          content: "Контент.",
          category: "Безопасность соцсетей",
          status: "PUBLISHED"
        }
      });

      const art2 = await db.article.create({
        data: {
          title: "Статья 2",
          slug: "slug-2",
          description: "Описание.",
          content: "Контент.",
          category: "Безопасность соцсетей",
          status: "PUBLISHED"
        }
      });

      const related = await getRelatedArticles(art1.id, "Безопасность соцсетей");
      expect(related.success).toBe(true);
      expect(related.articles).toHaveLength(1);
      expect(related.articles[0].id).not.toBe(art1.id);
    });
  });
});
