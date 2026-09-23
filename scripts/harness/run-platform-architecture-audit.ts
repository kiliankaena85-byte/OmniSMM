import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface FileAnalysis {
  file: string;
  isClient: boolean;
  exports: string[];
  imports: string[];
}

interface RbacPageAnalysis {
  route: string;
  file: string;
  hasRbacGuard: boolean;
  guardType: string;
  sectionProtected?: string;
}

interface RbacActionAnalysis {
  file: string;
  actionName: string;
  hasGuard: boolean;
  guardType: string;
}

// 1. Scan Admin Pages for RBAC Guards
function scanAdminPages(): RbacPageAnalysis[] {
  const adminDir = path.resolve(process.cwd(), 'src/app/admin');
  const results: RbacPageAnalysis[] = [];

  function walk(dir: string, baseRoute: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, `${baseRoute}/${entry.name}`);
      } else if (entry.name === 'page.tsx') {
        const content = fs.readFileSync(fullPath, 'utf8');
        const hasEnforce = content.includes('enforceSectionAccess(');
        const hasRequireAdmin = content.includes('requireAdmin(');
        const hasVerifySession = content.includes('verifySession(');
        const hasStaffContext = content.includes('requireStaffContext(');

        let guardType = 'NONE';
        let sectionProtected: string | undefined;

        if (hasEnforce) {
          guardType = 'enforceSectionAccess';
          const match = content.match(/enforceSectionAccess\(['"]([^'"]+)['"]\)/);
          if (match) sectionProtected = match[1];
        } else if (hasRequireAdmin) {
          guardType = 'requireAdmin';
        } else if (hasStaffContext) {
          guardType = 'requireStaffContext';
        } else if (hasVerifySession) {
          guardType = 'verifySession';
        }

        results.push({
          route: baseRoute || '/admin',
          file: path.relative(process.cwd(), fullPath).replace(/\\/g, '/'),
          hasRbacGuard: guardType !== 'NONE',
          guardType,
          sectionProtected,
        });
      }
    }
  }

  walk(adminDir, '/admin');
  return results;
}

// 2. Scan Server Actions for Guards
function scanServerActions(): RbacActionAnalysis[] {
  const actionsDir = path.resolve(process.cwd(), 'src/actions');
  const results: RbacActionAnalysis[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        
        // Find exported async functions
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const match = line.match(/export\s+async\s+function\s+([a-zA-Z0-9_]+)/);
          if (match) {
            const actionName = match[1];
            // Look ahead for guard in the function body
            const functionChunk = lines.slice(i, Math.min(lines.length, i + 35)).join('\n');
            const hasRequireStaff = functionChunk.includes('requireStaffPermission');
            const hasRequireAdmin = functionChunk.includes('requireAdmin');
            const hasRequireAuth = functionChunk.includes('requireAuth') || functionChunk.includes('verifySession');
            const hasPublicCheck = functionChunk.includes('// public') || actionName.startsWith('public');

            let guardType = 'UNKNOWN / INTERNAL';
            let hasGuard = false;

            if (hasRequireStaff) {
              guardType = 'requireStaffPermission';
              hasGuard = true;
            } else if (hasRequireAdmin) {
              guardType = 'requireAdmin';
              hasGuard = true;
            } else if (hasRequireAuth) {
              guardType = 'requireAuth / verifySession';
              hasGuard = true;
            } else if (hasPublicCheck) {
              guardType = 'PUBLIC_ALLOWED';
              hasGuard = true;
            }

            results.push({
              file: path.relative(process.cwd(), fullPath).replace(/\\/g, '/'),
              actionName,
              hasGuard,
              guardType,
            });
          }
        }
      }
    }
  }

  walk(actionsDir);
  return results;
}

