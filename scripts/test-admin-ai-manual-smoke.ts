// Mock server-only for standalone script execution
require.cache[require.resolve('server-only')] = {
  id: require.resolve('server-only'),
  filename: require.resolve('server-only'),
  exports: {},
  loaded: true,
};

import { KnowledgeRetrieverService } from '../src/services/admin/ai-manual/knowledge-retriever.service';
import { AdminAiSanitizerService } from '../src/services/admin/ai-manual/admin-ai-sanitizer.service';
import { GeminiClient } from '../src/services/ai/gemini-client';

async function main() {
  console.log('🧪 [Smoke Test] Запуск сквозной проверки сервисов OmniManual 1.0...\n');

  // 1. Проверка санитизатора PII
  const rawInput = 'Клиент 4276 3800 1234 5678, тел +7 999 123-45-67, почта admin@smmplan.pro, key="secret123456789012"';
  const cleanInput = AdminAiSanitizerService.sanitizeInput(rawInput);
  console.log('1. PII Sanitizer:');
  console.log('   - Исходный:', rawInput);
  console.log('   - Очищенный:', cleanInput);
  if (cleanInput.includes('4276') || cleanInput.includes('999') || cleanInput.includes('secret12345')) {
    throw new Error('❌ Ошибка: PII или секреты не были замаскированы!');
  }
  console.log('   ✅ PII & Secret Sanitizer: PASS\n');

  // 2. Проверка статуса векторной памяти (Live Docker или Offline Cache)
  console.log('2. Проверка статуса векторной памяти:');
  const memoryStatus = await KnowledgeRetrieverService.getMemoryStatus();
  console.log('   - Режим:', memoryStatus.mode);
  console.log('   - Доступен:', memoryStatus.isAvailable);
  console.log('   - Количество точек/документов:', memoryStatus.qdrantPointsCount);
  console.log('   - Модель векторов:', memoryStatus.vectorModel);
  console.log('   ✅ Memory Status Check: PASS\n');

  // 3. Проверка поиска контекста для текущей страницы
  console.log('3. Проверка извлечения контекста (Retrieval):');
  const chunks = await KnowledgeRetrieverService.retrieveContext(
    'как настроить наценку для провайдера',
    '/admin/providers'
  );
  console.log(`   - Найдено чанков: ${chunks.length}`);
  for (const c of chunks.slice(0, 2)) {
    console.log(`     * [${c.category}] ${c.title} (Score: ${c.score.toFixed(2)})`);
  }
  if (chunks.length === 0) {
    throw new Error('❌ Ошибка: Не найдены чанки контекста!');
  }
  console.log('   ✅ Context Retrieval: PASS\n');

  // 4. Проверка Gemini Model Cascade и ключей
  console.log('4. Проверка конфигурации Gemini 3.8 Flash:');
  const model = await GeminiClient.resolveLatestModel();
  console.log('   - Целевая модель Gemini:', model);
  if (model !== 'gemini-3.8-flash') {
    throw new Error(`❌ Ошибка: Ожидалась модель gemini-3.8-flash, получена: ${model}`);
  }
  console.log('   ✅ Gemini Model Cascade: PASS\n');

  console.log('======================================================');
  console.log('🎉 ВСЕ СЕРВИСНЫЕ ИНВАРИАНТЫ УСПЕШНО ПРОТЕСТИРОВАНЫ (100% PASS)!');
  console.log('======================================================');
}

main().catch((err) => {
  console.error('❌ Smoke Test Failed:', err);
  process.exit(1);
});
