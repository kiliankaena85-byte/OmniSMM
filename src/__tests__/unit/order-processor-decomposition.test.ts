import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Wave 21: Order Processor Decomposition (CDD-TDD)', () => {
  it('should ensure all created submodules obey the <= 200 lines rule', () => {
    const filesToCheck = [
      'src/workers/processors/order/types.ts',
      'src/workers/processors/order/order-preflight-guard.ts',
      'src/workers/processors/order/order-route-evaluator.ts',
      'src/workers/processors/order/order-dispatch-executor.ts',
      'src/workers/processors/order/order-all-routes-failed-handler.ts',
      'src/workers/processors/order.processor.ts',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `File ${relPath} should exist`).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      expect(lines, `Component ${relPath} has ${lines} lines, expected <= 200`).toBeLessThanOrEqual(200);
    }
  });

  it('should export orderProcessor function properly', async () => {
    const mod = await import('@/workers/processors/order.processor');
    expect(typeof mod.default).toBe('function');
  });
});
