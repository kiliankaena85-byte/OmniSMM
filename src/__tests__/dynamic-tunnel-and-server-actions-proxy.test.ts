import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy, isKnownOrAllowedHost, isInternalHost } from '@/proxy';

describe('Zero-Hardcode Dynamic Tunnel & Server Actions Security Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('1. Dynamic Host & Tunnel Validation (isKnownOrAllowedHost)', () => {
    it('accepts any Tailscale Funnel / MagicDNS domain (*.ts.net)', () => {
      expect(isKnownOrAllowedHost('desktop-25m6el7.tailbb9d28.ts.net')).toBe(true);
      expect(isKnownOrAllowedHost('new-laptop-42.tailnet-xyz.ts.net')).toBe(true);
      expect(isKnownOrAllowedHost('staging-node.ts.net')).toBe(true);
    });

    it('accepts any Cloudflare Quick Tunnel (*.trycloudflare.com)', () => {
      expect(isKnownOrAllowedHost('random-subdomain-123.trycloudflare.com')).toBe(true);
      expect(isKnownOrAllowedHost('preview-stage-99.trycloudflare.com')).toBe(true);
    });

    it('accepts all brand subdomains (*.smmplan.pro, *.smmflux.ru, *.smmplan.ru)', () => {
      expect(isKnownOrAllowedHost('smmplan.pro')).toBe(true);
      expect(isKnownOrAllowedHost('test.smmplan.pro')).toBe(true);
      expect(isKnownOrAllowedHost('flux.smmplan.pro')).toBe(true);
      expect(isKnownOrAllowedHost('api.smmplan.pro')).toBe(true);
      expect(isKnownOrAllowedHost('smmflux.ru')).toBe(true);
      expect(isKnownOrAllowedHost('test.smmflux.ru')).toBe(true);
    });

    it('dynamically hydrates custom domains from ENV variables', () => {
      expect(isKnownOrAllowedHost('partner-mirror.agency.io')).toBe(false);

      process.env.TUNNEL_DOMAIN = 'partner-mirror.agency.io, custom-tunnel.org';
      expect(isKnownOrAllowedHost('partner-mirror.agency.io')).toBe(true);
      expect(isKnownOrAllowedHost('custom-tunnel.org')).toBe(true);
    });

    it('strictly blocks unauthorized malicious domains (OWASP A01/A05)', () => {
      expect(isKnownOrAllowedHost('evil-attacker.com')).toBe(false);
      expect(isKnownOrAllowedHost('fake-smmplan.pro.attacker.com')).toBe(false);
      expect(isKnownOrAllowedHost('not-really-ts.net.ru')).toBe(false);
    });
  });

  describe('2. Server Actions Forwarded Headers & Proxy Integrity', () => {
    it('sets synchronized x-forwarded-host and x-forwarded-proto for tunnel requests', async () => {
      const req = new NextRequest('http://127.0.0.1:3000/services', {
        headers: {
          host: '127.0.0.1:3000',
          'x-forwarded-host': 'my-new-tunnel.ts.net',
          'x-forwarded-proto': 'https',
        },
      });

      const res = await proxy(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-tenant-id')).toBe('smmplan');
      expect(res.headers.get('x-build-id')).toBeNull();
    });

    it('rejects malicious external Host header with HTTP 403', async () => {
      const req = new NextRequest('https://evil-phishing.com/services', {
        headers: {
          host: 'evil-phishing.com',
        },
      });

      const res = await proxy(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden: Invalid Host header');
    });

    it('allows security.txt scanning on any domain without 403', async () => {
      const req = new NextRequest('https://random-scanner.io/.well-known/security.txt', {
        headers: {
          host: 'random-scanner.io',
        },
      });

      const res = await proxy(req);
      expect(res.status).not.toBe(403);
    });
  });
});
