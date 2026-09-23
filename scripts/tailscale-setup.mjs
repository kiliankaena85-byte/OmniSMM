import { execSync } from 'child_process';
import fs from 'fs';

console.log('⏳ Checking Tailscale login status...');

function isTailscaleLoggedIn() {
  try {
    const out = execSync('docker exec smmplan_tailscale tailscale status', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return !out.includes('Logged out');
  } catch (e) {
    return false;
  }
}

if (!isTailscaleLoggedIn()) {
  console.log('Waiting for user authorization at: https://login.tailscale.com/a/12470b35012f12');
  process.exit(1);
}

console.log('✅ Tailscale is logged in! Configuring Funnel...');

try {
  // Configure internal proxy to web:3000
  console.log('1. Setting up Serve to http://web:3000...');
  execSync('docker exec smmplan_tailscale tailscale serve --bg --https=443 http://web:3000', { stdio: 'inherit' });

  // Enable public Funnel
  console.log('2. Enabling Funnel on port 443...');
  execSync('docker exec smmplan_tailscale tailscale funnel --bg 443 on', { stdio: 'inherit' });

  // Get status
  const statusJson = execSync('docker exec smmplan_tailscale tailscale status --json', { encoding: 'utf8' });
  const status = JSON.parse(statusJson);
  const dnsName = status.Self.DNSName.replace(/\.$/, '');
  const funnelUrl = `https://${dnsName}`;

  console.log(`\n🎉 TAILSCALE FUNNEL IS LIVE: ${funnelUrl}\n`);

  fs.writeFileSync('TUNNEL_URL.txt', `${funnelUrl}\n# SMMplan Active Tailscale Funnel\n# Updated: ${new Date().toLocaleString('ru-RU')}\n`, 'utf8');
} catch (err) {
  console.error('Failed to configure Funnel:', err.message);
  process.exit(1);
}
