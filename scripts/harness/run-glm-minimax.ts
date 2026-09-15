import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function queryWithRetry(model: string, systemPrompt: string, userPrompt: string, maxRetries = 5): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Attempt ${attempt}/${maxRetries}] Querying ${model}...`);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM Pentest Swarm',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 2500
        })
      });

      if (res.status === 429) {
        console.warn(`[429 RateLimit] ${model} upstream busy, waiting ${attempt * 3}s...`);
        await new Promise(r => setTimeout(r, attempt * 3000));
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const json = await res.json();
      return json.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      console.warn(`Attempt ${attempt} error for ${model}:`, err.message);
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  return '';
}

async function main() {
  console.log('🚀 Running GLM-5.2 & MiniMax Dual Adversarial Pentest...');

  const proxyCode = fs.readFileSync('src/proxy.ts', 'utf8').slice(0, 3500);
  const sessionCode = fs.readFileSync('src/lib/session.ts', 'utf8').slice(0, 2500);
  const apiCode = fs.readFileSync('src/app/api/v2/route.ts', 'utf8').slice(0, 3000);
  const logoutCode = fs.readFileSync('src/app/api/auth/logout/route.ts', 'utf8');

  const context = `
PROJECT: OmniSMM 1.0 (SMMplan / SMMflux)
STACK: Next.js 16 App Router, React 19, TypeScript, PostgreSQL Prisma, Redis (ioredis), Cloudflare WAF/Turnstile.

SECURITY CONTEXT & UPDATED CODE:
1. PROXY MIDDLEWARE & PRODUCTION MAINTENANCE GATE (src/proxy.ts):
${proxyCode}

2. SESSION ENFORCEMENT & VERIFICATION (src/lib/session.ts):
${sessionCode}

3. Panel API V2 WITH TENANT BINDING (src/app/api/v2/route.ts):
${apiCode}

4. LOGOUT ROUTE WITH PHYSICAL DB SESSION DELETION (src/app/api/auth/logout/route.ts):
${logoutCode}
`;

  const pentestPrompt = `Conduct an exhaustive adversarial penetration test and security audit of the above code.
Specifically analyze:
1. Logout Session Invalidation: Does /api/auth/logout correctly delete the session in DB, and can a stolen JWT still access /dashboard?
2. Panel API /api/v2: Is the API key strictly bound to its host tenant? Can a key for smmplan.pro be used on smmflux.ru?
3. Production Maintenance Gate: On smmplan.pro, can an attacker bypass maintenance to access /login, /dashboard, or /api/v2?
4. Host Header & x-forwarded-host: Is there any remaining vulnerability to host header injection or cache poisoning?
5. Rate Limiting & Auth Brute Force: Are limits enforced in Redis?
6. Output a severity table (P0, P1, P2, P3, INFO) with your concrete findings and verdict.`;

  console.log('\n--- 1. Querying GLM-5.2 ---');
  let glmOutput = '';
  try {
    glmOutput = await queryWithRetry('z-ai/glm-5.2:free', 'You are an elite offensive security auditor.', context + '\n\n' + pentestPrompt);
    console.log('✅ GLM-5.2 response received (' + glmOutput.length + ' chars)');
  } catch (err: any) {
    console.error('Failed to get GLM-5.2:', err.message);
  }

  console.log('\n--- 2. Querying MiniMax ---');
  let minimaxOutput = '';
  try {
    minimaxOutput = await queryWithRetry('minimax/minimax-m3:free', 'You are a red team security specialist.', context + '\n\n' + pentestPrompt);
    console.log('✅ MiniMax response received (' + minimaxOutput.length + ' chars)');
  } catch (err: any) {
    console.error('Failed to get MiniMax:', err.message);
  }

  const finalOutput = `
# ADVERSARIAL PENTEST REPORT: GLM-5.2 & MINIMAX
Date: ${new Date().toISOString()}

## 🤖 1. GLM-5.2 RED TEAM AUDIT REPORT
${glmOutput || 'No response'}

---

## 🤖 2. MINIMAX RED TEAM AUDIT REPORT
${minimaxOutput || 'No response'}
`;

  fs.writeFileSync('scripts/harness/DUAL_PENTEST_GLM_MINIMAX_REPORT.md', finalOutput, 'utf8');
  console.log('\n🎉 [COMPLETE] Dual Pentest Report saved to scripts/harness/DUAL_PENTEST_GLM_MINIMAX_REPORT.md');
}

main().catch(console.error);
