import { describe, it, expect, vi } from 'vitest';
import { SmartDripService } from '@/services/dripfeed/smart-drip.service';

describe('SmartDripService (Ядро бизнес-логики Умный Dripfeed 2.0)', () => {
  describe('generateTaskDistribution', () => {
    it('должен корректно разбивать объем 1000 на чанки от 50 до 200 на 7 дней', () => {
      const quantity = 1000;
      const days = 7;
      const minChunk = 50;
      const maxChunk = 200;

      const tasks = SmartDripService.generateTaskDistribution(quantity, days, minChunk, maxChunk);

      // 1. Проверяем, что количество порций разумное
      expect(tasks.length).toBeGreaterThanOrEqual(5); // 1000 / 200 = 5
      expect(tasks.length).toBeLessThanOrEqual(20);    // 1000 / 50 = 20

      // 2. Сумма всех чанков должна равняться 1000 ровно
      const totalSum = tasks.reduce((sum, t) => sum + t.qty, 0);
      expect(totalSum).toBe(1000);

      // 3. Каждый чанк должен быть в пределах [minChunk, maxChunk]
      // Исключение: последний чанк прибавляет остаток, так что он может быть чуть больше maxChunk,
      // либо если общий объем меньше minChunk. Но в данном тесте все чанки должны быть >= 50
      // и не нарушать нижний порог.
      tasks.forEach((t, i) => {
        expect(t.qty).toBeGreaterThanOrEqual(minChunk);
        // Так как остатки складываются в предыдущий чанк, максимальный размер чанка может быть до maxChunk + minChunk
        expect(t.qty).toBeLessThanOrEqual(maxChunk + minChunk);
      });

      // 4. Даты runAt должны быть хронологически отсортированы
      for (let i = 1; i < tasks.length; i++) {
        expect(tasks[i].runAt.getTime()).toBeGreaterThanOrEqual(tasks[i - 1].runAt.getTime());
      }

      // 5. Все даты должны лежать в пределах от now до now + 7 дней
      const now = Date.now();
      const maxTime = now + days * 24 * 60 * 60 * 1000 + 1000; // погрешность 1с
      tasks.forEach((t) => {
        expect(t.runAt.getTime()).toBeGreaterThanOrEqual(now - 1000);
        expect(t.runAt.getTime()).toBeLessThanOrEqual(maxTime);
      });
    });

    it('должен обрабатывать маленькие объемы меньше minChunk', () => {
      const quantity = 30;
      const days = 3;
      const minChunk = 50;
      const maxChunk = 200;

      const tasks = SmartDripService.generateTaskDistribution(quantity, days, minChunk, maxChunk);

      expect(tasks.length).toBe(1);
      expect(tasks[0].qty).toBe(30);
    });
  });
});
