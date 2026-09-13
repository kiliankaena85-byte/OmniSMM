#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const targetProject = process.argv[2] || process.cwd();
console.log(`📦 Installing OmniSMM Architectural Skills into: ${targetProject}`);

const srcAgents = path.join(__dirname, '..', '.agents');
const srcRootAgentsMd = path.join(__dirname, '..', 'AGENTS.md');
const destAgents = path.join(targetProject, '.agents');
const destRootAgentsMd = path.join(targetProject, 'AGENTS.md');

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, item.name);
    const d = path.join(dest, item.name);
    if (item.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

copyRecursive(srcAgents, destAgents);
fs.copyFileSync(srcRootAgentsMd, destRootAgentsMd);

console.log('✅ OmniSMM Skills (.agents/skills) and AGENTS.md successfully installed!');
console.log('💡 Compatible with Google Antigravity, Cursor, Claude Code, Windsurf & Roo Code.');
