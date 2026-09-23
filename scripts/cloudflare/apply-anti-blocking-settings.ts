/**
 * Cloudflare Anti-Blocking & Edge Optimization Automation Script for SMMplan
 * Applies optimized settings for Russian ISPs (MGTS, MTS, Beeline, Rostelecom)
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';

async function cfRequest(endpoint: string, method: string = 'GET', body?: unknown) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json() as { success: boolean; result?: any; errors?: any[]; messages?: any[] };
  return json;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🛡️ Cloudflare Anti-Blocking Auto-Configuration (SMMplan)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Verify token
  console.log('1. [Verifying API Token Permissions]...');
  const verify = await cfRequest('/user/tokens/verify');
  if (!verify.success) {
    console.error('❌ Token verification failed:', JSON.stringify(verify.errors));
    return;
  }
  console.log('   ✅ Token status:', verify.result?.status, '| ID:', verify.result?.id);

  // 2. Fetch current settings
  console.log('\n2. [Fetching Current Zone Settings]...');
  const settingsRes = await cfRequest(`/zones/${ZONE_ID}/settings`);
  if (!settingsRes.success) {
    console.error('❌ Failed to fetch zone settings:', JSON.stringify(settingsRes.errors));
  } else {
    const settings = settingsRes.result as Array<{ id: string; value: any; editable?: boolean }>;
    const keySettings = ['ech', 'http3', '0rtt', 'ipv6', 'min_tls_version', 'tls_1_3', 'brotli', 'early_hints'];
    console.log('   Current values:');
    settings
      .filter(s => keySettings.includes(s.id))
      .forEach(s => console.log(`   - ${s.id.padEnd(18)}: ${JSON.stringify(s.value)}`));
  }

  // 3. Apply target anti-blocking settings
  const targetSettings: Array<{ setting: string; value: any; label: string }> = [
    { setting: 'ech', value: 'off', label: 'Disable ECH (Encrypted Client Hello) -> Prevents TSPU TLS reset' },
    { setting: 'http3', value: 'off', label: 'Disable HTTP/3 (QUIC) -> Prevents UDP 443 block on MGTS' },
    { setting: '0rtt', value: 'off', label: 'Disable 0-RTT Connection Resumption -> Eliminates TLS handshake anomaly' },
    { setting: 'ipv6', value: 'off', label: 'Disable IPv6 -> Eliminates AAAA/Happy-Eyeballs drop on MGTS GPON' },
    { setting: 'min_tls_version', value: '1.2', label: 'Ensure TLS 1.2 minimum standard' },
    { setting: 'tls_1_3', value: 'on', label: 'Enable TLS 1.3 standard cipher' },
    { setting: 'brotli', value: 'on', label: 'Enable Brotli compression' },
    { setting: 'early_hints', value: 'on', label: 'Enable Early Hints preloading' }
  ];

  console.log('\n3. [Applying Target Settings to Cloudflare Edge]...');
  for (const item of targetSettings) {
    try {
      const updateRes = await cfRequest(`/zones/${ZONE_ID}/settings/${item.setting}`, 'PATCH', { value: item.value });
      if (updateRes.success) {
        console.log(`   ✅ [${item.setting}] set to ${JSON.stringify(item.value)} -> ${item.label}`);
      } else {
        console.log(`   ⚠️ [${item.setting}] response: ${JSON.stringify(updateRes.errors || updateRes.messages)}`);
      }
    } catch (e: unknown) {
      console.log(`   ❌ [${item.setting}] error:`, e instanceof Error ? e.message : String(e));
    }
  }

  // 4. Verify updated settings
  console.log('\n4. [Verification of Updated Settings]...');
  const verifySettings = await cfRequest(`/zones/${ZONE_ID}/settings`);
  if (verifySettings.success) {
    const updated = verifySettings.result as Array<{ id: string; value: any }>;
    const keySettings = ['ech', 'http3', '0rtt', 'ipv6', 'min_tls_version', 'tls_1_3'];
    updated
      .filter(s => keySettings.includes(s.id))
      .forEach(s => console.log(`   ✨ ${s.id.padEnd(18)}: ${JSON.stringify(s.value)}`));
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  🎉 Cloudflare Edge successfully hardened for Russian ISPs!');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
