import { db } from '@/lib/db';
import { sendAdminAlert } from '@/lib/notifications';
import { applyBeautifulRounding, SAFETY_FLOOR_MARKUP } from '@/lib/financial-constants';

export class QuarantineService {
    /**
     * Trigger A: High API Failure Rate (Immediate API Errors)
     * Tracks failures (timeouts, 500s) via Redis. >= 5 errors in 1h = Quarantine.
     */
    static async evaluateTriggerA(serviceId: string, errorDetails: string) {
        try {
            const errLower = (errorDetails || '').toLowerCase();
            // Distinguish user errors (private channel, invalid link) from provider/network errors (Private IP blocked, SSRF)
            const isSsrfOrNetwork = errLower.includes('private ip') ||
                                    errLower.includes('ssrf') ||
                                    errLower.includes('private network') ||
                                    errLower.includes('blocked url') ||
                                    errLower.includes('gateway');

            const isUserError = !isSsrfOrNetwork && (
                                errLower.includes('link') ||
                                errLower.includes('account is private') ||
                                errLower.includes('channel is private') ||
                                errLower.includes('profile is private') ||
                                errLower.includes('group is private') ||
                                (errLower.includes('private') && !errLower.includes('ip') && !errLower.includes('network') && !errLower.includes('host')) ||
                                errLower.includes('deleted') ||
                                errLower.includes('not found') ||
                                errLower.includes('invalid url') ||
                                errLower.includes('неверн') ||
                                errLower.includes('ссылк') ||
                                errLower.includes('закрыт'));

            if (isUserError) {
                // User-side errors do NOT increment provider quarantine counters
                return;
            }

            const { redis } = await import('@/lib/redis');
            if (!redis) return;

            const key = `quarantine:trigger_a:${serviceId}`;
            const fails = await redis.incr(key);
            
            if (fails === 1) {
                await redis.expire(key, 3600); // 1 hour window
            }

            if (fails >= 5) {
                const service = await db.service.findUnique({ where: { id: serviceId }, select: { id: true, name: true, cooldownUntil: true }});
                if (service && (!service.cooldownUntil || service.cooldownUntil < new Date())) {
                     const newCooldown = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h cooldown
                     await db.service.update({
                         where: { id: service.id },
                         data: { cooldownUntil: newCooldown, cooldownReason: 'HIGH_API_FAILURES' }
                     });
                     console.warn(`[ElasticQuarantine] Trigger A fired for Service ${service.id}. API Failures >= 5.`);
                     await sendAdminAlert(`🚨 [Quarantine] Услуга ${service.id} (${service.name}) ушла в карантин!\nПричина: Высокий уровень ошибок API (5+ сбоев за час).\nПоследняя ошибка: ${errorDetails}`);
                }
            }
        } catch (error) {
            console.error(`[QuarantineService] Failed to evaluate Trigger A for ${serviceId}:`, error);
        }
    }

    /**
     * Trigger B: Delayed Cancellation (Silent Failure)
     * Evaluates if a service should be quarantined based on recent cancellations.
     * Rule: In the last 12 hours of order creation, >= 5 CANCELED orders from >= 3 distinct users,
     * AND Cancel Rate > 30%.
     */
    static async evaluateTriggerB(serviceId: string) {
        try {
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

            // Fetch all orders for this service created in the last 12 hours
            const recentOrders = await db.order.findMany({
                where: {
                    serviceId,
                    createdAt: { gte: twelveHoursAgo }
                },
                select: { id: true, userId: true, status: true }
            });

            if (recentOrders.length === 0) return;

            const canceledOrders = recentOrders.filter(o => o.status === 'CANCELED');
            const totalOrdersCount = recentOrders.length;
            const canceledCount = canceledOrders.length;

            if (canceledCount >= 5) {
                const uniqueUsers = new Set(canceledOrders.map(o => o.userId));
                
                if (uniqueUsers.size >= 3) {
                    const cancelRate = canceledCount / totalOrdersCount;
                    
                    if (cancelRate > 0.3) {
                        // TRIGGER B ACTIVATED!
                        const service = await db.service.findUnique({ where: { id: serviceId } });
                        if (service && (!service.cooldownUntil || service.cooldownUntil < new Date())) {
                            // W6-6: Prevent spamming alerts: check Redis if we already alerted
                            const { redis } = await import('@/lib/redis');
                            if (redis) {
                                const alertKey = `alert:trigger_b:${service.id}`;
                                const alreadyAlerted = await redis.get(alertKey);
                                if (alreadyAlerted) return;
                                
                                // Set lock for 6 hours
                                await redis.set(alertKey, '1', 'EX', 6 * 60 * 60);
                            }
                            let cooldownHours = 0.5; // default 30 mins
                            if (service.cooldownReason === 'DELAYED_CANCEL_STRIKE_1') cooldownHours = 2;
                            else if (service.cooldownReason === 'DELAYED_CANCEL_STRIKE_2') cooldownHours = 12;

                            const newReason = cooldownHours === 0.5 ? 'DELAYED_CANCEL_STRIKE_1' : (cooldownHours === 2 ? 'DELAYED_CANCEL_STRIKE_2' : 'DELAYED_CANCEL_STRIKE_3');
                            const newCooldown = new Date(Date.now() + cooldownHours * 60 * 60 * 1000);

                            await db.service.update({
                                where: { id: service.id },
                                data: {
                                    cooldownUntil: newCooldown,
                                    cooldownReason: newReason
                                }
                            });

                            console.warn(`[ElasticQuarantine] Trigger B fired for Service ${service.id}. Cancel rate: ${(cancelRate*100).toFixed(1)}%. Cooldown until ${newCooldown.toISOString()}`);
                            await sendAdminAlert(`🚨 [Quarantine] Услуга ${service.id} ушла в карантин (Тихая отмена). Отмен за 12ч: ${canceledCount}/${totalOrdersCount} (${(cancelRate*100).toFixed(1)}%) от ${uniqueUsers.size} юзеров.`);
                        }
                    }
                }
            }

        } catch (error) {
            console.error(`[QuarantineService] Failed to evaluate Trigger B for ${serviceId}:`, error);
        }
    }

