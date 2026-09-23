import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { getBaseUrlAsync, getBaseUrlSync } from '@/utils/get-base-url';

describe('Zero 0.0.0.0 Redirect Leak & Cloudflare Reverse Proxy Armor', () => {
  it('proxy: redirects unauthenticated /admin to public test.smmplan.pro/login when incoming host is 0.0.0.0:3000', async () => {
    const req = new NextRequest('http://0.0.0.0:3000/admin', {
      headers: {
        'host': '0.0.0.0:3000',
        'x-forwarded-host': 'test.smmplan.pro',
        'x-forwarded-proto': 'https',
      },
    });

    const response = await proxy(req);
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('https://test.smmplan.pro/login');
    expect(location).not.toContain('0.0.0.0');
    expect(location).not.toContain('host.docker.internal');
  });

  it('proxy: redirects to fallback domain when no x-forwarded-host is present but host is 0.0.0.0:3000', async () => {
    const req = new NextRequest('http://0.0.0.0:3000/dashboard', {
      headers: {
        'host': '0.0.0.0:3000',
      },
    });

    const response = await proxy(req);
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBeDefined();
    expect(location).not.toContain('0.0.0.0');
    expect(location).not.toContain('host.docker.internal');
  });

  it('proxy: maintains brand domain when accessing smmflux.ru', async () => {
    const req = new NextRequest('http://0.0.0.0:3000/dashboard', {
      headers: {
        'host': '0.0.0.0:3000',
        'x-forwarded-host': 'smmflux.ru',
        'x-forwarded-proto': 'https',
      },
    });

    const response = await proxy(req);
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('https://smmflux.ru/login');
    expect(location).not.toContain('0.0.0.0');
  });

  it('getBaseUrlSync: sanitizes 0.0.0.0:3000 to production domain or localhost without returning 0.0.0.0', () => {
    const baseUrl = getBaseUrlSync('0.0.0.0:3000');
    expect(baseUrl).not.toContain('0.0.0.0');
    expect(baseUrl).not.toContain('host.docker.internal');
  });

  it('getBaseUrlAsync: sanitizes 0.0.0.0:3000 to production domain or localhost without returning 0.0.0.0', async () => {
    const baseUrl = await getBaseUrlAsync('0.0.0.0:3000');
    expect(baseUrl).not.toContain('0.0.0.0');
    expect(baseUrl).not.toContain('host.docker.internal');
  });

  it('proxy: intercepts /api/auth/logout on SMMplan and redirects to /login with session cleanup', async () => {
    const req = new NextRequest('http://0.0.0.0:3000/api/auth/logout', {
      headers: {
        'host': '0.0.0.0:3000',
        'x-forwarded-host': 'test.smmplan.pro',
        'x-forwarded-proto': 'https',
      },
    });

    const response = await proxy(req);
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('https://test.smmplan.pro/login');
    expect(location).not.toContain('0.0.0.0');
    expect(response.cookies.get('explicit_logout')?.value).toBe('true');
  });

  it('proxy: intercepts /api/auth/logout on SMMflux and redirects to /login on smmflux.ru', async () => {
    const req = new NextRequest('http://0.0.0.0:3000/api/auth/logout', {
      headers: {
        'host': '0.0.0.0:3000',
        'x-forwarded-host': 'smmflux.ru',
        'x-forwarded-proto': 'https',
      },
    });

    const response = await proxy(req);
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('https://smmflux.ru/login');
    expect(location).not.toContain('0.0.0.0');
    expect(response.cookies.get('explicit_logout')?.value).toBe('true');
  });

  it('proxy: redirects legacy /p/offer to /legal/terms on active host', async () => {
    const req = new NextRequest('http://0.0.0.0:3000/p/offer', {
      headers: {
        'host': '0.0.0.0:3000',
        'x-forwarded-host': 'test.smmplan.pro',
        'x-forwarded-proto': 'https',
      },
    });

    const response = await proxy(req);
    expect(response.status).toBe(301);
    const location = response.headers.get('location');
    expect(location).toBe('https://test.smmplan.pro/legal/terms');
    expect(location).not.toContain('0.0.0.0');
  });

  it('proxy: protects /operator and redirects unauthenticated operator to /login', async () => {
    const req = new NextRequest('http://0.0.0.0:3000/operator', {
      headers: {
        'host': '0.0.0.0:3000',
        'x-forwarded-host': 'test.smmplan.pro',
        'x-forwarded-proto': 'https',
      },
    });

    const response = await proxy(req);
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('https://test.smmplan.pro/login');
    expect(location).not.toContain('0.0.0.0');
  });
});
