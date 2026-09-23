import { describe, it, expect } from 'vitest';
import { aiKnowledgeRetriever } from '../services/admin/ai-knowledge-retriever.service';

describe('BLOCK 26: RAG Knowledge Retriever & AI Grounding Suite', () => {
  
  // -----------------------------------------------------------------------
  // 1. Articles Loader from src/data/knowledge
  // -----------------------------------------------------------------------
  it('RAG 1: Successfully loads and indexes 50+ knowledge articles from filesystem', () => {
    const articles = aiKnowledgeRetriever.getArticles();
    expect(articles.length).toBeGreaterThanOrEqual(50);
    
    // Verify essential articles exist
    const slugs = articles.map((a) => a.slug);
    expect(slugs).toContain('order-canceled-reasons');
    expect(slugs).toContain('13-vk-smart-feed-2026');
    expect(slugs).toContain('telegram-channel-vs-post-links');
  });

  // -----------------------------------------------------------------------
  // 2. Cancellation and TargetType Grounding
  // -----------------------------------------------------------------------
  it('RAG 2: Retrieves cancellation guide when query is about order cancel/error', () => {
    const snippet = aiKnowledgeRetriever.findRelevantKnowledge(
      'Почему мой заказ отменен со статусом CANCELED?',
      ['Telegram Подписчики на канал']
    );

    expect(snippet).not.toBeNull();
    expect(snippet).toContain('База Знаний');
    expect(snippet?.toLowerCase()).toMatch(/(отмен|cancel|targettype|ссылк)/);
  });

  // -----------------------------------------------------------------------
  // 3. VK Drops & Dogs (Списания и собачки)
  // -----------------------------------------------------------------------
  it('RAG 3: Retrieves VK drops / refill article for VK drop complaints', () => {
    const snippet = aiKnowledgeRetriever.findRelevantKnowledge(
      'В группе появились собачки и пошли сильные списания участников, нужна докрутка',
      ['ВКонтакте Подписчики в группу']
    );

    expect(snippet).not.toBeNull();
    expect(snippet?.toLowerCase()).toMatch(/(vk|вконтакт|dogs|списан|собачк|refill|гаранти)/);
  });

  // -----------------------------------------------------------------------
  // 4. YouTube Watch Hours / Monetization
  // -----------------------------------------------------------------------
  it('RAG 4: Retrieves YouTube watch hours article for monetization inquiries', () => {
    const snippet = aiKnowledgeRetriever.findRelevantKnowledge(
      'Как набрать 4000 часов просмотров для подключения монетизации ютуб канала?',
      ['YouTube Часы просмотров (Монетизация)']
    );

    expect(snippet).not.toBeNull();
    expect(snippet?.toLowerCase()).toMatch(/(youtube|ютуб|монетизац|часы|просмотр)/);
  });

  // -----------------------------------------------------------------------
  // 5. Fallback grounding for arbitrary query
  // -----------------------------------------------------------------------
  it('RAG 5: Gracefully provides fallback default knowledge for vague queries', () => {
    const snippet = aiKnowledgeRetriever.findRelevantKnowledge('Здравствуйте');
    expect(snippet).not.toBeNull();
    expect(snippet).toContain('База Знаний');
  });

  // -----------------------------------------------------------------------
  // 6. Instagram Flag for Review Cancellation Grounding
  // -----------------------------------------------------------------------
  it('RAG 6: Retrieves Instagram Flag for Review article when Instagram order is canceled', () => {
    const snippet = aiKnowledgeRetriever.findRelevantKnowledge(
      'Почему постоянно отменяется накрутка подписчиков в инстаграм, хотя аккаунт открыт?',
      ['Instagram Подписчики (Живые)', 'status: CANCELED']
    );

    expect(snippet).not.toBeNull();
    expect(snippet?.toLowerCase()).toMatch(/(instagram|инстаграм|проверк|flag for review|отмен)/);
  });
});
