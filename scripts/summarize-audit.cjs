const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('E:/omnismmcore/.planning/HYGIENE_DEAD_CODE_AUDIT.json', 'utf8'));

console.log('====================================================');
console.log('     OMNISMM CORE - CODE HYGIENE AUDIT RESULTS      ');
console.log('====================================================');
console.log(`Total TypeScript/TSX Files Scanned: ${data.totalFilesScanned}`);
console.log(`Total Unused Imports:                ${data.unusedImportsCount}`);
console.log(`Total Dead / Orphan Files:           ${data.deadFilesCount}`);
console.log(`  - True Orphans (0 refs anywhere):  ${data.orphanFilesCount}`);
console.log(`  - Test/Script-only Reachable:      ${data.testOnlyFilesCount}`);
console.log(`Unused Exported Symbols:             ${data.unusedExportsCount}`);
console.log(`Code Duplicate / Clone Blocks:       ${data.duplicatesCount}`);
console.log('----------------------------------------------------\n');

console.log('📌 TOP 10 FILES WITH MOST UNUSED IMPORTS:');
const counts = {};
data.unusedImports.forEach(i => { counts[i.file] = (counts[i.file] || 0) + 1; });
Object.entries(counts)
  .sort((a,b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([f, c], idx) => console.log(`  ${idx+1}. [${c} unused] ${f}`));

console.log('\n📌 SAMPLE UNUSED IMPORTS (FIRST 15):');
data.unusedImports.slice(0, 15).forEach((i, idx) => {
  console.log(`  ${idx+1}. ${i.file}:${i.line} -> '${i.symbol}' from '${i.moduleSpecifier}'`);
});

console.log('\n📌 SAMPLE TRUE ORPHAN FILES (0 imports repository-wide):');
data.deadFiles
  .filter(d => !d.isReferencedInTestsOnly)
  .slice(0, 15)
  .forEach((d, idx) => {
    console.log(`  ${idx+1}. ${d.file} (${d.linesCount} lines)`);
  });

console.log('\n📌 SAMPLE CODE DUPLICATES / CLONES:');
data.duplicates.slice(0, 5).forEach((d, idx) => {
  console.log(`\n--- Clone #${idx+1} (${d.lineCount} lines) ---`);
  console.log(`File A: ${d.fileA} (lines ${d.startLineA}-${d.endLineA})`);
  console.log(`File B: ${d.fileB} (lines ${d.startLineB}-${d.endLineB})`);
  console.log('Code sample:');
  console.log(d.sampleSnippet.split('\n').map(s => '  | ' + s).join('\n'));
});
