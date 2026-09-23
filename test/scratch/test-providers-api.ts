import { compileServiceMetrics, normalizeGeo } from './src/utils/translation-dictionary';
import fs from 'fs';

const PROVIDERS = [
    { name: 'Vexboost', url: 'https://vexboost.ru/api/v2/', key: process.env.PROVIDER_KEY_VEXBOOST || '' },
    { name: 'Soc-Rocket', url: 'https://soc-rocket.ru/api/v2/', key: process.env.PROVIDER_KEY_SOC_ROCKET || '' },
    { name: 'SmmPrime', url: 'https://smmprime.com/api/v2/', key: process.env.PROVIDER_KEY_SMMPRIME || '' },
    { name: 'Stream-Promotion', url: 'https://stream-promotion.ru/api/v2/', key: process.env.PROVIDER_KEY_STREAM_PROMOTION || '' },
    { name: 'Likedrom', url: 'https://likedrom.com/api/v2/', key: process.env.PROVIDER_KEY_LIKEDROM || '' },
    { name: 'SmmPanelUS', url: 'https://smmpanelus.com/api/v2/', key: process.env.PROVIDER_KEY_SMMPANELUS || '' },
    { name: 'Soc-Proof', url: 'https://soc-proof.su/api/v2/', key: process.env.PROVIDER_KEY_SOC_PROOF || '' },
    { name: 'Telegram.Shop', url: 'https://telegram.shop/api/v2/', key: process.env.PROVIDER_KEY_TELEGRAM_SHOP || '' }
];

let outputLog = "";
function log(msg: string) {
    console.log(msg);
    outputLog += msg + "\n";
}

async function testProviders() {
    log("=== ЗАПУСК ПРЯМОГО ТЕСТИРОВАНИЯ ПРОВАЙДЕРОВ ===\n");

    for (const p of PROVIDERS) {
        log(`📡 Провайдер: ${p.name}`);
        log(`🔗 URL: ${p.url}`);

        try {
            const formData = new URLSearchParams();
            formData.append('key', p.key);
            formData.append('action', 'services');

            const res = await fetch(p.url, {
                method: 'POST',
                body: formData.toString(),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                signal: AbortSignal.timeout(10000)
            });

            const services = await res.json();

            if (!Array.isArray(services)) {
                if (services.error) {
                    log(` ❌ Ошибка API: ${services.error}`);
                } else {
                    log(` ❌ Ошибка: API вернул не массив.`);
                }
                log("------------------------------------------\n");
                continue;
            }

            const total = services.length;
            let withDesc = 0;

            services.forEach(s => {
                if (s.desc || s.description) withDesc++;
            });

            log(` ✅ Успешно. Найдено услуг: ${total}`);
            log(` 📝 Из них с описанием (от провайдера): ${withDesc} (${total > 0 ? Math.round((withDesc/total)*100) : 0}%)`);

            // Тестируем Anti-Liar перевод на первой попавшейся услуге
            if (total > 0) {
                const sample = services[Math.floor(Math.random() * Math.min(total, 50))];
                const metrics = compileServiceMetrics(sample.name, parseFloat(sample.rate) || 0);
                const geoTagMatch = sample.name.match(/\[(.*?)\]/);
                let rawGeo = geoTagMatch ? geoTagMatch[1] : undefined;
                
                // Исправление бага маппинга: если тег содержит слова вроде "Non Drop" или цифры, это не гео-тег
                if (rawGeo && (rawGeo.toLowerCase().includes('drop') || /\d/.test(rawGeo) || rawGeo.length > 5)) {
                    rawGeo = undefined;
                }
                const geo = normalizeGeo(rawGeo);

                log(`\n 🧪 Тест Маппинга (Услуга #${sample.service}):`);
                log(`    [Оригинал] Название: ${sample.name}`);
                log(`    [Оригинал] Цена (в валюте провайдера): ${sample.rate}`);
                log(`    [Smmplan] Теги: ${metrics.translatedTags.join('. ')}`);
                log(`    [Smmplan] Гео: ${geo}`);
                log(`    [Smmplan] Итоговый Тариф: ${metrics.tier}`);
            }

            log("------------------------------------------\n");

        } catch (e: any) {
            log(` ❌ Ошибка сети: ${e.message}`);
            log("------------------------------------------\n");
        }
    }
    fs.writeFileSync('providers-test-output-utf8.txt', outputLog, 'utf8');
}

testProviders();
