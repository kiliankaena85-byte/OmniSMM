const fs = require('fs');
const path = require('path');

console.log('🔍 Scanning .next/ build artifacts for leaked secrets...');

const BUILD_DIRS = [
  path.join(process.cwd(), '.next/static'),
  path.join(process.cwd(), '.next/server'),
];

const existingDirs = BUILD_DIRS.filter(d => fs.existsSync(d));
if (existingDirs.length === 0) {
  console.log('⚠️ No .next build directories found, run npm run build first.');
  process.exit(0);
}

const FORBIDDEN_PATTERNS = [
  'smmplan_qa_sec',
  'smmplan_default_32_bytes',
  'StrongProdDbPassword2026',
  'test_Bz5e',
  'emrNjCPOuNMYKmMcxvHb532Xix99uAxM',
  '6833e1ceef531d34e7442d492b8e1021',
  'smmplan_provider_vault_key',
  'smmplan_privacy_salt',
  'ci-test-jwt-secret-min-32-characters-length-guaranteed',
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'ci-cron-secret-token'
];

const FORBIDDEN_REGEXES = [
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----(?:\\n|\n|\r\n|\s)[A-Za-z0-9+/=]{30,}/i,
  /ghp_[0-9a-zA-Z]{36}/,
  /xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}/,
  /AKIA[0-9A-Z]{16}/,
  /sk_live_[0-9a-zA-Z]{24,}/i,
  /rk_live_[0-9a-zA-Z]{24,}/i
];

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.json') || entry.name.endsWith('.html') || entry.name.endsWith('.map'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (content.includes(pattern)) {
          console.error(`❌ CRITICAL: Leaked secret string '${pattern}' found in ${fullPath}!`);
          process.exit(1);
        }
      }
      for (const regex of FORBIDDEN_REGEXES) {
        if (regex.test(content)) {
          console.error(`❌ CRITICAL: Leaked secret matching regex ${regex} found in ${fullPath}!`);
          process.exit(1);
        }
      }
    }
  }
}

for (const dir of existingDirs) {
  console.log(`🔍 Scanning ${dir}...`);
  scanDirectory(dir);
}
console.log('✅ PASS: No leaked secrets found in build artifacts!');
