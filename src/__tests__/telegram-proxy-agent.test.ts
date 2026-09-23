import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTelegramProxyUrl, getTelegramProxyAgent, getTelegramDispatcher } from '@/lib/telegram-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ProxyAgent } from 'undici';

describe('Telegram Proxy Agent & Standalone Dispatcher Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TELEGRAM_PROXY_URL;
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
    delete process.env.ALL_PROXY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns undefined when no proxy variables are configured', () => {
    expect(getTelegramProxyUrl()).toBeUndefined();
    expect(getTelegramProxyAgent()).toBeUndefined();
    expect(getTelegramDispatcher()).toBeUndefined();
  });

  it('creates a SocksProxyAgent for SOCKS5 proxy URL', () => {
    process.env.TELEGRAM_PROXY_URL = 'socks5://user:pass@127.0.0.1:1080';
    expect(getTelegramProxyUrl()).toBe('socks5://user:pass@127.0.0.1:1080');

    const agent = getTelegramProxyAgent();
    expect(agent).toBeDefined();
    expect(agent).toBeInstanceOf(SocksProxyAgent);
  });

  it('creates an HttpsProxyAgent for HTTP proxy URL', () => {
    process.env.TELEGRAM_PROXY_URL = 'http://127.0.0.1:8080';
    expect(getTelegramProxyUrl()).toBe('http://127.0.0.1:8080');

    const agent = getTelegramProxyAgent();
    expect(agent).toBeDefined();
    expect(agent).toBeInstanceOf(HttpsProxyAgent);
  });

  it('creates an undici ProxyAgent dispatcher for native fetch HTTP calls', () => {
    process.env.TELEGRAM_PROXY_URL = 'http://127.0.0.1:8080';
    const dispatcher = getTelegramDispatcher();
    expect(dispatcher).toBeDefined();
    expect(dispatcher).toBeInstanceOf(ProxyAgent);
  });
});
