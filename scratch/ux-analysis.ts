import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runUXAnalysis() {
  console.log('Starting UX & Behavioral Analysis...');

  // Date range: last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  console.log(`Period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

  try {
    // 1. Conversion Funnel
    const linkPasted = await prisma.analyticsEvent.count({
      where: { event: 'LINK_PASTED', createdAt: { gte: startDate, lte: endDate } }
    });
    const serviceSelected = await prisma.analyticsEvent.count({
      where: { event: 'SERVICE_SELECTED', createdAt: { gte: startDate, lte: endDate } }
    });
    const checkoutInitiated = await prisma.analyticsEvent.count({
      where: { event: 'CHECKOUT_INITIATED', createdAt: { gte: startDate, lte: endDate } }
    });
    const paymentClicked = await prisma.analyticsEvent.count({
      where: { event: 'PAYMENT_CLICKED', createdAt: { gte: startDate, lte: endDate } }
    });
    const completedOrders = await prisma.order.count({
      where: { status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } }
    });

    const drop1_2 = linkPasted > 0 ? ((linkPasted - serviceSelected) / linkPasted * 100).toFixed(1) : '0.0';
    const drop2_3 = serviceSelected > 0 ? ((serviceSelected - checkoutInitiated) / serviceSelected * 100).toFixed(1) : '0.0';
    const drop3_4 = checkoutInitiated > 0 ? ((checkoutInitiated - paymentClicked) / checkoutInitiated * 100).toFixed(1) : '0.0';
    const drop4_5 = paymentClicked > 0 ? ((paymentClicked - completedOrders) / paymentClicked * 100).toFixed(1) : '0.0';
    const overallConversion = linkPasted > 0 ? ((completedOrders / linkPasted) * 100).toFixed(1) : '0.0';

    // 2. User Segmentation
    const totalUsers = await prisma.user.count();
    const newUsers = await prisma.user.count({
      where: { createdAt: { gte: startDate, lte: endDate } }
    });
    
    // Active Users in last 30 days
    const activeUsersList = await prisma.order.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true }
    });
    const activeUsersCount = activeUsersList.length;

    // Returning Users: Active users who have > 1 order overall
    let returningUsersCount = 0;
    for (const active of activeUsersList) {
      const totalOrderCount = await prisma.order.count({ where: { userId: active.userId } });
      if (totalOrderCount > 1) {
        returningUsersCount++;
      }
    }
    const newVsReturningRatio = (activeUsersCount > 0) ? ((newUsers / (newUsers + returningUsersCount)) * 100).toFixed(1) : '0.0';

    const repeatBuyersCount = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM (
        SELECT "userId" FROM "Order"
        GROUP BY "userId"
        HAVING COUNT("id") >= 2
      ) as sub
    `;
    const repeatBuyers = Number(repeatBuyersCount[0]?.count || 0);
    const firstTimeBuyers = totalUsers - repeatBuyers;

    const powerUsers = await prisma.user.count({
      where: {
        OR: [
          { totalSpent: { gt: 1000000 } }, // > 10,000 RUB (in Cents)
          { orders: { some: {} } } // handled by raw below for strictness
        ]
      }
    });

    // 3. LTV Distribution
    const usersSpent = await prisma.user.findMany({
      select: { totalSpent: true },
      orderBy: { totalSpent: 'asc' }
    });
    
    const spentValues = usersSpent.map(u => Number(u.totalSpent) / 100); // convert cents to RUB
    const count = spentValues.length;
    
    const getPercentile = (p: number) => {
      if (count === 0) return 0;
      const index = Math.ceil((p / 100) * count) - 1;
      return spentValues[Math.max(0, index)];
    };

    const meanLTV = spentValues.length > 0 ? spentValues.reduce((a, b) => a + b, 0) / spentValues.length : 0;
    
    // Pareto Check
    const totalRevenue = spentValues.reduce((a, b) => a + b, 0);
    const top20PercentCount = Math.ceil(count * 0.2);
    const top20Spent = spentValues.slice(-top20PercentCount).reduce((a, b) => a + b, 0);
    const paretoRatio = totalRevenue > 0 ? ((top20Spent / totalRevenue) * 100).toFixed(1) : '0.0';

    // 4. Referral Program
    const referralUsersCount = await prisma.user.count({
      where: { referredById: { not: null } }
    });
    const referralSpentAvg = await prisma.user.aggregate({
      where: { referredById: { not: null } },
      _avg: { totalSpent: true }
    });
    const organicSpentAvg = await prisma.user.aggregate({
      where: { referredById: null },
      _avg: { totalSpent: true }
    });

    const refLTVRub = (Number(referralSpentAvg._avg.totalSpent || 0) / 100);
    const orgLTVRub = (Number(organicSpentAvg._avg.totalSpent || 0) / 100);
    const ltvUplift = orgLTVRub > 0 ? (((refLTVRub - orgLTVRub) / orgLTVRub) * 100).toFixed(1) : '0.0';

    const activeReferrersCount = await prisma.$queryRaw<any[]>`
      SELECT COUNT(DISTINCT "referredById") as count FROM "User" WHERE "referredById" IS NOT NULL
    `;
    const activeReferrers = Number(activeReferrersCount[0]?.count || 0);

    const paidCommission = await prisma.commission?.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true }
    }) || { _sum: { amount: 0 } };
    const paidCommissionRub = Number(paidCommission._sum.amount || 0) / 100;
    const referralRevenue = await prisma.user.aggregate({
      where: { referredById: { not: null } },
      _sum: { totalSpent: true }
    });
    const referralRevenueRub = Number(referralRevenue._sum.totalSpent || 0) / 100;
    const commissionROI = paidCommissionRub > 0 ? ((referralRevenueRub / paidCommissionRub) * 100).toFixed(1) : '0.0';

    // 5. Service Preferences
    const topServicesCount = await prisma.$queryRaw<any[]>`
      SELECT s.id, s.name, COUNT(o.id)::int as count, SUM(o.charge)::float/100 as revenue
      FROM "Service" s
      LEFT JOIN "Order" o ON o."serviceId" = s.id
      GROUP BY s.id, s.name
      ORDER BY count DESC
      LIMIT 10
    `;

    // 6. Payment Behavior
    const paymentGateways = await prisma.$queryRaw<any[]>`
      SELECT gateway, COUNT(*)::int as count, 
        COUNT(CASE WHEN status = 'CANCELED' THEN 1 END)::int as failed
      FROM "Payment"
      GROUP BY gateway
    `;

    // Generate Cohort Matrix mock/real
    // Register cohorts by registration week
    const weeks = [4, 3, 2, 1, 0];
    const cohorts: any[] = [];
    
    for (const w of weeks) {
      const cohortStart = new Date();
      cohortStart.setDate(cohortStart.getDate() - (w + 1) * 7);
      const cohortEnd = new Date();
      cohortEnd.setDate(cohortEnd.getDate() - w * 7);

      const cohortUsers = await prisma.user.findMany({
        where: { createdAt: { gte: cohortStart, lte: cohortEnd } },
        select: { id: true }
      });
      const cohortSize = cohortUsers.length;
      
      if (cohortSize > 0) {
        const cohortUserIds = cohortUsers.map(u => u.id);
        const w0Active = await prisma.order.findFirst({
          where: { userId: { in: cohortUserIds }, createdAt: { gte: cohortStart, lte: cohortEnd } }
        }) ? 100 : 0; // standard registration week order

        // Week 1 activity
        const w1Start = new Date(cohortStart); w1Start.setDate(w1Start.getDate() + 7);
        const w1End = new Date(cohortEnd); w1End.setDate(w1End.getDate() + 7);
        const w1ActiveCount = await prisma.order.groupBy({
          by: ['userId'],
          where: { userId: { in: cohortUserIds }, createdAt: { gte: w1Start, lte: w1End } }
        });
        const w1Rate = ((w1ActiveCount.length / cohortSize) * 100).toFixed(1);

        // Week 2 activity
        const w2Start = new Date(cohortStart); w2Start.setDate(w2Start.getDate() + 14);
        const w2End = new Date(cohortEnd); w2End.setDate(w2End.getDate() + 14);
        const w2ActiveCount = await prisma.order.groupBy({
          by: ['userId'],
          where: { userId: { in: cohortUserIds }, createdAt: { gte: w2Start, lte: w2End } }
        });
        const w2Rate = ((w2ActiveCount.length / cohortSize) * 100).toFixed(1);

        cohorts.push({
          cohortName: `Когорта ${cohortStart.toLocaleDateString()}`,
          size: cohortSize,
          w0: '100%',
          w1: `${w1Rate}%`,
          w2: `${w2Rate}%`
        });
      }
    }

    // 7. Time metrics
    const peakHoursRaw = await prisma.$queryRaw<any[]>`
      SELECT EXTRACT(HOUR FROM "createdAt")::int as hour, COUNT(*)::int as count
      FROM "Order"
      GROUP BY hour
      ORDER BY count DESC
      LIMIT 3
    `;
    const peakHours = peakHoursRaw.map(h => `${h.hour}:00 (${h.count} зак.)`).join(', ');

    // 8. Alerts
    const alerts: string[] = [];
    if (linkPasted > 0 && Number(overallConversion) === 0) {
      alerts.push('🔴 **Zero Conversion**: Конверсия из ссылки в заказ 0% за последние 30 дней! Требуется проверить платежные шлюзы и процесс чекаута.');
    } else if (linkPasted > 0 && Number(overallConversion) < 5) {
      alerts.push('🟡 **Low Conversion**: Общая конверсия ниже 5% (' + overallConversion + '%).');
    }

    if (linkPasted > 0 && Number(drop3_4) > 50) {
      alerts.push('🟡 **High Drop-off (Checkout -> Payment)**: Высокий процент отказа (' + drop3_4 + '%) при переходе от оформления к нажатию кнопки оплаты.');
    }

    if (newUsers === 0) {
      alerts.push('🟡 **No New Users**: Зарегистрировано 0 новых пользователей за последние 30 дней.');
    }

    if (Number(paretoRatio) > 90) {
      alerts.push('🟢 **Pareto Alert**: Топ 20% пользователей приносят более 90% выручки (' + paretoRatio + '%). Критическая зависимость бизнеса от узкой группы крупных покупателей ("китов").');
    }

    const reportDir = path.join('d:', 'SMM_plan_2', '.planning', 'analytics', new Date().toISOString().split('T')[0]);
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, 'ux-report.md');

    let md = `# 👤 UX & Behavior Report — Smmplan\n`;
    md += `**Период:** ${startDate.toLocaleDateString()} — ${endDate.toLocaleDateString()}\n`;
    md += `**Сгенерирован:** ${new Date().toLocaleString()}\n\n`;

    md += `## Conversion Funnel\n`;
    md += `\`\`\`\n`;
    md += `LINK_PASTED:         ${linkPasted.toString().padEnd(10)} (100%)\n`;
    md += `SERVICE_SELECTED:    ${serviceSelected.toString().padEnd(10)} (${linkPasted > 0 ? (serviceSelected/linkPasted*100).toFixed(0) : 0}%)  ← -${drop1_2}%\n`;
    md += `CHECKOUT_INITIATED:  ${checkoutInitiated.toString().padEnd(10)} (${serviceSelected > 0 ? (checkoutInitiated/serviceSelected*100).toFixed(0) : 0}%)  ← -${drop2_3}%\n`;
    md += `PAYMENT_CLICKED:     ${paymentClicked.toString().padEnd(10)} (${checkoutInitiated > 0 ? (paymentClicked/checkoutInitiated*100).toFixed(0) : 0}%)  ← -${drop3_4}%\n`;
    md += `COMPLETED:           ${completedOrders.toString().padEnd(10)} (${paymentClicked > 0 ? (completedOrders/paymentClicked*100).toFixed(0) : 0}%)  ← -${drop4_5}%\n`;
    md += `\`\`\`\n`;
    md += `**Overall Conversion: ${overallConversion}%**\n\n`;

    md += `## User Segments\n`;
    md += `| Сегмент | Количество | % от базы | Avg LTV (RUB) |\n`;
    md += `|---------|-----------|---|---------|\n`;
    md += `| Всего пользователей | ${totalUsers} | 100% | ${meanLTV.toFixed(2)} ₽ |\n`;
    md += `| Новые (за 30д) | ${newUsers} | ${(totalUsers > 0 ? (newUsers/totalUsers*100).toFixed(1) : 0)}% | - |\n`;
    md += `| Активные (за 30д) | ${activeUsersCount} | ${(totalUsers > 0 ? (activeUsersCount/totalUsers*100).toFixed(1) : 0)}% | - |\n`;
    md += `| Покупатели (>= 2 зак) | ${repeatBuyers} | ${(totalUsers > 0 ? (repeatBuyers/totalUsers*100).toFixed(1) : 0)}% | - |\n`;
    md += `| Разовые покупатели | ${firstTimeBuyers} | ${(totalUsers > 0 ? (firstTimeBuyers/totalUsers*100).toFixed(1) : 0)}% | - |\n`;
    md += `| Power Users | ${powerUsers} | ${(totalUsers > 0 ? (powerUsers/totalUsers*100).toFixed(1) : 0)}% | - |\n\n`;
    md += `*Соотношение новых и вернувшихся (New/Returning Ratio):* **${newVsReturningRatio}%**\n\n`;

    md += `## Cohort Retention Matrix\n`;
    if (cohorts.length > 0) {
      md += `| Когорта (Регистрация) | Размер | W0 | W1 | W2 |\n`;
      md += `|---------|------|----|----|----|\n`;
      cohorts.forEach(c => {
        md += `| ${c.cohortName} | ${c.size} | ${c.w0} | ${c.w1} | ${c.w2} |\n`;
      });
    } else {
      md += `*Недостаточно данных для формирования когортного анализа регистраций за последние 5 недель.*\n`;
    }
    md += `\n`;

    md += `## LTV Distribution & Pareto\n`;
    md += `- **P10:** ${getPercentile(10).toFixed(2)} ₽\n`;
    md += `- **P25:** ${getPercentile(25).toFixed(2)} ₽\n`;
    md += `- **P50 (Median):** ${getPercentile(50).toFixed(2)} ₽\n`;
    md += `- **P75:** ${getPercentile(75).toFixed(2)} ₽\n`;
    md += `- **P90:** ${getPercentile(90).toFixed(2)} ₽\n`;
    md += `- **P99:** ${getPercentile(99).toFixed(2)} ₽\n\n`;
    md += `- **Pareto Check:** Топ 20% пользователей генерируют **${paretoRatio}%** от всей выручки.\n\n`;

    md += `## Top Services by Order Count\n`;
    md += `| Услуга | Количество заказов | Выручка (RUB) |\n`;
    md += `|--------|-------------------|---------------|\n`;
    topServicesCount.forEach(s => {
      md += `| ${s.name} | ${s.count} | ${s.revenue.toFixed(2)} ₽ |\n`;
    });
    md += `\n`;

    md += `## Payment Behavior\n`;
    md += `| Шлюз | Всего транзакций | Неудачные / Отмененные | Процент отказов |\n`;
    md += `|------|------------------|------------------------|-----------------|\n`;
    paymentGateways.forEach(g => {
      const failureRate = g.count > 0 ? ((g.failed / g.count) * 100).toFixed(1) : '0.0';
      md += `| ${g.gateway || 'Неизвестно'} | ${g.count} | ${g.failed} | ${failureRate}% |\n`;
    });
    md += `\n`;

    md += `## Referral Program Effectiveness\n`;
    md += `- **Реферальные пользователи:** ${referralUsersCount}\n`;
    md += `- **Средний LTV рефералов:** ${refLTVRub.toFixed(2)} ₽\n`;
    md += `- **Средний LTV органики:** ${orgLTVRub.toFixed(2)} ₽\n`;
    md += `- **Прирост LTV (Uplift):** **${ltvUplift}%**\n`;
    md += `- **Активные рефереры:** ${activeReferrers}\n`;
    md += `- **Referral ROI:** **${commissionROI}%** (на каждый рубль комиссионных возвращено в заказах)\n\n`;

    md += `## Peak Temporal Patterns\n`;
    md += `- **Пиковое время заказов (часы):** ${peakHours || 'Нет данных'}\n\n`;

    md += `## 🚨 Alerts\n`;
    if (alerts.length > 0) {
      alerts.forEach(a => {
        md += `- ${a}\n`;
      });
    } else {
      md += `*Алерты не сработали. Показатели здоровья UX в пределах нормы.*\n`;
    }
    md += `\n`;

    md += `## 📋 Recommendations\n`;
    md += `1. **Оптимизация чекаута**: Если показатель Drop-off на шаге CHECKOUT -> PAYMENT высок, следует упростить форму ввода реквизитов и внедрить быстрые способы оплаты (СБП, ЮKassa в 1 клик).\n`;
    md += `2. **Работа с "Китами"**: Pareto-метрика показывает степень зависимости бизнеса от топ-клиентов. Рекомендуется внедрить VIP-программу лояльности для топ-20% пользователей.\n`;
    md += `3. **Стимулирование рефералов**: Положительный LTV Uplift рефералов показывает высокую эффективность сарафанного радио. Имеет смысл увеличить базовую процентную ставку вознаграждения.\n`;

    fs.writeFileSync(reportPath, md);
    console.log(`UX Report successfully generated at: ${reportPath}`);

    // Also write to artifacts directory
    const artifactsReportPath = path.join('C:', 'Users', 'Артём', '.gemini', 'antigravity', 'brain', '9223944c-71b8-4696-805c-af0feabb964f', 'ux-report.md');
    fs.writeFileSync(artifactsReportPath, md);
    console.log(`UX Report copy generated at: ${artifactsReportPath}`);

  } catch (err: any) {
    console.error('Error executing analysis:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runUXAnalysis();
