import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GeminiClient } from '@/services/ai/gemini-client';

describe('GeminiClient Key Pool & Model Cascade', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolves gemini-3.8-flash by default', async () => {
    delete process.env.GEMINI_MODEL;
    const model = await GeminiClient.resolveLatestModel();
    expect(model).toBe('gemini-3.8-flash');
  });

  it('respects GEMINI_MODEL override from environment', async () => {
    process.env.GEMINI_MODEL = 'gemini-3-flash-preview';
    const model = await GeminiClient.resolveLatestModel();
    expect(model).toBe('gemini-3-flash-preview');
  });

  it('parses comma-separated GEMINI_API_KEYS into key pool', () => {
    process.env.GEMINI_API_KEYS = 'key_alpha_12345, key_beta_67890, key_gamma_99999';
    const keys = GeminiClient.getEnvApiKeys();
    expect(keys).toHaveLength(3);
    expect(keys).toContain('key_alpha_12345');
    expect(keys).toContain('key_beta_67890');
    expect(keys).toContain('key_gamma_99999');
  });

  it('filters out keys that are placed on cooldown', async () => {
    process.env.GEMINI_API_KEYS = 'key_healthy_11111, key_exhausted_22222';
    GeminiClient.markKeyCooldown('key_exhausted_22222', 'HTTP 429 quota exceeded');

    const activeKeys = await GeminiClient.getActiveKeyPool();
    expect(activeKeys).toContain('key_healthy_11111');
    expect(activeKeys).not.toContain('key_exhausted_22222');
  });
});
