import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleDevAutoLogin } from '@/lib/session';

describe('Dev Auto Login Security Guard (P0-3)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when APP_ENV is not test and DEV_AUTO_LOGIN is not set', async () => {
    process.env.APP_ENV = 'production';
    delete process.env.DEV_AUTO_LOGIN;
    const res = await handleDevAutoLogin();
    expect(res).toBeNull();
  });

  it('throws error when DEV_AUTO_LOGIN=true and APP_ENV is production (not test)', async () => {
    process.env.APP_ENV = 'production';
    process.env.DEV_AUTO_LOGIN = 'true';
    await expect(handleDevAutoLogin()).rejects.toThrow('DEV_AUTO_LOGIN triggered in non-test environment!');
  });

  it('throws error when DEV_AUTO_LOGIN=true and APP_ENV is staging (not test)', async () => {
    process.env.APP_ENV = 'staging';
    process.env.DEV_AUTO_LOGIN = 'true';
    await expect(handleDevAutoLogin()).rejects.toThrow('DEV_AUTO_LOGIN triggered in non-test environment!');
  });

  it('returns null when APP_ENV=test and DEV_AUTO_LOGIN is not enabled', async () => {
    process.env.APP_ENV = 'test';
    delete process.env.DEV_AUTO_LOGIN;
    const res = await handleDevAutoLogin();
    expect(res).toBeNull();
  });
});
