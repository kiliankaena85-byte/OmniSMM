import { db } from '../../src/lib/db';
import fs from 'fs';
import path from 'path';

async function main() {
  const periodDays = 30; // Let's use 30 days as a default period for the report
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodDays);

  // Block 1: Conversion Funnel
  const linkPasted = await db.analyticsEvent.count({ where: { event: 'LINK_PASTED', createdAt: { gte: cutoff } } });
  const serviceSelected = await db.analyticsEvent.count({ where: { event: 'SERVICE_SELECTED', createdAt: { gte: cutoff } } });
  const checkoutInitiated = await db.analyticsEvent.count({ where: { event: 'CHECKOUT_INITIATED', createdAt: { gte: cutoff } } });
  const paymentClicked = await db.analyticsEvent.count({ where: { event: 'PAYMENT_CLICKED', createdAt: { gte: cutoff } } });
  const completed = await db.order.count({ where: { status: 'COMPLETED', createdAt: { gte: cutoff } } });

  const funnelOverall = linkPasted > 0 ? ((completed / linkPasted) * 100).toFixed(2) : '0.00';
  
  // Block 2: User Segmentation
  const newUsers = await db.user.count({ where: { createdAt: { gte: cutoff } } });
  
  // Active users (with at least 1 order in period)
  const activeUsersRaw = await db.order.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: cutoff } },
  });
  const activeUsersCount = activeUsersRaw.length;

  // For returning, repeat buyers, power users, we need user order counts and total spent
  const usersWithOrders = await db.user.findMany({
    select: { id: true, _count: { select: { orders: true } }, totalSpent: true },
    where: { orders: { some: {} } }
  });

  let returningUsersCount = 0;
  let firstTimeBuyersCount = 0;
  let repeatBuyersCount = 0;
  let powerUsersCount = 0;

  usersWithOrders.forEach(u => {
    if (u._count.orders === 1) firstTimeBuyersCount++;
    if (u._count.orders >= 2) {
      repeatBuyersCount++;
      // Returning active user in period
      if (activeUsersRaw.some(au => au.userId === u.id)) {
        returningUsersCount++;
      }
    }
    if (u._count.orders >= 10 || u.totalSpent >= BigInt(1000000)) { // 10000 RUB = 1000000 cents
      powerUsersCount++;
    }
  });

  const newVsReturningRatio = (newUsers + returningUsersCount) > 0 ? ((newUsers / (newUsers + returningUsersCount)) * 100).toFixed(2) : '0.00';

  // Block 3: Cohort Retention (Simplified W1 Retention for report)
  // Let's get users registered in week 0 (7-14 days ago) and ordered in week 1 (0-7 days ago)
  const w1Cutoff = new Date();
  w1Cutoff.setDate(w1Cutoff.getDate() - 7);
  const w0Cutoff = new Date();
  w0Cutoff.setDate(w0Cutoff.getDate() - 14);

  const cohortW0 = await db.user.findMany({
    where: { createdAt: { gte: w0Cutoff, lt: w1Cutoff } },
    select: { id: true }
  });
  let w1RetentionCount = 0;
  if (cohortW0.length > 0) {
    const cohortIds = cohortW0.map(u => u.id);
    const retainedUsers = await db.order.groupBy({
      by: ['userId'],
      where: { userId: { in: cohortIds }, createdAt: { gte: w1Cutoff } }
    });
    w1RetentionCount = retainedUsers.length;
  }
  const w1RetentionRate = cohortW0.length > 0 ? ((w1RetentionCount / cohortW0.length) * 100).toFixed(2) : '0.00';

  // Block 4: LTV Analysis
  const allUsersTotalSpent = await db.user.findMany({
    select: { id: true, totalSpent: true },
    where: { totalSpent: { gt: 0 } },
    orderBy: { totalSpent: 'asc' }
  });

  let meanLTV = 0;
  let top20PercentRevenue = 0;
  let paretoRatio = 0;
  let p50 = 0;

  if (allUsersTotalSpent.length > 0) {
    const totalRevenue = allUsersTotalSpent.reduce((sum, u) => sum + Number(u.totalSpent), 0);
    meanLTV = totalRevenue / allUsersTotalSpent.length;
    
    p50 = Number(allUsersTotalSpent[Math.floor(allUsersTotalSpent.length * 0.50)].totalSpent);

    const top20Index = Math.floor(allUsersTotalSpent.length * 0.80);
    const top20Users = allUsersTotalSpent.slice(top20Index);
    top20PercentRevenue = top20Users.reduce((sum, u) => sum + Number(u.totalSpent), 0);
    paretoRatio = totalRevenue > 0 ? (top20PercentRevenue / totalRevenue) * 100 : 0;
  }

  // Block 6: Top Services
  const topServicesRaw: {name: string, clicks: number}[] = await db.$queryRaw`
      SELECT "metadata"->>'serviceName' as name, COUNT(*)::int as clicks
      FROM "AnalyticsEvent"
      WHERE event = 'SERVICE_SELECTED' AND "createdAt" >= ${cutoff}
      GROUP BY "metadata"->>'serviceName'
      ORDER BY clicks DESC
      LIMIT 10
    `;

  // Report Generation
  const reportDate = new Date().toISOString().split('T')[0];
  const datetime = new Date().toISOString();

  let funnelVisual = `
LINK_PASTED:         ${'█'.repeat(20)} ${linkPasted} (100%)
SERVICE_SELECTED:    ${'█'.repeat(Math.round(serviceSelected/linkPasted * 20) || 0).padEnd(20, ' ')} ${serviceSelected} (${linkPasted > 0 ? Math.round(serviceSelected/linkPasted*100) : 0}%)
CHECKOUT_INITIATED:  ${'█'.repeat(Math.round(checkoutInitiated/linkPasted * 20) || 0).padEnd(20, ' ')} ${checkoutInitiated} (${linkPasted > 0 ? Math.round(checkoutInitiated/linkPasted*100) : 0}%)
PAYMENT_CLICKED:     ${'█'.repeat(Math.round(paymentClicked/linkPasted * 20) || 0).padEnd(20, ' ')} ${paymentClicked} (${linkPasted > 0 ? Math.round(paymentClicked/linkPasted*100) : 0}%)
COMPLETED:           ${'█'.repeat(Math.round(completed/linkPasted * 20) || 0).padEnd(20, ' ')} ${completed} (${linkPasted > 0 ? Math.round(completed/linkPasted*100) : 0}%)
`;

  let report = `# 👤 UX & Behavior Report — Smmplan
**Период:** ${cutoff.toISOString().split('T')[0]} — ${reportDate}
**Сгенерирован:** ${datetime}

## Conversion Funnel
\`\`\`text
${funnelVisual.trim()}
\`\`\`
**Overall Conversion: ${funnelOverall}%**

## User Segments
| Сегмент | Количество |
|---------|-----------|
| New Users | ${newUsers} |
| Active Users | ${activeUsersCount} |
| Returning | ${returningUsersCount} |
| First-Time Buyers | ${firstTimeBuyersCount} |
| Repeat Buyers | ${repeatBuyersCount} |
| Power Users | ${powerUsersCount} |

New vs Returning Ratio: ${newVsReturningRatio}%

## Cohort Retention Matrix
| Когорта | W0 Size | W1 Retained | W1 Rate |
|---------|---------|-------------|---------|
| 14-7d ago | ${cohortW0.length} | ${w1RetentionCount} | ${w1RetentionRate}% |

## LTV Distribution
* Mean LTV: ${(meanLTV/100).toFixed(2)} RUB
* Median LTV (P50): ${(p50/100).toFixed(2)} RUB
* Pareto Check (Top 20% users): ${paretoRatio.toFixed(2)}% of total revenue

## Top Services by Selection
`;

  topServicesRaw.forEach((s, i) => {
    report += `${i + 1}. ${s.name || 'Unknown'} - ${s.clicks} clicks\n`;
  });

  report += `
## 🚨 Alerts
`;
  let alertsCount = 0;
  if (parseFloat(funnelOverall) === 0) { report += `- 🔴 Zero Conversion\n`; alertsCount++; }
  else if (parseFloat(funnelOverall) < 5) { report += `- 🟡 Low Conversion\n`; alertsCount++; }
  
  if (newUsers === 0) { report += `- 🟡 No New Users\n`; alertsCount++; }
  if (parseFloat(w1RetentionRate) < 10 && cohortW0.length > 0) { report += `- 🟢 Retention Drop\n`; alertsCount++; }
  if (paretoRatio > 90) { report += `- 🟢 Pareto Alert (Too dependent on whales)\n`; alertsCount++; }

  if (alertsCount === 0) report += `- No active alerts.\n`;

  report += `
## 📋 Recommendations
- Провести аудит формы чекаута.
- Настроить ретаргетинг для пользователей, которые выбрали услугу, но не завершили покупку.
`;

  const reportDir = path.resolve('d:/SMM_plan_2/.planning/analytics/2026-06-12');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, 'ux-report.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`Report saved to ${reportPath}`);
}

main().catch(console.error);
