import { PrismaClient } from '@prisma/client';
import { providerService } from '../src/services/providers/provider.service';
import { redis } from '../src/lib/redis';

const prisma = new PrismaClient();

async function main() {
    const providers = await prisma.provider.findMany({ where: { isActive: true } });
    console.log(`Found ${providers.length} active providers.`);

    for (const provider of providers) {
        console.log(`\nSyncing provider: ${provider.name}...`);
        try {
            const instance = await providerService.getProviderInstance(provider);
            const services = await instance.getServices();
            
            console.log(`Fetched ${services.length} services from ${provider.name}`);
            
            // Validate basic structure
            if (!Array.isArray(services) || services.length === 0) {
                 console.log("No services or invalid format.");
                 continue;
            }

            const validServices = services.map((s: any) => ({
                id: String(s.service || s.id),
                name: s.name,
                type: s.type,
                category: s.category,
                rate: parseFloat(s.rate),
                min: parseInt(s.min, 10),
                max: parseInt(s.max, 10),
                dripfeed: s.dripfeed === true || s.dripfeed === '1',
                refill: s.refill === true || s.refill === '1',
                cancel: s.cancel === true || s.cancel === '1',
                desc: s.desc || s.description || ''
            })).filter((s: any) => s.id && s.name && !isNaN(s.rate));

            console.log(`Validated ${validServices.length} services.`);

            const cacheKey = `provider:${provider.id}:shadow_catalog`;
            await redis.set(cacheKey, JSON.stringify(validServices));
            
            // Update lastSync
            await prisma.provider.update({
                where: { id: provider.id },
                data: { lastSuccessAt: new Date() }
            });

            console.log(`✅ Cached ${validServices.length} to ${cacheKey}`);
        } catch (err: any) {
            console.error(`❌ Failed to sync ${provider.name}: ${err.message}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
