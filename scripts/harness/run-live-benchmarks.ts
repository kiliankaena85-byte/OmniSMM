/**
 * Live Performance Benchmarking & Endpoint Latency Measurement
 * Measures TTFB, Round-Trip Time and Rendering Latency against live container
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface RouteBenchmark {
  route: string;
  name: string;
  runs: number[];
  avgMs: number;
  minMs: number;
  maxMs: number;
  status: number;
  sizeBytes: number;
}

async function measureRoute(route: string, name: string, iterations = 3): Promise<RouteBenchmark> {
  const times: number[] = [];
  let status = 0;
  let sizeBytes = 0;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      const res = await fetch(`${BASE_URL}${route}`, {
        headers: {
          'User-Agent': 'Performance-Benchmark-Runner/2026',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      const text = await res.text();
      const end = performance.now();
      times.push(Number((end - start).toFixed(2)));
      status = res.status;
      sizeBytes = text.length;
    } catch (e) {
      times.push(999);
    }
  }

  const avgMs = Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(2));
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);

  return { route, name, runs: times, avgMs, minMs, maxMs, status, sizeBytes };
}

async function runLiveBenchmarks() {
  console.log('\n======================================================================');
  console.log('  ⚡ LIVE PERFORMANCE BENCHMARKING — OmniSMM 1.0 (Next.js Standalone)');
  console.log(`  Target: ${BASE_URL}`);
  console.log('======================================================================\n');

  const routes = [
    { route: '/', name: 'Главная страница (SSR Landing / Holding)' },
    { route: '/api/health', name: 'Health Endpoint (API / Health Probe)' },
    { route: '/api/maintenance-status', name: 'Maintenance Status (API Cache)' },
    { route: '/admin', name: 'Админ-панель (Дашборд / Auth Shield)' },
    { route: '/admin/catalog', name: 'Админка: Каталог (Skeleton / Suspense)' },
    { route: '/admin/finance', name: 'Админка: Финансы (Ledger Skeleton)' },
    { route: '/admin/settings', name: 'Админка: Настройки (Tab-Scoped)' },
    { route: '/admin/providers', name: 'Админка: Провайдеры (Skeleton)' },
  ];

  const results: RouteBenchmark[] = [];

  for (const r of routes) {
    process.stdout.write(`Measuring ${r.name.padEnd(45)}... `);
    const benchmark = await measureRoute(r.route, r.name, 3);
    results.push(benchmark);
    console.log(`Avg: ${benchmark.avgMs}ms | Min: ${benchmark.minMs}ms | HTTP ${benchmark.status}`);
  }

  console.log('\n======================================================================');
  console.log('  📊 РЕЗЮМЕ ПРОИЗВОДИТЕЛЬНОСТИ');
  console.log('======================================================================');
  console.table(
    results.map((r) => ({
      'Раздел': r.name,
      'Маршрут': r.route,
      'Статус': r.status,
      'Среднее (мс)': r.avgMs,
      'Мин (мс)': r.minMs,
      'Размер (байт)': r.sizeBytes,
    }))
  );
}

runLiveBenchmarks().catch(console.error);
