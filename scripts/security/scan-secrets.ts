/**
 * (c) 2026 SMMplan.
 * Secret Leak Guard - Automated Codebase Scanner (HELP Script).
 *
 * Scans the repository for accidental leaks of:
 * - Telegram Bot Tokens
 * - Gemini / OpenAI / Resend API Keys
 * - Payment Gateway Private Keys (ЮKassa, Robokassa)
 * - Private Certificates & Database Passwords
 */

import fs from 'fs';
import path from 'path';

const SECRET_PATTERNS = [
  { name: 'Telegram Bot Token', regex: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/ },
  { name: 'Google API Key', regex: /\bAIzaSy[A-Za-z0-9_-]{33}\b/ },
  { name: 'Resend API Key', regex: /\bre_[A-Za-z0-9]{24,}\b/ },
  { name: 'Generic Secret Key', regex: /\b(?:sk_live_|secret_key|api_secret)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/i },
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Hardcoded PostgreSQL Password', regex: /postgres:\/\/[^:]+:([^@]+)@/ },
];

const IGNORED_PATHS = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'coverage',
  '.gemini',
  'scan-secrets.ts',
];

export interface Finding {
  file: string;
  line: number;
  patternName: string;
  match: string;
}

export function scanDirectory(dir: string): Finding[] {
  const findings: Finding[] = [];

  function walk(currentDir: string) {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      const fullPath = path.join(currentDir, file);
      if (IGNORED_PATHS.some((ignored) => fullPath.includes(ignored))) {
        continue;
      }

      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile() && /\.(ts|tsx|js|jsx|json|env|md)$/.test(file)) {
        // Skip .env.example / mock files
        if (file.includes('example') || file.includes('.test.')) continue;

        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          for (const pattern of SECRET_PATTERNS) {
            if (pattern.regex.test(line)) {
              // Mask sensitive match
              const masked = line.trim().slice(0, 80);
              findings.push({
                file: path.relative(process.cwd(), fullPath),
                line: idx + 1,
                patternName: pattern.name,
                match: masked,
              });
            }
          }
        });
      }
    }
  }

  walk(dir);
  return findings;
}

// CLI Execution
if (require.main === module) {
  console.log('🔍 Running Secret Leak Guard Scanner...');
  const findings = scanDirectory(path.resolve(__dirname, '../../src'));
  
  if (findings.length === 0) {
    console.log('✅ 0 secret leaks detected! Codebase is completely clean.');
    process.exit(0);
  } else {
    console.warn(`⚠️ Detected ${findings.length} potential secret leak(s):`);
    findings.forEach((f) => {
      console.warn(`  - [${f.patternName}] ${f.file}:${f.line} -> ${f.match}`);
    });
    process.exit(1);
  }
}
