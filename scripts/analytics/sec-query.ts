import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function runSecAudit() {
  const now = new Date();
  const startOfPeriod = new Date();
  startOfPeriod.setDate(now.getDate() - 30); // 30 days lookback

  const alerts: any[] = [];
  
  // 1. Authentication Attacks (Brute Force)
  const recentFailedLogins = await prisma.loginLog.findMany({
    where: { success: false, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
  });
  const failuresByIp = new Map<string, number>();
  for (const log of recentFailedLogins) {
    failuresByIp.set(log.ipAddress, (failuresByIp.get(log.ipAddress) || 0) + 1);
  }
  const bruteForceIps: any[] = [];
  for (const [ip, count] of failuresByIp.entries()) {
    if (count > 50) {
      alerts.push({ type: 'Brute Force', severity: 'CRITICAL', details: `IP ${ip} failed ${count} logins in 24h` });
      bruteForceIps.push({ ip, count });
    }
  }

  const recentSuccessLogins = await prisma.loginLog.findMany({
    where: { success: true, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, userId: { not: null } }
  });
  const ipsByUser = new Map<string, Set<string>>();
  for (const log of recentSuccessLogins) {
    if (log.userId) {
      if (!ipsByUser.has(log.userId)) ipsByUser.set(log.userId, new Set());
      ipsByUser.get(log.userId)!.add(log.ipAddress);
    }
  }
  const atoIndicators: any[] = [];
  for (const [userId, ips] of ipsByUser.entries()) {
    if (ips.size > 3) {
      alerts.push({ type: 'Account Takeover', severity: 'HIGH', details: `User ${userId} logged in from ${ips.size} different IPs in 24h` });
      atoIndicators.push({ userId, ips: Array.from(ips) });
    }
  }

  // 2. Admin Activity Audit
  const adminActions = await prisma.adminAuditLog.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' }
  });
  const offHoursActions = adminActions.filter(a => {
    const h = a.createdAt.getUTCHours() + 3; // roughly MSK time
    return (h % 24) >= 0 && (h % 24) < 6;
  });
  if (offHoursActions.length > 0) {
     alerts.push({ type: 'Off-Hours Admin', severity: 'HIGH', details: `${offHoursActions.length} admin actions between 00:00-06:00` });
  }

  // 3. Financial Integrity
  const largeCredits = await prisma.ledgerEntry.findMany({
    where: { 
      amount: { gt: BigInt(1000000) }, // > 10,000 RUB
      createdAt: { gte: startOfPeriod }
    }
  });
  for (const entry of largeCredits) {
    alerts.push({ type: 'Large Manual Credit', severity: 'CRITICAL', details: `Ledger ${entry.id}: ${Number(entry.amount)/100} RUB to ${entry.userId} by ${entry.adminId || 'SYSTEM'}` });
  }

  // Refund Abuse
  const refunds = await prisma.ledgerEntry.findMany({
    where: { transactionType: 'REFUND', createdAt: { gte: startOfPeriod } }
  });
  const refundsByUser = new Map<string, number>();
  for (const r of refunds) {
    refundsByUser.set(r.userId, (refundsByUser.get(r.userId) || 0) + 1);
  }
  const massRefunds: any[] = [];
  for (const [userId, count] of refundsByUser.entries()) {
    if (count > 5) {
      alerts.push({ type: 'Mass Refund', severity: 'HIGH', details: `User ${userId} had ${count} refunds in 30 days` });
      massRefunds.push({ userId, count });
    }
  }

  // 4. Infrastructure (Rate Limit)
  const rateLimits = await prisma.rateLimit.findMany();
  const apiAbusers = rateLimits.filter(r => r.hits > 100);
  for (const abuser of apiAbusers) {
     alerts.push({ type: 'API Abuse', severity: 'HIGH', details: `IP ${abuser.ip} hit ${abuser.endpoint} ${abuser.hits} times` });
  }

  // Session Anomalies
  const sessions = await prisma.session.findMany({
     where: { expiresAt: { gt: new Date() } }
  });
  const activeSessionsByUser = new Map<string, number>();
  for (const s of sessions) {
     activeSessionsByUser.set(s.userId, (activeSessionsByUser.get(s.userId) || 0) + 1);
  }
  for (const [userId, count] of activeSessionsByUser.entries()) {
     if (count > 5) {
        alerts.push({ type: 'Session Anomaly', severity: 'MEDIUM', details: `User ${userId} has ${count} concurrent sessions` });
     }
  }

  const threatLevel = alerts.some(a => a.severity === 'CRITICAL') ? '🔴 HIGH' : alerts.some(a => a.severity === 'HIGH') ? '🟡 ELEVATED' : '🟢 LOW';

  let md = `# 🛡️ Security Report — Smmplan
**Период:** ${startOfPeriod.toISOString()} — ${now.toISOString()}
**Сгенерирован:** ${now.toISOString()}
**Threat Level:** ${threatLevel}

## Incident Summary
| # | Type | Severity | Details | Status |
|---|------|----------|---------|--------|
`;

  alerts.forEach((a, i) => {
    md += `| ${i + 1} | ${a.type} | ${a.severity} | ${a.details} | Open |\n`;
  });

  md += `
## Authentication Security
- Brute Force IPs (last 24h): ${bruteForceIps.length ? bruteForceIps.map(x => `${x.ip} (${x.count} fails)`).join(', ') : 'None detected'}
- ATO Indicators (User with > 3 IPs in 24h): ${atoIndicators.length ? atoIndicators.map(x => `User ${x.userId} (${x.ips.length} IPs)`).join(', ') : 'None detected'}

## Admin Activity Timeline
- Total actions in last 7 days: ${adminActions.length}
- Off-hours actions: ${offHoursActions.length}

## Financial Integrity
- Large Credits (> 10000 RUB): ${largeCredits.length}
- Mass Refunds (> 5 per user): ${massRefunds.length}

## Infrastructure
- API Abusers (> 100 hits): ${apiAbusers.length}
- Anomalous concurrent sessions: ${Array.from(activeSessionsByUser.entries()).filter(x => x[1] > 5).length}

## 🚨 Active Alerts
`;
  if (alerts.length === 0) {
    md += "No active alerts.\n";
  } else {
    alerts.forEach(a => {
      md += `- **[${a.severity}] ${a.type}**: ${a.details}\n`;
    });
  }

  md += `
## 📋 Recommended Actions
1. Внимательно проверить логи для IP с превышением лимитов или множественными ошибками аутентификации.
2. Провести ревью подозрительных сессий и крупных начислений на баланс.
3. Проверить пользователей с частыми возвратами (refund abuse).
`;

  const outDir = 'd:\\SMM_plan_2\\.planning\\analytics\\2026-06-12';
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'sec-report.md'), md);
  console.log('Report generated at ' + path.join(outDir, 'sec-report.md'));
}

runSecAudit().catch(console.error).finally(() => prisma.$disconnect());
