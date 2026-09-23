/**
 * OWASP Security Scanner for SMMplan (Next.js 16 / TypeScript / Prisma / API)
 * Ported and enhanced from mfkocalar/OWASP-Security-Skills.
 */

import fs from 'fs';
import path from 'path';

interface Finding {
  file: string;
  line: number;
  standard: string;
  pattern: string;
  excerpt: string;
  note: string;
}

const SKIP_DIRS = new Set([
  '.git', 'node_modules', '.next', 'dist', 'build', 'temp_owasp_skills', '.gemini', 'coverage', '.agents'
]);

const INCLUDED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.html', '.css'
]);

const PATTERNS: Array<{ id: string; standard: string; regex: RegExp; note: string }> = [
  // --- A04 Cryptographic Failures ---
  {
    id: 'hardcoded-openai-key',
    standard: 'Top10:A04',
    regex: /sk-[A-Za-z0-9]{20,}/,
    note: 'OpenAI-style secret key in source'
  },
  {
    id: 'hardcoded-aws-access-key',
    standard: 'Top10:A04',
    regex: /AKIA[0-9A-Z]{16}/,
    note: 'AWS access key ID in source'
  },
  {
    id: 'hardcoded-jwt-secret',
    standard: 'Top10:A04',
    regex: /(?:jwt_secret|JWT_SECRET)\s*[:=]\s*['"][^'"]{8,}['"]/,
    note: 'JWT secret assigned inline — must come from env/vault'
  },
  {
    id: 'md5-or-sha1-password',
    standard: 'Top10:A04',
    regex: /(?:md5|sha1)\s*\(\s*.*password/i,
    note: 'Password hashed with md5/sha1 — use bcrypt/argon2'
  },
  {
    id: 'tls-verify-disabled',
    standard: 'Top10:A04',
    regex: /verify\s*=\s*False|rejectUnauthorized\s*:\s*false/i,
    note: 'TLS certificate verification disabled'
  },

  // --- A05 Injection ---
  {
    id: 'sql-concat',
    standard: 'Top10:A05',
    regex: /(?:\$queryRawUnsafe|\$executeRawUnsafe)\s*\(\s*`[^`]*\$\{/,
    note: 'Unsafe raw SQL interpolation — use $queryRaw with parameterized template tag'
  },
  {
    id: 'innerhtml-assignment',
    standard: 'Top10:A05',
    regex: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html:\s*(?!['"][^'"]*['"])[a-zA-Z0-9_.$]/,
    note: 'dangerouslySetInnerHTML with dynamic variable — ensure input is sanitized'
  },
  {
    id: 'eval-call',
    standard: 'Top10:A05',
    regex: /(?<![A-Za-z0-9_])eval\s*\(/,
    note: 'eval() call is dangerous; avoid evaluating arbitrary strings'
  },

  // --- A01 Broken Access Control / SSRF ---
  {
    id: 'cors-wildcard-with-credentials',
    standard: 'Top10:A01',
    regex: /Access-Control-Allow-Origin['"]?\s*:\s*['"]\*['"].*Access-Control-Allow-Credentials['"]?\s*:\s*['"]true['"]/i,
    note: 'Wildcard CORS with credentials enabled'
  },

  // --- A07 Authentication Failures ---
  {
    id: 'jwt-decode-without-verify',
    standard: 'Top10:A07',
    regex: /(?:JSON\.parse\s*\(\s*Buffer\.from|atob)\s*\([^)]*token/i,
    note: 'JWT payload parsed without signature verification'
  },

  // --- LLM Security (OWASP Top 10 for LLM) ---
  {
    id: 'llm-exec-on-output',
    standard: 'LLM05',
    regex: /(?:exec|eval)\s*\([^)]*(?:response|completion|llm_out)/i,
    note: 'exec/eval directly on LLM output is unsafe'
  }
];

function scanFile(filePath: string): Finding[] {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 500_000) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const findings: Finding[] = [];

    for (const pat of PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (pat.regex.test(line)) {
          findings.push({
            file: filePath,
            line: i + 1,
            standard: pat.standard,
            pattern: pat.id,
            excerpt: line.trim().slice(0, 160),
            note: pat.note
          });
        }
      }
    }
    return findings;
  } catch {
    return [];
  }
}

function scanDir(dir: string, allFindings: Finding[] = []): Finding[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, allFindings);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (INCLUDED_EXTENSIONS.has(ext)) {
        const findings = scanFile(fullPath);
        allFindings.push(...findings);
      }
    }
  }
  return allFindings;
}

const rootDir = process.cwd();
console.log(`🛡️ Running OWASP Security Scanner on ${rootDir}...`);
const findings = scanDir(rootDir);

console.log(`\nScan finished. Total findings: ${findings.length}`);
if (findings.length > 0) {
  console.log('\n--- FINDINGS ---');
  for (const f of findings) {
    console.log(`[${f.standard}] ${f.pattern} in ${path.relative(rootDir, f.file)}:${f.line}`);
    console.log(`  > ${f.excerpt}`);
    console.log(`  Note: ${f.note}\n`);
  }
} else {
  console.log('✅ ZERO OWASP pattern violations found in project source code!');
}
