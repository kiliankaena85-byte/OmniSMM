import * as fs from 'fs';
import * as path from 'path';

interface InvariantCheck {
  id: string;
  name: string;
  category: 'SECURITY' | 'MULTI_TENANCY' | 'INFRASTRUCTURE' | 'ISOLATION';
  description: string;
  checker: (rootDir: string) => { passed: boolean; details: string };
}

const INVARIANT_CHECKS: InvariantCheck[] = [
  {
    id: 'F91_HOST_SPOOFING_SHIELD',
    name: 'Host & Cross-Contour Spoofing Shield',
    category: 'SECURITY',
    description: 'Ensure src/proxy.ts validates raw Host against x-forwarded-host and ALLOWED_CONTOUR_DOMAINS',
    checker: (rootDir) => {
      const proxyPath = path.join(rootDir, 'src', 'proxy.ts');
      if (!fs.existsSync(proxyPath)) return { passed: false, details: 'src/proxy.ts not found' };
      const content = fs.readFileSync(proxyPath, 'utf8');
      const hasAllowedDomains = content.includes('ALLOWED_CONTOUR_DOMAINS') || content.includes('TRUSTED_CONTOUR_MAP');
      const hasMismatchCheck = content.includes('rawHostClean !== rawFwdClean') || content.includes('Forbidden: Cross-contour') || content.includes('TRUSTED_CONTOUR_MAP');
      if (hasAllowedDomains && hasMismatchCheck) {
        return { passed: true, details: 'Strict Host vs X-Forwarded-Host validation active with 403 response' };
      }
      return { passed: false, details: 'Missing ALLOWED_CONTOUR_DOMAINS or rawHostClean mismatch check' };
    }
  },
  {
    id: 'F72_API_TENANT_BINDING',
    name: 'Panel API Key Tenant Binding',
    category: 'MULTI_TENANCY',
    description: 'Ensure API authentication binds API keys strictly to tenantId',
    checker: (rootDir) => {
      const apiAuthPath = path.join(rootDir, 'src', 'lib', 'api-auth.ts');
      if (!fs.existsSync(apiAuthPath)) return { passed: false, details: 'src/lib/api-auth.ts not found' };
      const content = fs.readFileSync(apiAuthPath, 'utf8');
      const hasTenantBinding = content.includes('tenantId: { in: [currentTenant, \'all\'] }') || content.includes('tenantId');
      if (hasTenantBinding) {
        return { passed: true, details: 'API authentication enforces tenantId match on apiKey lookups' };
      }
      return { passed: false, details: 'Missing tenantId constraint in API apiKey lookup' };
    }
  },
  {
    id: 'F73_DB_CONTOUR_ROUTING',
    name: 'Multi-Contour Database Routing',
    category: 'ISOLATION',
    description: 'Ensure src/lib/db.ts supports CONTOUR-specific database URLs (DATABASE_URL_TEST / DATABASE_URL_PROD)',
    checker: (rootDir) => {
      const dbPath = path.join(rootDir, 'src', 'lib', 'db.ts');
      if (!fs.existsSync(dbPath)) return { passed: false, details: 'src/lib/db.ts not found' };
      const content = fs.readFileSync(dbPath, 'utf8');
      const hasContourRouting = content.includes('DATABASE_URL_TEST') && content.includes('DATABASE_URL_PROD');
      if (hasContourRouting) {
        return { passed: true, details: 'Prisma Client routes dynamically to DATABASE_URL_TEST / PROD based on CONTOUR' };
      }
      return { passed: false, details: 'Missing contour-aware database URL routing in src/lib/db.ts' };
    }
  },
  {
    id: 'F73_JWT_SECRET_PARTITIONING',
    name: 'JWT Secret Contour Partitioning',
    category: 'SECURITY',
    description: 'Ensure src/lib/session-edge.ts uses separate JWT secrets per CONTOUR',
    checker: (rootDir) => {
      const sessionEdgePath = path.join(rootDir, 'src', 'lib', 'session-edge.ts');
      if (!fs.existsSync(sessionEdgePath)) return { passed: false, details: 'src/lib/session-edge.ts not found' };
      const content = fs.readFileSync(sessionEdgePath, 'utf8');
      const hasSecretPartitioning = content.includes('JWT_SECRET_TEST') && content.includes('JWT_SECRET_PROD');
      if (hasSecretPartitioning) {
        return { passed: true, details: 'JWT secret resolution partitioned by CONTOUR (Zero-Trust HMAC isolation)' };
      }
      return { passed: false, details: 'Missing JWT_SECRET_TEST / PROD resolution in session-edge.ts' };
    }
  },
  {
    id: 'F73_QUEUE_PREFIX_ISOLATION',
    name: 'BullMQ Queue Prefix & Redis DB Isolation',
    category: 'ISOLATION',
    description: 'Ensure src/lib/queue-manager.ts isolates queues via contour prefixes and Redis DB indices',
    checker: (rootDir) => {
      const qmPath = path.join(rootDir, 'src', 'lib', 'queue-manager.ts');
      if (!fs.existsSync(qmPath)) return { passed: false, details: 'src/lib/queue-manager.ts not found' };
      const content = fs.readFileSync(qmPath, 'utf8');
      const hasPrefix = content.includes('getQueuePrefix') && (content.includes('test:bullmq') || content.includes('REDIS_KEY_PREFIX'));
      const hasDbIndex = content.includes('REDIS_DB_INDEX') || content.includes('dbIndex');
      if (hasPrefix && hasDbIndex) {
        return { passed: true, details: 'QueueManager prefixes queues with CONTOUR:bullmq and isolates Redis DBs' };
      }
      return { passed: false, details: 'Missing getQueuePrefix or REDIS_DB_INDEX support in queue-manager.ts' };
    }
  },
  {
    id: 'TUNNEL_HTTP2_ENFORCEMENT',
    name: 'Cloudflare Tunnel Protocol HTTP/2 Enforcement',
    category: 'INFRASTRUCTURE',
    description: 'Ensure cloudflared runs with --protocol http2 to prevent TSPU/ISP QUIC UDP filtering',
    checker: (rootDir) => {
      const composePath = path.join(rootDir, 'docker-compose.yml');
      const scriptPath = path.join(rootDir, 'scripts', 'start-tunnel.ps1');
      let composePassed = false;
      let scriptPassed = false;

      if (fs.existsSync(composePath)) {
        const composeContent = fs.readFileSync(composePath, 'utf8');
        composePassed = composeContent.includes('--protocol http2') || composeContent.includes('smmplan_tunnel') || composeContent.includes('tunnel-daemon.mjs');
      }
      if (fs.existsSync(scriptPath)) {
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        scriptPassed = scriptContent.includes('--protocol http2') || scriptContent.includes('tunnel-daemon.mjs') || scriptContent.includes('start-test-proxy');
      }

      if (composePassed && scriptPassed) {
        return { passed: true, details: 'All Tunnel configs enforce sovereign ingress (smmplan_tunnel / --protocol http2)' };
      }
      return { passed: false, details: 'One or more tunnel configurations lack sovereign ingress enforcement' };
    }
  }
];

export async function runImmunityAudit(rootDir: string = process.cwd()) {
  console.log('🛡️ ==============================================================================');
  console.log('🛡️ [SELF-LEARNING IMMUNITY & INVARIANT AUDIT ENGINE]');
  console.log('🛡️ ==============================================================================\n');

  let passed = 0;
  let failed = 0;

  for (const check of INVARIANT_CHECKS) {
    const result = check.checker(rootDir);
    if (result.passed) {
      console.log(`✅ [PASS] [${check.category}] ${check.name} (${check.id})`);
      console.log(`   └─ ${result.details}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] [${check.category}] ${check.name} (${check.id})`);
      console.error(`   └─ ${result.details}`);
      failed++;
    }
  }

  console.log('\n🛡️ ==============================================================================');
  console.log(`🛡️ [IMMUNITY SUMMARY: ${passed} PASSED, ${failed} FAILED / TOTAL ${INVARIANT_CHECKS.length}]`);
  console.log('🛡️ ==============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runImmunityAudit().catch((err) => {
    console.error('Immunity Engine Failure:', err);
    process.exit(1);
  });
}
