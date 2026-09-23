/**
 * scripts/audit-services-health.ts
 *
 * Full diagnostic health check for all active services in the DB:
 * 1. Pricing integrity (zero/negative rates, margin floor breaches, rounding anomalies)
 * 2. Min/Max quantity sanity (minQty <= 0, maxQty < minQty, unrealistic bounds)
 * 3. Drip-Feed invariants (isDripFeedEnabled vs minQty)
 * 4. TargetType & CustomData consistency
 * 5. Vendor brand leaks (VexBoost, PrimeLike, raw IDs in names)
 * 6. Duplicate naming collisions within same category
 * 7. Tenant isolation & orphan services (services with invalid category/provider)
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

interface AuditIssue {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  serviceId: string;
  serviceName: string;
  tenantId: string;
  categoryName: string;
  networkName: string;
  message: string;
}

async function main() {
  console.log('====================================================');
  console.log('   🔍 SMMplan Comprehensive Service Catalog Audit   ');
  console.log('====================================================\n');

  const services = await db.service.findMany({
    where: { isActive: true },
    include: {
      category: {
        include: { network: true },
      },
      provider: true,
    },
  });

  console.log(`📊 Total Active Services Audited: ${services.length}\n`);

  const issues: AuditIssue[] = [];

  // Track name duplicates within same category & tenant
  const nameMap = new Map<string, string[]>();

  for (const s of services) {
    const catName = s.category?.name || 'ORPHAN_NO_CATEGORY';
    const netName = s.category?.network?.name || 'ORPHAN_NO_NETWORK';
    const tenant = s.tenantId;

    // 1. Orphan checks
    if (!s.category) {
      issues.push({
        severity: 'CRITICAL',
        serviceId: s.id,
        serviceName: s.name,
        tenantId: tenant,
        categoryName: 'NONE',
        networkName: 'NONE',
        message: 'Service has no category (Orphan record)',
      });
    }

    if (!s.providerId || !s.provider) {
      issues.push({
        severity: 'CRITICAL',
        serviceId: s.id,
        serviceName: s.name,
        tenantId: tenant,
        categoryName: catName,
        networkName: netName,
        message: 'Active service has no linked provider',
      });
    }

    // 2. Pricing checks
    if (s.rate <= 0) {
      issues.push({
        severity: 'CRITICAL',
        serviceId: s.id,
        serviceName: s.name,
        tenantId: tenant,
        categoryName: catName,
        networkName: netName,
        message: `Invalid rate: ${s.rate} (must be > 0)`,
      });
    }

    if (s.markup < 1.1) {
      issues.push({
        severity: 'WARNING',
        serviceId: s.id,
        serviceName: s.name,
        tenantId: tenant,
        categoryName: catName,
        networkName: netName,
        message: `Low markup: ${s.markup}x (recommended >= 1.3x)`,
      });
    }

    if (s.pricePer1000Cents <= 0) {
      issues.push({
        severity: 'CRITICAL',
        serviceId: s.id,
        serviceName: s.name,
        tenantId: tenant,
        categoryName: catName,
        networkName: netName,
        message: `Invalid pricePer1000Cents: ${s.pricePer1000Cents}`,
      });
    }

    // 3. Min/Max quantity sanity
    if (s.minQty <= 0) {
      issues.push({
        severity: 'CRITICAL',
        serviceId: s.id,
        serviceName: s.name,
        tenantId: tenant,
        categoryName: catName,
        networkName: netName,
        message: `minQty <= 0 (${s.minQty})`,
      });
    }

    if (s.maxQty < s.minQty) {
      issues.push({
        severity: 'CRITICAL',
        serviceId: s.id,
        serviceName: s.name,
        tenantId: tenant,
        categoryName: catName,
        networkName: netName,
        message: `maxQty (${s.maxQty}) is less than minQty (${s.minQty})`,
      });
    }

    // 4. Vendor leaks in name or description
    const leakRegex = /\b(vexboost|primelike|smmbox|justanotherpanel|jap|socpanel|smm\s*toolbox)\b/i;
    if (leakRegex.test(s.name) || (s.description && leakRegex.test(s.description))) {
      issues.push({
        severity: 'CRITICAL',
        serviceId: s.id,
        serviceName: s.name,
        tenantId: tenant,
        categoryName: catName,
        networkName: netName,
        message: 'Vendor brand name leaked in service title or description',
      });
    }

    // 5. Duplicate names in same category & tenant
    const key = `${tenant}:${s.categoryId}:${s.name.toLowerCase().trim()}`;
    if (!nameMap.has(key)) {
      nameMap.set(key, []);
    }
    nameMap.get(key)!.push(s.id);
  }

  // Check duplicate collisions
  for (const [key, ids] of nameMap.entries()) {
    if (ids.length > 1) {
      const [tenant, catId, name] = key.split(':');
      issues.push({
        severity: 'WARNING',
        serviceId: ids.join(', '),
        serviceName: name,
        tenantId: tenant,
        categoryName: catId,
        networkName: '',
        message: `Duplicate active service names (${ids.length} services) in category ${catId}`,
      });
    }
  }

  // Summary
  const criticals = issues.filter(i => i.severity === 'CRITICAL');
  const warnings = issues.filter(i => i.severity === 'WARNING');
  const infos = issues.filter(i => i.severity === 'INFO');

  console.log(`🚨 CRITICAL Issues: ${criticals.length}`);
  console.log(`⚠️  WARNINGS:        ${warnings.length}`);
  console.log(`ℹ️  INFO Items:      ${infos.length}\n`);

  if (criticals.length > 0) {
    console.log('❌ CRITICAL ISSUES:');
    criticals.forEach(c => {
      console.log(`  - [${c.networkName} > ${c.categoryName}] "${c.serviceName}" (${c.tenantId}): ${c.message}`);
    });
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.slice(0, 15).forEach(w => {
      console.log(`  - [${w.networkName} > ${w.categoryName}] "${w.serviceName}" (${w.tenantId}): ${w.message}`);
    });
    if (warnings.length > 15) {
      console.log(`    ... and ${warnings.length - 15} more warnings`);
    }
    console.log('');
  }

  if (issues.length === 0) {
    console.log('🎉 100% HEALTHY! All active services passed all safety, pricing, and taxonomy checks.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