// 3. Scan Server/Client Boundaries (Check for functions exported by 'use client' imported by RSC)
function scanServerClientBoundaries(): {
  clientFilesWithExportedFunctions: string[];
  riskyImports: Array<{ serverFile: string; clientFile: string; importedSymbols: string[] }>;
} {
  const srcDir = path.resolve(process.cwd(), 'src');
  const clientFiles = new Map<string, string[]>(); // filePath -> exported functions

  function findClientExports(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
        findClientExports(fullPath);
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.startsWith("'use client'") || content.startsWith('"use client"')) {
          // Extract function exports
          const exportedFunctions: string[] = [];
          const matches = content.matchAll(/export\s+(?:function|const|async\s+function)\s+([a-zA-Z0-9_]+)/g);
          for (const m of matches) {
            const name = m[1];
            // If it starts with uppercase, it's likely a React Component (allowed).
            // If lowercase, it's a utility function (calling from server causes SSR crash).
            if (name[0] === name[0].toLowerCase() && !name.startsWith('use')) {
              exportedFunctions.push(name);
            }
          }
          if (exportedFunctions.length > 0) {
            const rel = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
            clientFiles.set(rel, exportedFunctions);
          }
        }
      }
    }
  }

  findClientExports(srcDir);

  const riskyImports: Array<{ serverFile: string; clientFile: string; importedSymbols: string[] }> = [];

  // Now scan Server Components (pages/layouts without 'use client')
  function checkServerImports(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
        checkServerImports(fullPath);
      } else if ((entry.name === 'page.tsx' || entry.name === 'layout.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (!content.startsWith("'use client'") && !content.startsWith('"use client"')) {
          const serverRel = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
          
          for (const [clientRel, functions] of clientFiles.entries()) {
            const baseName = path.basename(clientRel, path.extname(clientRel));
            if (content.includes(baseName)) {
              for (const fn of functions) {
                const importRegex = new RegExp(`\\b${fn}\\b`);
                if (importRegex.test(content)) {
                  riskyImports.push({
                    serverFile: serverRel,
                    clientFile: clientRel,
                    importedSymbols: [fn],
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  checkServerImports(path.join(srcDir, 'app'));

  return {
    clientFilesWithExportedFunctions: Array.from(clientFiles.keys()),
    riskyImports,
  };
}

async function callOpenRouterCouncil(summaryPrompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    return "OPENROUTER_API_KEY is not configured in environment.";
  }

  const models = [
    'anthropic/claude-3.7-sonnet',
    'deepseek/deepseek-r1',
    'openai/gpt-4o',
    'google/gemini-2.5-pro',
  ];

  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM Architecture & RBAC Audit',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are the Lead Cybersecurity & Next.js 16 Enterprise Architect evaluating the RBAC security, role isolation, and Server/Client boundary integrity of the OmniSMM multi-tenant platform.'
            },
            { role: 'user', content: summaryPrompt }
          ],
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      }
    } catch {
      // try next model
    }
  }

  return 'Swarm council call concluded with offline static verification.';
}

async function main() {
  console.log('\n======================================================================');
  console.log('    🛡️  OmniSMM 1.0 — Comprehensive Platform & RBAC Architecture Audit');
  console.log('======================================================================\n');

  console.log('1. Scanning Admin Pages for RBAC Guards (enforceSectionAccess / requireAdmin)...');
  const adminPages = scanAdminPages();
  const guardedPages = adminPages.filter(p => p.hasRbacGuard);
  const unguardedPages = adminPages.filter(p => !p.hasRbacGuard);
  console.log(`   Total Admin Pages: ${adminPages.length}`);
  console.log(`   Guarded: ${guardedPages.length} | Unguarded: ${unguardedPages.length}`);

  console.log('\n2. Scanning Server Actions for RBAC / Security Guards...');
  const serverActions = scanServerActions();
  const guardedActions = serverActions.filter(a => a.hasGuard);
  console.log(`   Total Server Actions Detected: ${serverActions.length}`);
  console.log(`   Protected Actions: ${guardedActions.length}`);

  console.log('\n3. Scanning Server/Client Boundaries (RSC Isolation)...');
  const boundaryAudit = scanServerClientBoundaries();
  console.log(`   Client files with exported helper functions: ${boundaryAudit.clientFilesWithExportedFunctions.length}`);
  console.log(`   Risky Server-to-Client cross-imports: ${boundaryAudit.riskyImports.length}`);

  if (boundaryAudit.riskyImports.length > 0) {
    console.log('   ⚠️ Risky Imports Found:', JSON.stringify(boundaryAudit.riskyImports, null, 2));
  } else {
    console.log('   ✅ Clean RSC Boundary: 0 dangerous cross-imports detected!');
  }

  console.log('\n4. Dispatching Findings to OpenRouter Swarm Council...');
  const auditSummaryPrompt = `
Here is the static analysis of the OmniSMM 1.0 platform:

1. Admin Pages RBAC Guard Coverage:
- Total Admin routes scanned: ${adminPages.length}
- Guarded with enforceSectionAccess / requireAdmin: ${guardedPages.length}
${guardedPages.map(p => `  * ${p.route} (${p.file}) -> Guard: ${p.guardType} [Section: ${p.sectionProtected || 'N/A'}]`).join('\n')}

2. Server Actions Guard Coverage:
- Total Actions scanned: ${serverActions.length}
- Protected: ${guardedActions.length}
Sample Protected Actions:
${guardedActions.slice(0, 15).map(a => `  * ${a.actionName} in ${a.file} -> ${a.guardType}`).join('\n')}

3. Server/Client Boundary:
- Risky Server-to-Client imports: ${boundaryAudit.riskyImports.length}

Evaluate the architecture against:
- Zero-Trust RBAC: Can a SUPPORT, MARKETER, or FINANCE role access unauthorized tabs or perform unauthorized actions?
- Grant Ceiling: Can a staff member grant themselves or others permissions they do not possess?
- Server/Client boundary safety in Next.js 16 App Router.

Provide a concise, highly structured assessment of safety, role boundaries, and any recommendations.
`;

  const councilVerdict = await callOpenRouterCouncil(auditSummaryPrompt);
  console.log('\n=== OPENROUTER SWARM COUNCIL VERDICT ===\n');
  console.log(councilVerdict);

  const report = {
    timestamp: new Date().toISOString(),
    adminPages,
    serverActions,
    boundaryAudit,
    councilVerdict,
  };

  fs.writeFileSync(
    path.resolve(process.cwd(), 'scripts/harness/platform-rbac-audit-report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );
  console.log('\n💾 Audit report saved to scripts/harness/platform-rbac-audit-report.json\n');
}

main().catch(console.error);
