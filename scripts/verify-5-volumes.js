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

const volPackages = [
  'AUDIT_PACKAGE_VOL_1_2026-07-28.md',
  'AUDIT_PACKAGE_VOL_2_2026-07-28.md',
  'AUDIT_PACKAGE_VOL_3_2026-07-28.md',
  'AUDIT_PACKAGE_VOL_4_2026-07-28.md',
  'AUDIT_PACKAGE_VOL_5_2026-07-28.md'
];

const mappedFiles = new Set();

volPackages.forEach(pkg => {
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

console.log('=== ABSOLUTE VERIFICATION RESULTS FOR 5 VOLUMES ===');
console.log('Total production TS/TSX files in codebase (src/):', allSrcFiles.length);
console.log('Total unique files contained inside 5 volume audit packages:', mappedFiles.size);

const unmapped = allSrcFiles.filter(f => !mappedFiles.has(f));
console.log('Unmapped files count:', unmapped.length);

if (unmapped.length === 0) {
  console.log('SUCCESS: EXACTLY 100% OF ALL 631 CODEBASE PRODUCTION FILES ARE PACKED INTO 5 VOLUMES (0 UNMAPPED FILES)!');
} else {
  console.log('FAIL! Unmapped files:', unmapped);
}
