import { scanRoutes } from './scanners/route-scanner';
import { scanSchema } from './scanners/schema-scanner';
import { scanBalanceMutations } from './scanners/balance-mutations';
import { scanIdempotencyKeys } from './scanners/idempotency-keys';
import { scanDevRoutes } from './scanners/dev-routes';
import { scanTenantFilters } from './scanners/tenant-filters';
import { scanOwnershipFilters } from './scanners/ownership-filters';
import { scanSecurityEvents } from './scanners/security-events';
import fs from 'fs';
import path from 'path';

export function runAllScanners() {
  const outDir = path.resolve(process.cwd(), '.antigravity/evidence/scanners');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('=== AEARH SCANNER ORCHESTRATION ===');

  const routes = scanRoutes();
  fs.writeFileSync(path.join(outDir, 'route-scanner.json'), JSON.stringify(routes, null, 2));
  console.log(`✓ route-scanner: found ${routes.pages.length} pages, ${routes.routes.length} api routes.`);

  const schema = scanSchema();
  fs.writeFileSync(path.join(outDir, 'schema-scanner.json'), JSON.stringify(schema, null, 2));
  console.log(`✓ schema-scanner: found ${schema.models.length} models, ${schema.enums.length} enums.`);

  const balance = scanBalanceMutations();
  fs.writeFileSync(path.join(outDir, 'balance-mutations.json'), JSON.stringify(balance, null, 2));
  console.log(`✓ balance-mutations: found ${balance.walletOpsCount} WalletOps calls, ${balance.directMutationCount} direct mutations.`);

  const idempotency = scanIdempotencyKeys();
  fs.writeFileSync(path.join(outDir, 'idempotency-keys.json'), JSON.stringify(idempotency, null, 2));
  console.log(`✓ idempotency-keys: found ${idempotency.matches.length} key usages (${idempotency.unstableCount} unstable).`);

  const dev = scanDevRoutes();
  fs.writeFileSync(path.join(outDir, 'dev-routes.json'), JSON.stringify(dev, null, 2));
  console.log(`✓ dev-routes: found ${dev.routes.length} dev routes (${dev.unprotectedCount} unprotected).`);

  const tenant = scanTenantFilters();
  fs.writeFileSync(path.join(outDir, 'tenant-filters.json'), JSON.stringify(tenant, null, 2));
  console.log(`✓ tenant-filters: ${tenant.modelsWithTenantId.length} models with tenantId, ${tenant.scopedQueriesCount} scoped queries.`);

  const ownership = scanOwnershipFilters();
  fs.writeFileSync(path.join(outDir, 'ownership-filters.json'), JSON.stringify(ownership, null, 2));
  console.log(`✓ ownership-filters: ${ownership.scopedDetailQueriesCount} scoped detail queries.`);

  const security = scanSecurityEvents();
  fs.writeFileSync(path.join(outDir, 'security-events.json'), JSON.stringify(security, null, 2));
  console.log(`✓ security-events: ${security.totalLoggedEventsCount} security events logged.`);

  console.log(`\nAll scanner artifacts successfully written to ${outDir}`);
}

if (require.main === module) {
  runAllScanners();
}
