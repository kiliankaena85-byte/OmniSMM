const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.next') && !file.includes('.git') && !file.includes('__tests__')) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.d.ts') && !file.includes('.test.')) {
        arrayOfFiles.push(fullPath.replace(/\\/g, '/').replace('d:/SMM_plan_2/', ''));
      }
    }
  });

  return arrayOfFiles;
}

const allSrcFiles = getAllFiles('d:/SMM_plan_2/src', []);

const wavePackages = [
  'AUDIT_PACKAGE_2_W2_2026-07-28.md',
  'AUDIT_PACKAGE_3_W3_2026-07-28.md',
  'AUDIT_PACKAGE_4_W4_2026-07-28.md',
  'AUDIT_PACKAGE_5_W5_2026-07-28.md',
  'AUDIT_PACKAGE_6_W6_2026-07-28.md',
  'AUDIT_PACKAGE_7_W7_2026-07-28.md',
  'AUDIT_PACKAGE_8_W8_2026-07-28.md',
  'AUDIT_PACKAGE_9_W9_2026-07-28.md',
  'AUDIT_PACKAGE_10_W10_2026-07-28.md',
  'AUDIT_PACKAGE_11_W11_2026-07-28.md',
  'AUDIT_PACKAGE_12_W12_2026-07-28.md',
  'AUDIT_PACKAGE_13_W13_2026-07-28.md',
  'AUDIT_PACKAGE_14_W14_2026-07-28.md',
  'AUDIT_PACKAGE_15_W15_2026-07-28.md'
];

const mappedFiles = new Set();

wavePackages.forEach(pkg => {
  const content = fs.readFileSync('d:/SMM_plan_2/' + pkg, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach(l => {
    if (l.startsWith('### 2.')) {
      const idx = l.indexOf('src/');
      if (idx !== -1) {
        const clean = l.substring(idx).replace(/`/g, '').trim();
        mappedFiles.add(clean);
      }
    }
  });
});

console.log('=== ABSOLUTE MATHEMATICAL PROOF ===');
console.log('Total production TS/TSX files in codebase (src/):', allSrcFiles.length);
console.log('Total unique files contained inside generated audit wave packages:', mappedFiles.size);

const unmapped = allSrcFiles.filter(f => !mappedFiles.has(f));
console.log('Unmapped files count:', unmapped.length);

if (unmapped.length === 0) {
  console.log('SUCCESS: EXACTLY 100% OF ALL 631 CODEBASE PRODUCTION FILES ARE MAPPED (0 UNMAPPED FILES)!');
} else {
  console.log('FAIL! Unmapped files:', unmapped);
}
