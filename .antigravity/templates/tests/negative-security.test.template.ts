import { describe, it, expect } from 'vitest';

describe('Negative Security Test Template', () => {
  it('rejects unauthenticated or tampered request', async () => {
    // 1. Arrange tampered payload/header
    const badHeader = 'invalid-sig';
    // 2. Act & Assert rejection (403 / throw error)
    expect(() => {
      if (badHeader !== 'valid-sig') throw new Error('Forbidden');
    }).toThrow('Forbidden');
  });
});