    /**
     * Trigger C: Stuck Orders (Ghosting)
     * 🟨 YELLOW ALERT ONLY: Sends Telegram notification if orders are piling up, but NO auto-quarantine.
     * Rule: >= 5 orders stuck in PENDING or IN_PROGRESS for more than 24 hours.
     */
    static async evaluateTriggerC() {
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            const stuckOrders = await db.order.groupBy({
                by: ['serviceId'],
                where: {
                    status: { in: ['PENDING', 'IN_PROGRESS'] },
                    createdAt: { lt: twentyFourHoursAgo }
                },
                _count: { id: true }
            });

            for (const group of stuckOrders) {
                if (group._count.id >= 5) {
                    const service = await db.service.findUnique({ where: { id: group.serviceId }, select: { id: true, name: true }});
                    if (service) {
                        // Prevent spamming alerts every 2 minutes: check Redis if we already alerted
                        const { redis } = await import('@/lib/redis');
                        if (redis) {
                            const alertKey = `alert:stuck_orders:${service.id}`;
                            const alreadyAlerted = await redis.get(alertKey);
                            if (alreadyAlerted) continue;
                            
                            // Set lock for 12 hours so we don't spam the admin
                            await redis.set(alertKey, '1', 'EX', 12 * 60 * 60);
                        }

                        console.warn(`[ElasticQuarantine] Trigger C fired for Service ${service.id}. Stuck orders: ${group._count.id}. (ALERT ONLY)`);
                        await sendAdminAlert(`🟨 [Очередь] Услуга ${service.id} (${service.name}) задерживается.\nВ очереди висят ${group._count.id} заказов более 24 часов.\nВозможно, у провайдера очередь. Автоотключение НЕ применялось.`);
                    }
                }
            }
        } catch (error) {
            console.error('[QuarantineService] Failed to evaluate Trigger C:', error);
        }
    }

    /**
     * Restore Expired Quarantines (Cron Job)
     * Automatically clears cooldownUntil for services whose backoff period has expired.
     */
    static async restoreExpiredQuarantines() {
        try {
            const expired = await db.service.findMany({
                where: {
                    cooldownUntil: { lt: new Date() }
                },
                select: { id: true, name: true }
            });

            if (expired.length === 0) return;

            const ids = expired.map(s => s.id);

            await db.service.updateMany({
                where: { id: { in: ids } },
                data: {
                    cooldownUntil: null
                    // Note: We deliberately leave cooldownReason intact so we remember what strike level they were at,
                    // allowing us to escalate properly (e.g. STRIKE_2 -> STRIKE_3) if they fail again.
                }
            });

            console.info(`[ElasticQuarantine] Restored ${expired.length} expired quarantined services: ${ids.join(', ')}`);
            await sendAdminAlert(`✅ [Quarantine] Карантин снят с ${expired.length} услуг. Они снова доступны для заказа.\n${expired.map(s => `- ${s.name}`).join('\n')}`, 'INFO');

        } catch (error) {
            console.error('[QuarantineService] Failed to restore expired quarantines:', error);
        }
    }

    /**
     * Trigger D: Elastic Price Spike Quarantine
     * If the new provider cost in USD has jumped by more than 20% compared to the existing saved cost,
     * automatically quarantine the service.
     */
    static shouldQuarantine(oldRate: number, newRate: number): boolean {
        if (oldRate <= 0) return false;
        return newRate > oldRate * 1.20;
    }

    /**
     * Loss Prevention: check if the calculated retail cost pricePerUnitRub is less than the purchase cost in rubles 
     * or breaches the strict SAFETY_FLOOR_MARKUP (retail < purchase * SAFETY_FLOOR_MARKUP).
     */
    static isLossBreach(newRate: number, markup: number, exchangeRate: number): boolean {
        const pricePer1kRub = newRate * markup * exchangeRate;
        const pricePer1kRubRounded = applyBeautifulRounding(pricePer1kRub);
        const pricePerUnitRub = pricePer1kRubRounded / 1000;
        const purchaseCostPerUnitRub = (newRate * exchangeRate) / 1000;
        
        // Strict guard: retail price must cover cost AND minimum SAFETY_FLOOR_MARKUP multiplier
        return pricePerUnitRub < (purchaseCostPerUnitRub * SAFETY_FLOOR_MARKUP);
    }
}

