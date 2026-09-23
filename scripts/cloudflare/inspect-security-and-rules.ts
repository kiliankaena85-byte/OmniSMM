/**
 * Inspect all Cloudflare Security, WAF, Bot and SSL settings for smmplan.pro
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';

async function cfGet(endpoint: string) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  return await res.json() as { success: boolean; result: any; errors?: any[] };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🔍 Cloudflare Zone Security & Firewall Audit (smmplan.pro)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. All Settings
  console.log('1. [Zone Security Settings]...');
  const settingsRes = await cfGet(`/zones/${ZONE_ID}/settings`);
  if (settingsRes.success) {
    const settings = settingsRes.result as Array<{ id: string; value: any }>;
    const interesting = [
      'security_level',
      'browser_integrity_check',
      'challenge_ttl',
      'ssl',
      'always_use_https',
      'waf',
      'security_header',
      'ip_geolocation',
      'server_side_excludes'
    ];
    for (const item of settings) {
      if (interesting.includes(item.id)) {
        console.log(`   - ${item.id.padEnd(26)}: ${JSON.stringify(item.value)}`);
      }
    }
  }

  // 2. Firewall / Custom Rules
  console.log('\n2. [Firewall & Custom WAF Rules]...');
  const rulesRes = await cfGet(`/zones/${ZONE_ID}/firewall/rules`);
  if (rulesRes.success) {
    console.log(`   Total Firewall Rules: ${rulesRes.result?.length || 0}`);
    for (const rule of rulesRes.result || []) {
      console.log(`   - [${rule.action}] ${rule.description} (paused: ${rule.paused})`);
    }
  } else {
    console.log('   Firewall query info:', JSON.stringify(rulesRes.errors || []));
  }

  // 3. Rulesets (Phase: http_request_firewall_custom)
  console.log('\n3. [Zone Rulesets & Filters]...');
  const rulesetsRes = await cfGet(`/zones/${ZONE_ID}/rulesets`);
  if (rulesetsRes.success) {
    for (const rs of rulesetsRes.result || []) {
      console.log(`   - Ruleset: "${rs.name}" | Phase: ${rs.phase} | Kind: ${rs.kind}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
}

main().catch(console.error);
