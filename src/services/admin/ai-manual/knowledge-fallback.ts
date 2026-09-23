import fs from 'fs';
import path from 'path';
import type { RetrievedChunk } from './knowledge-retriever.service';

/**
 * Returns contextual route grounding chunks for offline / instant manual lookup
 */
export function getRouteContextChunk(route: string): RetrievedChunk {
  const routeRules: Record<string, { title: string; content: string }> = {
    '/admin/providers': {
      title: 'Регламент: Провайдеры и Каталог',
      content:
        'Вкладка провайдеров управляет интеграциями API. Поддерживает Cherry-Pick импорт, автоматический анализ соцсетей (smart-analyzer.logic.ts), наценку в basis points и теневой каталог для защиты от сбоев цен.',
    },
    '/admin/finance': {
      title: 'Регламент: Финансы и Касса 54-ФЗ',
      content:
        'Все платежи и балансы пользователей рассчитываются строго в копейках BigInt через ExactMath. Фискализация 54-ФЗ поддерживает ставку НДС 22% (vat_code: 10) и УСН без НДС (vat_code: 1).',
    },
    '/admin/orders': {
      title: 'Регламент: Управление Заказами и Failover',
      content:
        'Заказы обрабатываются очередью BullMQ. При сбое провайдера заказ автоматически переводится в Failover/Retry пайплайн или отменяется с возвратом средств в копейках BigInt.',
    },
    '/admin/settings': {
      title: 'Регламент: Настройки и Режимы Окружения',
      content:
        'Платформа поддерживает 4 режима: SANDBOX, HYBRID, ACQUIRING_TEST, PRODUCTION. Ключи Gemini ротируются через 3-уровневый пул с кулдауном 5 минут при 429 ошибках.',
    },
  };

  for (const [prefix, data] of Object.entries(routeRules)) {
    if (route.startsWith(prefix)) {
      return {
        title: data.title,
        content: data.content,
        category: 'admin_manuals',
        score: 0.95,
        filePath: `src/app${prefix}`,
      };
    }
  }

  return {
    title: 'Базовый регламент OmniSMM 1.0',
    content:
      'OmniSMM 1.0 — двухбрендовая платформа (SMMplan & SMMflux). Архитектура Clean Architecture (4 уровня), баланс в BigInt, туннель Tailscale Funnel.',
    category: 'architecture_decisions',
    score: 0.6,
  };
}

/**
 * Loads cached architectural decisions from local json
 */
export function loadOfflineDecisions(): any[] {
  try {
    const cachePath = path.resolve(process.cwd(), '.planning/memory_cache.json');
    if (fs.existsSync(cachePath)) {
      const raw = fs.readFileSync(cachePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed.decisions || [];
    }
  } catch {
    // fallback gracefully
  }
  return [];
}
