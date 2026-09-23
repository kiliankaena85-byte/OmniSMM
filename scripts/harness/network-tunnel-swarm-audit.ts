import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('\x1b[31m❌ Ошибка: OPENROUTER_API_KEY не найден в .env!\x1b[0m');
  process.exit(1);
}

async function callOpenRouterWithFallback(models: string[], systemPrompt: string, userPrompt: string): Promise<string> {
  let lastError: any = null;
  for (const model of models) {
    try {
      console.log(`   Trying model: ${model}...`);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'SMMplan Network Swarm Auditor'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`   ⚠️ Model ${model} returned ${res.status}: ${errText.slice(0, 120)}`);
        lastError = new Error(`OpenRouter API error (${res.status}): ${errText}`);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      if (content && content.trim().length > 20) {
        return content;
      }
    } catch (e: any) {
      console.warn(`   ⚠️ Model ${model} failed: ${e.message}`);
      lastError = e;
    }
  }
  throw lastError || new Error('All models in fallback pool failed');
}

async function runNetworkSwarmAudit() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('  🛡️ OPENROUTER ADVERSARIAL SWARM: NETWORK, TUNNELS & SERVER ACTIONS AUDIT');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  const proxyContent = fs.readFileSync('src/proxy.ts', 'utf-8');
  const nextConfigContent = fs.readFileSync('next.config.mjs', 'utf-8');

  const contextData = `
### Current next.config.mjs:
\`\`\`javascript
${nextConfigContent}
\`\`\`

### Current src/proxy.ts:
\`\`\`typescript
${proxyContent.slice(0, 3000)}
// ...
${proxyContent.slice(3000, 6000)}
// ...
${proxyContent.slice(6000)}
\`\`\`
`;

  // Round 1: Red Team Attack (Adversarial Critic)
  console.log('🔥 [ROUND 1] Red Team Adversarial Attack (GLM 5.2 / MiniMax M3)...');
  const redTeamSystem = `Ты — Principal Red Team Security & Infrastructure Adversary. Твоя задача — жестко атаковать предложенную сетевую архитектуру (Next.js 16 Server Actions CSRF + Reverse Proxy + Tunnels):
1. Найди сценарии, при которых Server Action ВСЕ РАВНО УПАДЕТ с 500 (Invalid Server Actions request).
   - Например: нестандартный порт (e.g. Origin: https://localhost:3000 vs x-forwarded-host: localhost),
   - Цепочки прокси (Cloudflare Edge -> Tailscale Funnel -> Nginx -> Docker),
   - Регистр букв в заголовках, IPv6 адреса,
   - Динамические безымянные туннели (e.g. Cloudflare Quick Tunnels без .trycloudflare.com, Bore, Pinggy, Serveo, Ngrok custom domains),
   - Мобильные клиенты, Telegram WebApp / MiniApp iframe, где Origin может быть 'null' или 'https://web.telegram.org'.
2. Найди уязвимости безопасности (Host Header Injection, SSRF, Bypass CORS/CSRF).
3. Сформулируй 3-5 конкретных сценариев отказа (Failure Scenarios) с техническими деталями.`;

  const redTeamAttack = await callOpenRouterWithFallback(
    [
      'z-ai/glm-5.2:free',
      'minimax/minimax-m3:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'thinkingmachines/inkling:free'
    ],
    redTeamSystem,
    `Проанализируй реализацию сетевой архитектуры:\n\n${contextData}`
  );

  console.log('\n--- RED TEAM AUDIT REPORT ---');
  console.log(redTeamAttack + '\n');

  // Round 2: Blue Team Defense & Hardening
  console.log('🛡️ [ROUND 2] Blue Team Verification & Hardening (MiniMax M3 / Nemotron 3 Ultra)...');
  const blueTeamSystem = `Ты — Blue Team Principal Systems Architect. Твоя задача:
1. Оценить каждый сценарий Red Team: что из этого реальный риск, а что теоретический edge-case.
2. Для каждого РЕАЛЬНОГО риска предложить конкретный, элегантный патч в \`src/proxy.ts\` и \`next.config.mjs\`.
3. Сохранить Zero-Trust безопасность без раздувания кодовой базы (No Overengineering).`;

  const blueTeamDefense = await callOpenRouterWithFallback(
    [
      'minimax/minimax-m3:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'z-ai/glm-5.2:free',
      'thinkingmachines/inkling:free'
    ],
    blueTeamSystem,
    `Архитектура:\n${contextData}\n\nКритика Red Team:\n${redTeamAttack}`
  );

  console.log('\n--- BLUE TEAM AUDIT REPORT ---');
  console.log(blueTeamDefense + '\n');

  // Round 3: CTO Arbiter Synthesis
  console.log('⚖️ [ROUND 3] CTO Arbiter Final Verdict & Patch Directives (Nemotron 3 Ultra / Inkling)...');
  const ctoSystem = `Ты — CTO Arbiter платформы OmniSMM 1.0. 
1. Оцени качество решения от 0 до 100%.
2. Вынеси вердикт: PASS, PASS_WITH_HARDENING, или BLOCK.
3. Составь список конкретных патчей P0/P1, которые нужно применить в кодовой базе прямо сейчас для 100% пуленепробиваемости.`;

  const ctoVerdict = await callOpenRouterWithFallback(
    [
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'thinkingmachines/inkling:free',
      'minimax/minimax-m3:free',
      'z-ai/glm-5.2:free'
    ],
    ctoSystem,
    `Архитектура:\n${contextData}\n\nRed Team Attack:\n${redTeamAttack}\n\nBlue Team Defense:\n${blueTeamDefense}`
  );

  console.log('\n════════════════════════════════════════════════════════════════════════════════');
  console.log('  👑 CTO ARBITER FINAL VERDICT');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');
  console.log(ctoVerdict);

  fs.writeFileSync('scripts/harness/network-tunnel-swarm-verdict.md', `# NETWORK TUNNEL SWARM AUDIT REPORT\n\n## Red Team Attack\n${redTeamAttack}\n\n## Blue Team Defense\n${blueTeamDefense}\n\n## CTO Verdict\n${ctoVerdict}`);
}

runNetworkSwarmAudit().catch(console.error);
