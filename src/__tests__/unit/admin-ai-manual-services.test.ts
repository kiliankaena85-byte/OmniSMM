import { describe, it, expect, vi } from 'vitest';
import { KnowledgeRetrieverService } from '@/services/admin/ai-manual/knowledge-retriever.service';
import { AdminAiSanitizerService } from '@/services/admin/ai-manual/admin-ai-sanitizer.service';
import { GeminiClient } from '@/services/ai/gemini-client';

describe('Admin AI Manual Full Service Integration', () => {
  it('1. PII Sanitizer protects cards, phones, emails and tokens', () => {
    const raw = 'Клиент 4276 3800 1234 5678, тел +7 (999) 123-45-67, почта admin@smmplan.pro, key="secret123456789012"';
    const clean = AdminAiSanitizerService.sanitizeInput(raw);

    expect(clean).toContain('[CARD_REDACTED_...5678]');
    expect(clean).toContain('[PHONE_REDACTED]');
    expect(clean).toContain('@smmplan.pro');
    expect(clean).toContain('[REDACTED_SECRET]');
    expect(clean).not.toContain('4276');
    expect(clean).not.toContain('999');
    expect(clean).not.toContain('secret123456789012');
  });

  it('2. KnowledgeRetrieverService returns valid memory status', async () => {
    const status = await KnowledgeRetrieverService.getMemoryStatus();
    expect(status).toBeDefined();
    expect(status.mode).toMatch(/LIVE_DOCKER|OFFLINE_CACHE/);
    expect(status.vectorModel).toBeDefined();
    expect(typeof status.qdrantPointsCount).toBe('number');
  });

  it('3. KnowledgeRetrieverService retrieves relevant route context', async () => {
    const chunks = await KnowledgeRetrieverService.retrieveContext(
      'как настроить наценку для провайдера',
      '/admin/providers'
    );
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].title).toBeDefined();
    expect(chunks[0].content).toBeDefined();
    expect(chunks[0].score).toBeGreaterThan(0);
  });

  it('4. GeminiClient prioritizes gemini-3.8-flash model', async () => {
    const model = await GeminiClient.resolveLatestModel();
    expect(model).toBe('gemini-3.8-flash');
  });

  it('5. AdminAiFallbackService generates grounded answer for zombie services and price quarantine', async () => {
    const { AdminAiFallbackService } = await import('@/services/admin/ai-manual/admin-ai-fallback.service');
    const tokens: string[] = [];
    const text = await AdminAiFallbackService.generateFallback(
      'Что такое зомби-услуги и как работает карантин цен?',
      '/admin/providers',
      [],
      (t) => {
        tokens.push(t);
      }
    );

    expect(text).toContain('Зомби-услуги (Zombie Services)');
    expect(text).toContain('CAT-ZOMBIE-PURGE');
    expect(text).toContain('Карантин цен (Price Quarantine)');
    expect(text).toContain('CAT-PRICE-QUARANTINE-30');
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('6. AssistantResponseCache provides instant 0-token hit with isFromCache: true', async () => {
    const { AssistantResponseCache } = await import('@/services/admin/ai-manual/assistant-response-cache');
    const { AdminAiAssistantService } = await import('@/services/admin/ai-manual/admin-ai-assistant.service');

    const query = 'Что такое зомби-услуги и как работает карантин цен?';
    const route = '/admin/providers';

    // Prime the cache
    AssistantResponseCache.set(route, query, {
      fullText: 'Тестовый кэшированный ответ',
      chunksUsed: [{ title: 'Тест', content: 'Тест', category: 'admin_manuals', score: 1.0 }],
    });

    const result = await AdminAiAssistantService.streamConsultation(
      { query, currentRoute: route, activeTenantId: 'smmplan', conversationHistory: [] },
      'staff-123',
      'OWNER',
      () => {}
    );

    expect(result.isFromCache).toBe(true);
    expect(result.fullText).toBe('Тестовый кэшированный ответ');
  });

  it('7. AssistantResponseCache isolates cache entries by tenantId (smmplan vs flux)', async () => {
    const { AssistantResponseCache } = await import('@/services/admin/ai-manual/assistant-response-cache');

    const query = 'Уникальный вопрос по тарифам';
    const route = '/admin/dashboard';

    AssistantResponseCache.set(
      route,
      query,
      { fullText: 'Ответ для SMMplan', chunksUsed: [] },
      undefined,
      'smmplan'
    );

    const hitPlan = AssistantResponseCache.get(route, query, 'smmplan');
    const hitFlux = AssistantResponseCache.get(route, query, 'flux');

    expect(hitPlan).not.toBeNull();
    expect(hitPlan?.fullText).toBe('Ответ для SMMplan');
    expect(hitFlux).toBeNull();
  });
});

