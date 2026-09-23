/**
 * Diagnostic tool for Russian ISP (MGTS, MTS, Beeline, Rostelecom) Connectivity & Cloudflare TSPU Inspection
 */
import dns from 'dns';
import https from 'https';

interface DnsProbeResult {
  server: string;
  name: string;
  status: 'OK' | 'FAILED';
  records?: string[];
  error?: string;
}

const DOMAINS_TO_TEST = ['test.smmplan.pro', 'smmplan.pro', 'flux.smmplan.pro'];

const RUSSIAN_RESOLVERS = [
  { name: 'Yandex DNS (Primary)', ip: '77.88.8.8' },
  { name: 'Yandex DNS (Secondary)', ip: '77.88.8.1' },
  { name: 'Cloudflare DNS', ip: '1.1.1.1' },
  { name: 'Google DNS', ip: '8.8.8.8' },
];

async function probeDns(domain: string, resolverIp: string, resolverName: string): Promise<DnsProbeResult> {
  const resolver = new dns.promises.Resolver();
  resolver.setServers([resolverIp]);

  try {
    const addresses = await resolver.resolve4(domain);
    return {
      server: `${resolverName} (${resolverIp})`,
      name: domain,
      status: 'OK',
      records: addresses,
    };
  } catch (err: unknown) {
    return {
      server: `${resolverName} (${resolverIp})`,
      name: domain,
      status: 'FAILED',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeHttps(domain: string): Promise<{ domain: string; status: number; server: string; cfRay?: string; ip?: string; timeMs: number }> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://${domain}/api/health`,
      {
        method: 'HEAD',
        timeout: 5000,
        headers: {
          'User-Agent': 'SMMplan-ISP-Watchdog/1.0',
        },
      },
      (res) => {
        const timeMs = Date.now() - start;
        resolve({
          domain,
          status: res.statusCode || 0,
          server: (res.headers['server'] as string) || 'unknown',
          cfRay: (res.headers['cf-ray'] as string) || undefined,
          timeMs,
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy(new Error('Connection timed out after 5000ms'));
    });

    req.end();
  });
}

async function runDiagnostic() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🔍 SMMplan Russian ISP & MGTS GPON Connectivity Diagnostic');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('1. [DNS Resolution Matrix across Russian & Global Resolvers]');
  for (const domain of DOMAINS_TO_TEST) {
    console.log(`\n  Target: ${domain}`);
    for (const res of RUSSIAN_RESOLVERS) {
      const result = await probeDns(domain, res.ip, res.name);
      if (result.status === 'OK') {
        console.log(`    ✅ ${result.server.padEnd(32)} -> [${result.records?.join(', ')}]`);
      } else {
        console.log(`    ❌ ${result.server.padEnd(32)} -> ERROR: ${result.error}`);
      }
    }
  }

  console.log('\n2. [HTTPS Edge Handshake & Response Check]');
  for (const domain of DOMAINS_TO_TEST) {
    try {
      const httpsResult = await probeHttps(domain);
      console.log(`    ✅ https://${domain} -> HTTP ${httpsResult.status} (${httpsResult.timeMs}ms) [Ray: ${httpsResult.cfRay || 'n/a'}]`);
    } catch (err: unknown) {
      console.log(`    ❌ https://${domain} -> ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Diagnostic Complete.');
  console.log('═══════════════════════════════════════════════════════════════════');
}

runDiagnostic().catch(console.error);
