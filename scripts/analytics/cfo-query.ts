import { db } from '../../src/lib/db';

async function main() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. P&L (Profit & Loss)
  const validOrderStatuses = ['COMPLETED', 'PARTIAL', 'IN_PROGRESS'];
  const validOrders = await db.order.findMany({
    where: { status: { in: validOrderStatuses as any } },
    select: { charge: true, providerCost: true, userId: true },
  });

  const totalOrders = validOrders.length;
  const uniqueUsers = new Set(validOrders.map(o => o.userId)).size;

  const gmvCents = validOrders.reduce((sum, o) => sum + Number(o.charge), 0);
  const cogsCents = validOrders.reduce((sum, o) => sum + Number(o.providerCost), 0);
  const grossProfitCents = gmvCents - cogsCents;
  const grossMargin = gmvCents > 0 ? (grossProfitCents / gmvCents) * 100 : 0;

  const systemSettings = await db.systemSettings.findUnique({ where: { id: 'global' } });
  const taxRate = systemSettings?.taxRate || 6.0;
  const opexMonthlyCents = systemSettings?.opexMonthly || 0;
  const safetyFloor = systemSettings?.safetyFloor || 1.0;
  
  const taxCents = (gmvCents * taxRate) / 100;
  
  const paidCommissions = await db.commission.findMany({
    where: { status: 'PAID' },
    select: { amount: true },
  });
  const commissionDrainCents = paidCommissions.reduce((sum, c) => sum + Number(c.amount), 0);

  const netProfitCents = grossProfitCents - taxCents - opexMonthlyCents - commissionDrainCents;
  const netMargin = gmvCents > 0 ? (netProfitCents / gmvCents) * 100 : 0;

  // 2. Unit Economics
  const aovCents = totalOrders > 0 ? gmvCents / totalOrders : 0;
  const arpuCents = uniqueUsers > 0 ? gmvCents / uniqueUsers : 0;
  const ordersPerUser = uniqueUsers > 0 ? totalOrders / uniqueUsers : 0;

  const users = await db.user.findMany({
    select: { totalSpent: true },
    orderBy: { totalSpent: 'desc' }
  });
  const top10PercentCount = Math.max(1, Math.floor(users.length * 0.1));
  const topUsers = users.slice(0, top10PercentCount);
  const ltvTop10Cents = topUsers.reduce((sum, u) => sum + Number(u.totalSpent), 0) / top10PercentCount;

  // 3. Payment Flows
  const payments = await db.payment.findMany({
    select: { status: true, gateway: true, createdAt: true },
  });
  const totalPayments = payments.length;
  const successPayments = payments.filter(p => p.status === 'SUCCEEDED').length;
  const paymentSuccessRate = totalPayments > 0 ? (successPayments / totalPayments) * 100 : 0;

  const gateways: Record<string, number> = {};
  for (const p of payments) {
    if (!gateways[p.gateway]) gateways[p.gateway] = 0;
    gateways[p.gateway]++;
  }

  const abandonedPayments = payments.filter(p => p.status === 'PENDING' && p.createdAt < oneDayAgo).length;

  const refundEntries = await db.ledgerEntry.findMany({
    where: { amount: { lt: 0 } },
    select: { amount: true },
  });
  const refundVolumeCents = refundEntries.reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);
  const refundRate = gmvCents > 0 ? (refundVolumeCents / gmvCents) * 100 : 0;

  // 4. Risks
  const allServices = await db.service.findMany({
    select: { rate: true, markup: true, name: true, numericId: true, providerCurrency: true },
  });
  const lossMakingServices = allServices.filter(s => (s.rate * s.markup) < s.rate).length;
  const belowFloorServices = allServices.filter(s => s.markup < safetyFloor).length;
  const currencyExposureServices = allServices.filter(s => s.providerCurrency === 'USD').length;

  const promoOrders = await db.order.findMany({
    where: { discountCents: { gt: 0 } },
    select: { discountCents: true },
  });
  const promoCodeDrainCents = promoOrders.reduce((sum, o) => sum + Number(o.discountCents), 0);

  const agingReceivables = await db.order.count({
    where: { status: 'AWAITING_PAYMENT', createdAt: { lt: oneDayAgo } },
  });

  const report = {
    gmv: gmvCents / 100,
    cogs: cogsCents / 100,
    grossProfit: grossProfitCents / 100,
    grossMargin: grossMargin,
    tax: taxCents / 100,
    opex: opexMonthlyCents / 100,
    commissionDrain: commissionDrainCents / 100,
    netProfit: netProfitCents / 100,
    netMargin: netMargin,
    aov: aovCents / 100,
    arpu: arpuCents / 100,
    ordersPerUser,
    ltvTop10: ltvTop10Cents / 100,
    paymentSuccessRate,
    gatewaySplit: gateways,
    totalPayments,
    abandonedPayments,
    refundVolume: refundVolumeCents / 100,
    refundRate,
    lossMakingServices,
    belowFloorServices,
    currencyExposureServices,
    promoCodeDrain: promoCodeDrainCents / 100,
    agingReceivables
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
