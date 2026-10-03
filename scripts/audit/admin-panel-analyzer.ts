import fs from 'fs';
import path from 'path';

interface ButtonInfo {
  file: string;
  label: string;
  tag: string;
  hasOnClick: boolean;
  hasDisabled: boolean;
  actionCall?: string;
}

interface ModuleAudit {
  name: string;
  route: string;
  filesCount: number;
  buttons: ButtonInfo[];
  serverActions: string[];
  clientComponents: string[];
  serverComponents: string[];
  findings: string[];
}

function walkDir(dir: string): string[] {
  let results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function analyzeAdminPanel() {
  const adminDir = path.resolve(process.cwd(), 'src/app/admin');
  const files = walkDir(adminDir);

  const modulesMap = new Map<string, ModuleAudit>();

  const topLevelDirs = fs.readdirSync(adminDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const mod of topLevelDirs) {
    modulesMap.set(mod, {
      name: mod,
      route: `/admin/${mod}`,
      filesCount: 0,
      buttons: [],
      serverActions: [],
      clientComponents: [],
      serverComponents: [],
      findings: []
    });
  }

  // Also handle root files like /admin/layout.tsx
  modulesMap.set('root', {
    name: 'root',
    route: '/admin',
    filesCount: 0,
    buttons: [],
    serverActions: [],
    clientComponents: [],
    serverComponents: [],
    findings: []
  });

  for (const filePath of files) {
    const rel = path.relative(adminDir, filePath).replace(/\\/g, '/');
    const parts = rel.split('/');
    const modKey = parts.length > 1 ? parts[0] : 'root';
    const audit = modulesMap.get(modKey);
    if (!audit) continue;

    audit.filesCount++;
    const content = fs.readFileSync(filePath, 'utf-8');
    const isClient = content.includes('"use client"') || content.includes("'use client'");

    if (isClient) {
      audit.clientComponents.push(path.basename(filePath));
    } else {
      audit.serverComponents.push(path.basename(filePath));
    }

    // Extract action imports
    const actionImports = content.match(/import\s*\{([^}]+)\}\s*from\s*['"](@\/actions\/[^'"]+|\.\.?\/[^'"]*actions[^'"]*)['"]/g);
    if (actionImports) {
      for (const imp of actionImports) {
        const match = imp.match(/\{([^}]+)\}/);
        if (match) {
          const names = match[1].split(',').map(s => s.trim().replace(/^type\s+/, '')).filter(Boolean);
          for (const name of names) {
            if (!audit.serverActions.includes(name)) {
              audit.serverActions.push(name);
            }
          }
        }
      }
    }

    // Match Button components and html buttons
    const btnRegex = /<(Button|button|IconButton|DropdownItem)[^>]*?>([\s\S]*?)<\/\1>|<(Button|button|IconButton)[^>]*?\/>/g;
    let btnMatch;
    while ((btnMatch = btnRegex.exec(content)) !== null) {
      const fullTag = btnMatch[0];
      const innerText = (btnMatch[2] || '').replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim().replace(/\s+/g, ' ');
      
      const hasOnClick = /onClick\s*=/.test(fullTag);
      const hasDisabled = /disabled|isDisabled|isPending|isLoading/.test(fullTag);

      // Check action call
      let actionCall: string | undefined;
      const actMatch = fullTag.match(/onClick=\{[^}]*?(startTransition|handle[A-Za-z]+|[a-zA-Z]+Action)[^}]*?\}/);
      if (actMatch) {
        actionCall = actMatch[1];
      }

      audit.buttons.push({
        file: path.basename(filePath),
        label: innerText.slice(0, 40) || '(Icon/Dynamic)',
        tag: fullTag.slice(0, 80).replace(/\n/g, ' '),
        hasOnClick,
        hasDisabled,
        actionCall
      });
    }
  }

  console.log('================================================================');
  console.log('🏛️  ADMIN PANEL ATOMIC MODULE & BUTTON AUDIT REPORT (2026)');
  console.log('================================================================\n');

  let grandTotalButtons = 0;
  let totalWithDisabled = 0;

  for (const [name, mod] of modulesMap.entries()) {
    if (mod.filesCount === 0) continue;
    grandTotalButtons += mod.buttons.length;
    const withDisabled = mod.buttons.filter(b => b.hasDisabled).length;
    totalWithDisabled += withDisabled;

    console.log(`📦 [${name.toUpperCase()}] Route: ${mod.route}`);
    console.log(`   Files: ${mod.filesCount} (Client: ${mod.clientComponents.length}, Server: ${mod.serverComponents.length})`);
    console.log(`   Interactive Buttons: ${mod.buttons.length} (Protected with Pending/Disabled: ${withDisabled})`);
    console.log(`   Server Actions bound: ${mod.serverActions.length > 0 ? mod.serverActions.join(', ') : 'None (Read-only / local state)'}`);
    
    // Sample buttons
    const uniqueLabels = Array.from(new Set(mod.buttons.map(b => b.label).filter(l => l !== '(Icon/Dynamic)')));
    console.log(`   Button labels: ${uniqueLabels.slice(0, 8).join(' | ')}${uniqueLabels.length > 8 ? ` ... (+${uniqueLabels.length - 8} more)` : ''}`);
    console.log('----------------------------------------------------------------');
  }

  console.log(`\n📊 GRAND SUMMARY:`);
  console.log(`   Total Admin Modules: ${modulesMap.size}`);
  console.log(`   Total Interactive Buttons: ${grandTotalButtons}`);
  console.log(`   Buttons with Double-Click Protection / Pending: ${totalWithDisabled} (${Math.round((totalWithDisabled / grandTotalButtons) * 100)}%)`);
}

analyzeAdminPanel().catch(console.error);
