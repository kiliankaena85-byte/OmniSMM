import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/auth/logout/route';

describe('Logout Security & Server-Side Blacklist Suite (P2-18, P2-19)', () => {
  it('rejects GET logout without Sec-Fetch-Site with 405 Method Not Allowed', async () => {
    const req = new Request('http://localhost:3000/api/auth/logout', {
      method: 'GET',
    });
    const res = await GET(req);

    expect(res.status).toBe(405);
    const json = await res.json();
    expect(json.error).toContain('Use POST method');
  });

  it('rejects cross-site GET logout attempt with 405 Method Not Allowed', async () => {
    const req = new Request('http://localhost:3000/api/auth/logout', {
      method: 'GET',
      headers: {
        'sec-fetch-site': 'cross-site',
      },
    });
    const res = await GET(req);

    expect(res.status).toBe(405);
  });
});
