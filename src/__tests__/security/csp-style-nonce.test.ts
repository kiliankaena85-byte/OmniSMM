import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('CSP Security Suite (P1-9)', () => {
  it('injects W3C compliant CSP and x-nonce headers in production proxy', async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production';

    const req = new NextRequest('https://smmplan.pro/services', {
      headers: {
        host: 'smmplan.pro',
      },
    });

    const res = await proxy(req);
    const csp = res.headers.get('Content-Security-Policy');
    const nonce = res.headers.get('x-nonce');

    expect(csp).toBeDefined();
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(nonce).toBeDefined();

    (process.env as any).NODE_ENV = originalEnv;
  });
});
