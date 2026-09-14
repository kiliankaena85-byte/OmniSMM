import { describe, it, expect } from 'vitest';
import { isAllowedHost, getBaseUrlSync, ALLOWED_TUNNEL_SUFFIXES } from '@/utils/get-base-url';

describe('getBaseUrl & isAllowedHost Tunnel Integrity (SIL-2026)', () => {
  it('1. Correctly identifies and allows Tailscale Funnel (.ts.net) hosts', () => {
    expect(isAllowedHost('smmplan.tailbb9d28.ts.net')).toBe(true);
    expect(isAllowedHost('desktop-25m6el7.tailbb9d28.ts.net')).toBe(true);
    expect(isAllowedHost('any-node.tailbb9d28.ts.net')).toBe(true);
  });

  it('2. Correctly identifies and allows Cloudflare Tunnel (.trycloudflare.com) hosts', () => {
    expect(isAllowedHost('smmplan-test.trycloudflare.com')).toBe(true);
  });

  it('3. Retains official domains and localhost', () => {
    expect(isAllowedHost('smmplan.pro')).toBe(true);
    expect(isAllowedHost('www.smmplan.pro')).toBe(true);
    expect(isAllowedHost('smmflux.ru')).toBe(true);
    expect(isAllowedHost('www.smmflux.ru')).toBe(true);
    expect(isAllowedHost('localhost')).toBe(true);
    expect(isAllowedHost('localhost:3000')).toBe(true);
    expect(isAllowedHost('127.0.0.1')).toBe(true);
  });

  it('4. Rejects disallowed hosts and malicious domains (Host Header Injection Immunity)', () => {
    expect(isAllowedHost('evil-attacker.com')).toBe(false);
    expect(isAllowedHost('phishing-smmplan.com')).toBe(false);
    expect(isAllowedHost('0.0.0.0')).toBe(false);
    expect(isAllowedHost('host.docker.internal')).toBe(false);
    expect(isAllowedHost('')).toBe(false);
  });

  it('5. getBaseUrlSync forces https for tunnel domains even if reqProto is http or missing', () => {
    const tunnelUrl = getBaseUrlSync('smmplan.tailbb9d28.ts.net', 'http');
    expect(tunnelUrl).toBe('https://smmplan.tailbb9d28.ts.net');

    const cloudflareUrl = getBaseUrlSync('test.trycloudflare.com', 'http');
    expect(cloudflareUrl).toBe('https://test.trycloudflare.com');
  });

  it('6. getBaseUrlSync retains http for localhost in non-prod', () => {
    const localUrl = getBaseUrlSync('localhost:3000', 'http');
    expect(localUrl).toBe('http://localhost:3000');
  });
});
