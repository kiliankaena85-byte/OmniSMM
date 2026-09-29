/**
 * wbs-decomposer.ts
 * Движок атомарной декомпозиции задач (Work Breakdown Structure Engine).
 * 
 * Разбивает крупные бизнес-требования на строгий граф зависимостей атомарных задач,
 * гарантируя соблюдение правила WBS: каждая задача затрагивает не более 2 файлов,
 * минимизируя вероятность ошибки (P_error -> 0).
 */

import { BusinessRequest, AtomicTask, DecompositionResult } from './types';

export class WbsDecomposer {
  /**
   * Декомпозиция бизнес-запроса на атомарные шаги
   */
  public decompose(request: BusinessRequest, candidateFiles: string[] = []): DecompositionResult {
    const tasks: AtomicTask[] = [];

    // 1. Нормализация и группировка файлов по доменным парам (<= 2 файлов на шаг)
    const fileChunks: string[][] = [];
    if (candidateFiles.length === 0) {
      // Синтезируем стандартную тройку: Спецификация/Типы -> Реализация -> Тесты
      fileChunks.push(['src/types/index.ts']);
      fileChunks.push(['src/services/core.service.ts']);
      fileChunks.push(['src/__tests__/unit/core.test.ts']);
    } else {
      for (let i = 0; i < candidateFiles.length; i += 2) {
        fileChunks.push(candidateFiles.slice(i, i + 2));
      }
    }

    // 2. Генерация атомарных задач с зависимостями
    fileChunks.forEach((chunk, idx) => {
      const taskId = `TASK-${String(idx + 1).padStart(2, '0')}`;
      const prevTaskId = idx > 0 ? `TASK-${String(idx).padStart(2, '0')}` : null;

      let title = `Реализация шага ${idx + 1}: ${chunk.map(f => f.split('/').pop()).join(', ')}`;
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

      // Определение риска по типам файлов
      const touchesSchema = chunk.some(f => f.includes('schema') || f.includes('prisma'));
      const touchesFinancial = chunk.some(f => f.includes('payment') || f.includes('wallet') || f.includes('ledger'));
      
      if (touchesSchema || touchesFinancial) {
        riskLevel = 'MEDIUM';
      }

      tasks.push({
        id: taskId,
        title,
        description: `Атомарный шаг в рамках цели: "${request.title}". Ограничение скоупа строго на файлы: ${chunk.join(', ')}`,
        targetFiles: chunk,
        riskLevel,
        testCriteria: [
          `Юнит-тест подтверждает корректность для ${chunk.join(', ')}`,
          'Отсутствие регрессий в зависимых модулях (tsc 0 errors)',
          'No-Crutch Policy: 0 any, 0 @ts-ignore'
        ],
        dependencies: prevTaskId ? [prevTaskId] : [],
        estimatedMinutes: 15
      });
    });

    // 3. Вычисление критического пути (Critical Path)
    const criticalPath = tasks.map(t => t.id);

    // 4. Проверка инварианта WBS (<= 2 файлов на задачу)
    const isWbsCompliant = tasks.every(t => t.targetFiles.length <= 2);

    return {
      requestId: request.id,
      specSummary: `WBS Декомпозиция запроса "${request.title}" на ${tasks.length} атомарных шагов.`,
      totalTasks: tasks.length,
      atomicTasks: tasks,
      criticalPath,
      isWbsCompliant
    };
  }

  /**
   * Проверка существующей задачи на соответствие правилу WBS
   */
  public validateTaskGranularity(task: AtomicTask): { valid: boolean; reason?: string } {
    if (task.targetFiles.length > 2) {
      return {
        valid: false,
        reason: `Нарушение WBS: задача затрагивает ${task.targetFiles.length} файлов (максимум допустимо 2 файла). Требуется дальнейшее дробление.`
      };
    }
    return { valid: true };
  }
}
