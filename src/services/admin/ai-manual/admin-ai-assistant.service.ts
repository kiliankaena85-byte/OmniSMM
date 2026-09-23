/**
 * Level 1 Service: Admin AI Assistant Service
 * Orchestrates Grounded RAG Generation via Gemini 3.8 Flash
 */

import { GeminiClient } from '@/services/ai/gemini-client';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { AdminAiSanitizerService } from './admin-ai-sanitizer.service';
import { KnowledgeRetrieverService, RetrievedChunk } from './knowledge-retriever.service';
import { AssistantResponseCache } from './assistant-response-cache';
import { AdminAiFallbackService } from './admin-ai-fallback.service';
import type { AdminAssistantQuery } from '@/types/admin-ai-manual';

export class AdminAiAssistantService {
  /**
   * Generates a streaming response for admin query (with LRU 0-token caching)
   */
  static async streamConsultation(
    payload: AdminAssistantQuery,
    staffUserId: string,
    userRole: string,
    onToken: (token: string) => void | Promise<void>
  ): Promise<{ fullText: string; chunksUsed: RetrievedChunk[]; isFromCache?: boolean }> {
    const startTime = Date.now();
    const sanitizedQuery = AdminAiSanitizerService.sanitizeInput(payload.query);

    // 0. Check LRU In-Memory Response Cache for 0-token instant return
    const route = payload.currentRoute || '/admin/dashboard';
    const cached = AssistantResponseCache.get(route, sanitizedQuery, payload.activeTenantId || 'smmplan');
    if (cached) {
      await onToken(cached.fullText);
      return {
        fullText: cached.fullText,
        chunksUsed: cached.chunksUsed,
        isFromCache: true,
      };
    }

    // 1. Retrieve Grounding Chunks from Docker Vector Memory
    const chunks = await KnowledgeRetrieverService.retrieveContext(
      sanitizedQuery,
      payload.currentRoute,
      5
    );

    // 2. Build Grounded System Instruction
    const systemPrompt = this.buildSystemPrompt(
      payload.currentRoute,
      payload.activeTenantId,
      userRole,
      chunks
    );

    // 3. Format Conversation History for Gemini
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of payload.conversationHistory || []) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: AdminAiSanitizerService.sanitizeInput(msg.content) }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: sanitizedQuery }],
    });

    // 4. Stream Tokens from Gemini 3.8 Flash (with intelligent local fallback)
    let fullText = '';
    try {
      const geminiPromise = GeminiClient.streamGenerateContent(
        {
          staffUserId,
          systemInstruction: systemPrompt,
          contents,
          temperature: 0.2, // Low temperature for high precision and zero hallucinations
          maxOutputTokens: 2048,
          timeoutMs: 5000,
        },
        onToken
      );
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('AI Assistant generation timeout (5s)')), 5000)
      );
      fullText = await Promise.race([geminiPromise, timeoutPromise]);
    } catch {
      // Offline fallback: Generate grounded structured consultation from knowledge base
      fullText = await AdminAiFallbackService.generateFallback(
        sanitizedQuery,
        route,
        chunks,
        onToken
      );
    }

    if (!fullText || fullText.trim().length === 0) {
      fullText = await AdminAiFallbackService.generateFallback(
        sanitizedQuery,
        route,
        chunks,
        onToken
      );
    }

    // 5. Store in LRU Cache for subsequent instant 0-token queries
    AssistantResponseCache.set(
      route,
      sanitizedQuery,
      {
        fullText,
        chunksUsed: chunks,
      },
      undefined,
      payload.activeTenantId || 'smmplan'
    );

    // 6. Audit Logging (Asynchronous & Non-blocking)
    const durationMs = Date.now() - startTime;
    auditAdminAwaitable({
      adminId: staffUserId,
      adminEmail: 'staff@system',
      action: 'ADMIN_AI_ASSISTANT_QUERY',
      target: payload.currentRoute || 'dashboard',
      targetType: 'AI_MANUAL_CONSULTATION',
      newValue: {
        userRole,
        route: payload.currentRoute,
        tenantId: payload.activeTenantId,
        queryLength: sanitizedQuery.length,
        durationMs,
        chunksCount: chunks.length,
      },
    }).catch(() => {});

    return { fullText, chunksUsed: chunks };
  }

  /**
   * Formulates Anti-Hallucination Grounded Prompt with Citations
   */
  private static buildSystemPrompt(
    currentRoute: string,
    tenantId: string,
    role: string,
    chunks: RetrievedChunk[]
  ): string {
    const chunksFormatted = chunks
      .map((c, i) => `--- ФРАГМЕНТ #${i + 1}: ${c.title} (${c.filePath || c.category}) ---\n${c.content}`)
      .join('\n\n');

    return `Вы — официальный ИИ-инструктор и инженерный консультант платформы OmniSMM 1.0 (SMMplan & SMMflux).
Ваша задача — помогать администраторам (роль: ${role}, активный тенант: ${tenantId}) на экране "${currentRoute}".

ЖЕСТКИЕ ПРАВИЛА (HARD INVARIANTS):
1. Отвечайте ИСКЛЮЧИТЕЛЬНО на основе предоставленных ниже фрагментов реального кода и регламентов.
2. ЗАПРЕЩЕНО выдумывать несуществующие методы, файлы, модели или флаги. Если факта нет в предоставленных фрагментах, честно ответьте: "Данный функционал не обнаружен в кодовой базе OmniSMM 1.0."
3. Все денежные суммы в платформе хранятся и рассчитываются строго в копейках BigInt через ExactMath (Half-Even).
4. Базовая ставка НДС в РФ с 2026 года — 22% (ФЗ № 425-ФЗ), УСН порог 20 млн ₽ (ФЗ № 176-ФЗ).
5. При ответе всегда указывайте кликабельные ссылки на разделы админки (например: [Каталог](/admin/catalog), [Провайдеры](/admin/providers), [Финансы](/admin/finance)) и ссылки на кодовую базу.
6. Ответ должен быть лаконичным, четким, на русском языке, без лишней "воды", в формате Markdown.

АКТУАЛЬНАЯ КОДОВАЯ БАЗА И РЕГЛАМЕНТЫ ИЗ ВЕКТОРНОЙ ПАМЯТИ:
${chunksFormatted}`;
  }
}
