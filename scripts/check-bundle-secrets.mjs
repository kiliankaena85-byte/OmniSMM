import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const STATIC_DIR = path.join(ROOT_DIR, '.next', 'static');
const DEV_API_DIR = path.join(ROOT_DIR, 'src', 'app', 'api', 'dev');

// ============================================================
// PATTERNS: Client Bundle Secrets (что не должно попасть в браузер)
// ============================================================
const BUNDLE_FORBIDDEN_PATTERNS = [
  { name: 'QA Secret Keyword', regex: /secret_qdocker/i },
  { name: 'Next Public QA Secret Token', regex: /NEXT_PUBLIC_QA_SECRET/i },
  { name: 'Dev Login API Route in Bundle', regex: /\/api\/dev\//i },
  { name: 'Stripe Live Secret Key', regex: /sk_live_[0-9a-zA-Z]{24,}/ },
  { name: 'Stripe Live Publishable Key', regex: /pk_live_[0-9a-zA-Z]{24,}/ },
  { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'RSA/EC Private Key Header', regex: /-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----/ },
];

// ============================================================
// PATTERNS: Source Scripts Secrets (что не должно быть в git)
// Урок C-02/C-03: скрипты вне dist/ тоже могут содержать секреты
// ============================================================
const SCRIPTS_FORBIDDEN_PATTERNS = [
  // Cloudflare Tunnel JWT: eyJ... (base64 JWT начинается с eyJ)
  { name: 'Cloudflare Tunnel JWT (hardcoded)', regex: /eyJ[A-Za-z0-9+/=]{40,}/ },
  // YooKassa live credentials
  { name: 'YooKassa Live Shop ID (hardcoded)', regex: /shopId\s*[:=]\s*["']?\d{6,}["']?/i },
  // Robokassa merchant passwords
  { name: 'Robokassa MrchPass (hardcoded)', regex: /[Mm]rch[Pp]ass\s*[:=]\s*["'][^$][^"']{6,}["']/ },
  // Generic API keys assigned to string literals (exclude known pentest/test fixtures with safe prefix)
  { name: 'Generic API key in assignment', regex: /(?:apiKey|api_key|apiSecret|api_secret)\s*[:=]\s*["'](?!pentest\d+_(?:b2b|api)_testkey_)[A-Za-z0-9_\-]{20,}["']/ },
  // AWS credentials
  { name: 'AWS Secret Access Key', regex: /(?:aws_secret|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["'][A-Za-z0-9/+=]{40}["']/ },
  // RSA/EC private keys
  { name: 'RSA/EC Private Key in script', regex: /-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----/ },
];

// Файлы/паттерны, которые ИСКЛЮЧАЕМ из сканирования скриптов (env.example — ОК)
const SCRIPTS_EXCLUDE_PATTERNS = [
  /\.env\.example/,
  /\.env\.test/,
  /check-bundle-secrets\.mjs/,
  /node_modules/,
  /\.next/,
  /dist\//,
];

// Расширения скриптов для сканирования
const SCRIPTS_EXTENSIONS = ['.ts', '.js', '.mjs', '.ps1', '.sh', '.bash'];

// Директории скриптов для сканирования
const SCRIPTS_SCAN_DIRS = ['scripts'];

function shouldExclude(filePath) {
  return SCRIPTS_EXCLUDE_PATTERNS.some(p => p.test(filePath));
}

export function runBundleSecretCheck(scanDir = STATIC_DIR) {
  console.log('🛡️  [CI-GATE] Scanning client bundles for leaked secrets and dev backdoors...');
  let violations = [];

  // 1. Check if src/app/api/dev exists in production filesystem
  if (fs.existsSync(DEV_API_DIR)) {
    violations.push({
      file: 'src/app/api/dev',
      error: 'CRITICAL: Dev API directory (src/app/api/dev) exists in production source tree!'
    });
  }

  // 2. Check if static directory exists
  if (!fs.existsSync(scanDir)) {
    console.warn("⚠️  Scan directory " + scanDir + " not found. Run npm run build first.");
    return { success: violations.length === 0, violations };
  }

  function scanRecursive(dir, patterns, extensions = null) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(ROOT_DIR, fullPath);

      if (shouldExclude(relPath)) continue;

      if (entry.isDirectory()) {
        scanRecursive(fullPath, patterns, extensions);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        const allowedExt = extensions
          ? extensions.includes(ext)
          : ['.js', '.css', '.json', '.txt'].includes(ext);

        if (allowedExt) {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const pattern of patterns) {
            if (pattern.regex.test(content)) {
              violations.push({
                file: relPath,
                pattern: pattern.name,
                regex: pattern.regex.toString()
              });
            }
          }
        }
      }
    }
  }

  // Phase 1: Client bundle scan
  scanRecursive(scanDir, BUNDLE_FORBIDDEN_PATTERNS);

  if (violations.length > 0) {
    console.error('❌ [CI-GATE FAILED] Leaked secrets or forbidden patterns detected in client bundles:');
    for (const v of violations) {
      console.error("   - " + v.file + ": " + (v.pattern || v.error));
    }
    return { success: false, violations };
  }

  console.log('✅ [CI-GATE PASSED] 0 forbidden secrets or dev routes found in client build artifacts.');
  return { success: true, violations: [] };
}

// ============================================================
// Phase 2: Scripts secret scan (NEW — Урок C-02/C-03)
// ============================================================
export function runScriptsSecretCheck() {
  console.log('🛡️  [CI-GATE] Scanning scripts/ for hardcoded secrets (lesson: C-02/C-03)...');
  let violations = [];

  for (const relDir of SCRIPTS_SCAN_DIRS) {
    const absDir = path.join(ROOT_DIR, relDir);
    if (!fs.existsSync(absDir)) continue;

    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name);
      if (!SCRIPTS_EXTENSIONS.includes(ext)) continue;

      const fullPath = path.join(absDir, entry.name);
      const relPath = path.relative(ROOT_DIR, fullPath);
      if (shouldExclude(relPath)) continue;

      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of SCRIPTS_FORBIDDEN_PATTERNS) {
        if (pattern.regex.test(content)) {
          violations.push({
            file: relPath,
            pattern: pattern.name,
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error('❌ [CI-GATE FAILED] Hardcoded secrets found in scripts/:');
    for (const v of violations) {
      console.error("   - " + v.file + ": " + v.pattern);
    }
    return { success: false, violations };
  }

  console.log('✅ [CI-GATE PASSED] 0 hardcoded secrets found in scripts/ directory.');
  return { success: true, violations: [] };
}

if (process.argv[1] && (process.argv[1].endsWith('check-bundle-secrets.mjs') || process.argv[1].includes('check-bundle-secrets'))) {
  const bundleResult = runBundleSecretCheck();
  const scriptsResult = runScriptsSecretCheck();

  if (!bundleResult.success || !scriptsResult.success) {
    process.exit(1);
  }
}
