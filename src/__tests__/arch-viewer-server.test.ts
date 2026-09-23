import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server } from '../../tools/arch-viewer/server.mjs';
import http from 'node:http';

const TEST_PORT = 3019;

function request(urlPath: string, options: http.RequestOptions = {}, postBody?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string; json: () => any }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: urlPath,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: data,
          json: () => JSON.parse(data)
        });
      });
    });

    req.on('error', reject);
    if (postBody) {
      req.write(postBody);
    }
    req.end();
  });
}

describe('OmniSMM Architecture Viewer Server (tools/arch-viewer)', () => {
  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server.listen(TEST_PORT, '127.0.0.1', () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('serves SPA index.html at root route /', async () => {
    const res = await request('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('OmniSMM 1.0');
    expect(res.body).toContain('Uncle Bob Pattern');
  });

  it('serves static assets (style.css and app.js)', async () => {
    const resCss = await request('/style.css');
    expect(resCss.status).toBe(200);
    expect(resCss.headers['content-type']).toContain('text/css');

    const resJs = await request('/app.js');
    expect(resJs.status).toBe(200);
    expect(resJs.headers['content-type']).toContain('application/javascript');
  });

  it('GET /api/topology returns valid Clean Architecture Topology JSON', async () => {
    const res = await request('/api/topology');
    expect(res.status).toBe(200);
    const data = res.json();
    expect(data.title).toContain('OmniSMM Architecture Topology');
    expect(data.layers).toHaveLength(4);
    expect(Array.isArray(data.nodes)).toBe(true);
    expect(data.nodes.length).toBeGreaterThan(1000);
    expect(Array.isArray(data.edges)).toBe(true);
  });

  it('GET /api/stats returns aggregated metrics, layer counts and top crappy functions', async () => {
    const res = await request('/api/stats');
    expect(res.status).toBe(200);
    const stats = res.json();

    expect(stats.metrics.totalFiles).toBeGreaterThan(1000);
    expect(stats.metrics.archScore).toBe(100);
    expect(stats.metrics.violationsCount).toBe(0);
    expect(stats.metrics.cyclesCount).toBe(0);

    // 4 Layers verified
    expect(stats.layers[0].name).toBe('Domain');
    expect(stats.layers[1].name).toBe('Services');
    expect(stats.layers[2].name).toBe('Application');
    expect(stats.layers[3].name).toBe('Presentation');

    // Bounded Contexts verified
    expect(stats.boundedContexts).toHaveProperty('FINTECH_LEDGER');
    expect(stats.boundedContexts).toHaveProperty('ORDERS_CHECKOUT');
    expect(stats.boundedContexts).toHaveProperty('CATALOG_INGESTION');

    // Top crappy functions
    expect(Array.isArray(stats.topCrappyFunctions)).toBe(true);
    expect(stats.topCrappyFunctions.length).toBeGreaterThan(0);
  });

  it('GET /api/file returns source content for valid src/ path', async () => {
    const res = await request('/api/file?path=src/utils/service-refill.ts');
    expect(res.status).toBe(200);
    const file = res.json();
    expect(file.path).toBe('src/utils/service-refill.ts');
    expect(file.linesCount).toBeGreaterThan(0);
    expect(file.content).toContain('PublicService');
  });

  it('SECURITY: GET /api/file blocks directory traversal (..)', async () => {
    const res = await request('/api/file?path=../../.env');
    expect(res.status).toBe(403);
    const err = res.json();
    expect(err.error).toContain('Access denied');
  });

  it('SECURITY: GET /api/file blocks access outside src/ and artifacts/', async () => {
    const res = await request('/api/file?path=package.json');
    expect(res.status).toBe(403);
  });

  it('SECURITY: GET /api/file blocks sensitive credential patterns', async () => {
    const res = await request('/api/file?path=src/.env.local');
    expect(res.status).toBe(403);
  });

  it('POST /api/proposal calculates simulated CRAP score reduction', async () => {
    const payload = JSON.stringify({
      targetNodeId: 'src/services/providers/smart-analyzer.logic.ts',
      splitFunctionNames: ['detectSync']
    });

    const res = await request('/api/proposal', { method: 'POST' }, payload);
    expect(res.status).toBe(200);
    const data = res.json();
    expect(data.success).toBe(true);
    expect(data.proposal.targetNodeId).toBe('src/services/providers/smart-analyzer.logic.ts');
    expect(data.proposal.removedRiskFns).toBe(1);
    expect(data.proposal.crapReductionPct).toBeGreaterThan(0);
    expect(data.proposal.recommendation).toContain('IMPACT');
  });
});
