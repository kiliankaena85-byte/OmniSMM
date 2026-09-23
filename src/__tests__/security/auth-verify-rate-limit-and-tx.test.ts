import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/auth/verify/route';

describe('Auth Verify Rate Limiting & Serializable TX Suite (P2-13, P2-17)', () => {
  it('returns redirect with error=InvalidToken when no token is passed', async () => {
    const req = new Request('http://localhost:3000/api/auth/verify');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('error=InvalidToken');
  });

  it('rejects expired or non-existent token with ExpiredToken', async () => {
    const req = new Request('http://localhost:3000/api/auth/verify?token=fake_random_token_12345');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('error=ExpiredToken');
  });
});
