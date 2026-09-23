import { describe, it, expect } from 'vitest';
import { isInternalHost, proxy } from '@/proxy';
import { NextRequest } from 'next/server';

describe('SEC-06: isInternalHost Pattern Hardening against evil-docker.com and spoofing', () => {
  it('identifies genuine internal hosts correctly (including port numbers)', () => {
    expect(isInternalHost('localhost')).toBe(true);
    expect(isInternalHost('localhost:3000')).toBe(true);
    expect(isInternalHost('127.0.0.1')).toBe(true);
    expect(isInternalHost('127.0.0.1:5433')).toBe(true);
    expect(isInternalHost('0.0.0.0')).toBe(true);
    expect(isInternalHost('0.0.0.0:3000')).toBe(true);
    expect(isInternalHost('host.docker.internal')).toBe(true);
    expect(isInternalHost('host.docker.internal:3000')).toBe(true);
  });

  it('strictly rejects substring-spoofed domains like evil-docker.com or fake-localhost.com', () => {
    expect(isInternalHost('evil-docker.com')).toBe(false);
    expect(isInternalHost('docker.com')).toBe(false);
    expect(isInternalHost('my-host.docker.internal.attacker.com')).toBe(false);
    expect(isInternalHost('fake-localhost.com')).toBe(false);
    expect(isInternalHost('127.0.0.1.nip.io')).toBe(false);
    expect(isInternalHost('0.0.0.0.evil.com')).toBe(false);
  });

  it('rejects unknown host header in proxy with 403 Forbidden', async () => {
    const req = new NextRequest('https://evil-docker.com/services', {
      headers: {
        host: 'evil-docker.com'
      }
    });

    const res = await proxy(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Forbidden: Invalid Host header');
  });
});
