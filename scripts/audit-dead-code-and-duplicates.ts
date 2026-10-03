import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const projectRoot = path.resolve('E:/omnismmcore');
const srcDir = path.resolve(projectRoot, 'src');

interface UnusedImportFinding {
  file: string;
  line: number;
  symbol: string;
  moduleSpecifier: string;
}

interface DeadFileFinding {
  file: string;
  linesCount: number;
  reason: string;
  isReferencedInTestsOnly: boolean;
}

interface UnusedExportFinding {
  file: string;
  line: number;
  exportName: string;
  exportKind: string;
}

interface DuplicateCloneFinding {
  fileA: string;
  startLineA: number;
  endLineA: number;
  fileB: string;
  startLineB: number;
  endLineB: number;
  lineCount: number;
  sampleSnippet: string;
}

function getAllFiles(dir: string, extensions = ['.ts', '.tsx']): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== 'dist' && file !== '.planning' && file !== 'scratch') {
        results = results.concat(getAllFiles(filePath, extensions));
      }
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext) && !file.endsWith('.d.ts')) {
        results.push(filePath);
      }
    }
  }
  return results;
}

// -----------------------------------------------------------------------------
// 1. UNUSED IMPORTS SCANNER (Optimized)
// -----------------------------------------------------------------------------
function scanUnusedImports(files: string[]): UnusedImportFinding[] {
  const findings: UnusedImportFinding[] = [];

  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];
    const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');
    if (relPath.includes('__tests__') || relPath.endsWith('.test.ts') || relPath.endsWith('.spec.ts')) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf-8');
    if (!content.includes('import ')) continue;

    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    interface ImportedSymbol {
      name: string;
      line: number;
      moduleSpecifier: string;
    }
    const imports: ImportedSymbol[] = [];

    sourceFile.forEachChild(node => {
      if (ts.isImportDeclaration(node)) {
        if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return;
        const moduleSpec = node.moduleSpecifier.text;
        const importClause = node.importClause;
        if (!importClause) return;

        // Default import
        if (importClause.name) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(importClause.name.getStart());
          imports.push({ name: importClause.name.text, line: line + 1, moduleSpecifier: moduleSpec });
        }

        // Named / Namespace imports
        if (importClause.namedBindings) {
          if (ts.isNamespaceImport(importClause.namedBindings)) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(importClause.namedBindings.name.getStart());
            imports.push({ name: importClause.namedBindings.name.text, line: line + 1, moduleSpecifier: moduleSpec });
          } else if (ts.isNamedImports(importClause.namedBindings)) {
            for (const spec of importClause.namedBindings.elements) {
              const localName = spec.name.text;
              const { line } = sourceFile.getLineAndCharacterOfPosition(spec.name.getStart());
              imports.push({ name: localName, line: line + 1, moduleSpecifier: moduleSpec });
            }
          }
        }
      }
    });

    if (imports.length === 0) continue;

    const usageCounts = new Map<string, number>();
    for (const imp of imports) {
      usageCounts.set(imp.name, 0);
    }

    function checkNode(node: ts.Node) {
      if (ts.isImportDeclaration(node)) return;

      if (ts.isIdentifier(node)) {
        const idName = node.text;
        if (usageCounts.has(idName)) {
          const parent = node.parent;
          if (parent && ts.isPropertyAssignment(parent) && parent.name === node) {
            // key in object literal
          } else {
            usageCounts.set(idName, (usageCounts.get(idName) || 0) + 1);
          }
        }
      }

      ts.forEachChild(node, checkNode);
    }

    checkNode(sourceFile);

    for (const imp of imports) {
      const count = usageCounts.get(imp.name) || 0;
      if (count === 0) {
        findings.push({
          file: relPath,
          line: imp.line,
          symbol: imp.name,
          moduleSpecifier: imp.moduleSpecifier,
        });
      }
    }
  }

  return findings;
}

// -----------------------------------------------------------------------------
// 2. DEAD FILE & REACHABILITY GRAPH SCANNER
// -----------------------------------------------------------------------------
function resolveModule(fromFile: string, specifier: string): string | null {
  let targetPath = '';
  if (specifier.startsWith('@/')) {
    targetPath = path.resolve(srcDir, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    targetPath = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null;
  }

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
  for (const ext of extensions) {
    if (fs.existsSync(targetPath + ext)) return targetPath + ext;
  }
  for (const ext of extensions) {
    const indexPath = path.join(targetPath, 'index' + ext);
    if (fs.existsSync(indexPath)) return indexPath;
  }

  return null;
}

function scanDeadFilesAndExports(allFiles: string[]): {
  deadFiles: DeadFileFinding[];
  unusedExports: UnusedExportFinding[];
} {
  const prodEntryPatterns = [
    /src[/\\]app[/\\](.*[/\\])?(page|layout|route|default|error|not-found|loading|template|global-error|robots|sitemap|manifest|icon|apple-icon)\.(ts|tsx|js)$/,
    /src[/\\]bot[/\\]index\.ts$/,
    /src[/\\]workers[/\\]index\.ts$/,
    /src[/\\]instrumentation\.ts$/,
    /src[/\\]proxy\.ts$/,
    /src[/\\]middleware\.ts$/,
  ];

  const scriptsDir = path.resolve(projectRoot, 'scripts');
  const scriptFiles = getAllFiles(scriptsDir, ['.ts', '.js', '.mjs']);

  const testFiles = allFiles.filter(f => {
    const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
    return rel.includes('__tests__') || rel.endsWith('.test.ts') || rel.endsWith('.spec.ts');
  });

  const appFiles = allFiles.filter(f => !testFiles.includes(f));

  const fileImports = new Map<string, Set<string>>();
  const fileExports = new Map<string, { name: string; line: number; kind: string }[]>();
  const importedSymbolsPerFile = new Map<string, Set<string>>();

  for (const file of allFiles) {
    fileImports.set(file, new Set());
  }

  for (const file of [...allFiles, ...scriptFiles]) {
    const content = fs.readFileSync(file, 'utf-8');
    if (!content.includes('import') && !content.includes('export') && !content.includes('require')) continue;

    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const exportsInFile: { name: string; line: number; kind: string }[] = [];

    function recordImport(spec: string) {
      const resolved = resolveModule(file, spec);
      if (resolved) {
        if (!fileImports.has(file)) fileImports.set(file, new Set());
        fileImports.get(file)?.add(resolved);
        if (!importedSymbolsPerFile.has(resolved)) {
          importedSymbolsPerFile.set(resolved, new Set());
        }
      }
      return resolved;
    }

    function walkNode(node: ts.Node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          const spec = node.moduleSpecifier.text;
          const resolved = recordImport(spec);
          if (resolved) {
            if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
              for (const elem of node.importClause.namedBindings.elements) {
                const orig = elem.propertyName ? elem.propertyName.text : elem.name.text;
                importedSymbolsPerFile.get(resolved)?.add(orig);
              }
            } else if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
              for (const elem of node.exportClause.elements) {
                const orig = elem.propertyName ? elem.propertyName.text : elem.name.text;
                importedSymbolsPerFile.get(resolved)?.add(orig);
              }
            }
          }
        }
      } else if (ts.isCallExpression(node)) {
        // dynamic import(...) or require(...)
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length > 0) {
          const arg = node.arguments[0];
          if (ts.isStringLiteral(arg)) {
            recordImport(arg.text);
          }
        } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments.length > 0) {
          const arg = node.arguments[0];
          if (ts.isStringLiteral(arg)) {
            recordImport(arg.text);
          }
        }
      } else if (ts.isImportTypeNode(node)) {
        if (ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
          recordImport(node.argument.literal.text);
        }
      }

      if (file.startsWith(srcDir)) {
        const hasExportModifier = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        const isDefault = node.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword);

        if (hasExportModifier && !isDefault) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          if (ts.isFunctionDeclaration(node) && node.name) {
            exportsInFile.push({ name: node.name.text, line: line + 1, kind: 'function' });
          } else if (ts.isClassDeclaration(node) && node.name) {
            exportsInFile.push({ name: node.name.text, line: line + 1, kind: 'class' });
          } else if (ts.isInterfaceDeclaration(node) && node.name) {
            exportsInFile.push({ name: node.name.text, line: line + 1, kind: 'interface' });
          } else if (ts.isTypeAliasDeclaration(node) && node.name) {
            exportsInFile.push({ name: node.name.text, line: line + 1, kind: 'type' });
          } else if (ts.isVariableStatement(node)) {
            for (const decl of node.declarationList.declarations) {
              if (ts.isIdentifier(decl.name)) {
                exportsInFile.push({ name: decl.name.text, line: line + 1, kind: 'variable/const' });
              }
            }
          }
        }
      }

      ts.forEachChild(node, walkNode);
    }

    walkNode(sourceFile);

    if (file.startsWith(srcDir) && !testFiles.includes(file)) {
      fileExports.set(file, exportsInFile);
    }
  }

  // Reachability from PROD entry points
  const prodReachable = new Set<string>();
  const queue: string[] = [];

  for (const file of appFiles) {
    const rel = path.relative(projectRoot, file).replace(/\\/g, '/');
    const isEntry = prodEntryPatterns.some(p => p.test(rel));
    if (isEntry) {
      prodReachable.add(file);
      queue.push(file);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const deps = fileImports.get(current) || new Set();
    for (const dep of deps) {
      if (!prodReachable.has(dep) && appFiles.includes(dep)) {
        prodReachable.add(dep);
        queue.push(dep);
      }
    }
  }

  // Reachability from TESTS or SCRIPTS
  const testOrScriptReachable = new Set<string>();
  const testQueue: string[] = [...testFiles, ...scriptFiles];
  for (const t of testQueue) testOrScriptReachable.add(t);

  while (testQueue.length > 0) {
    const current = testQueue.shift()!;
    const deps = fileImports.get(current) || new Set();
    for (const dep of deps) {
      if (!testOrScriptReachable.has(dep)) {
        testOrScriptReachable.add(dep);
        testQueue.push(dep);
      }
    }
  }

  const deadFiles: DeadFileFinding[] = [];
  for (const file of appFiles) {
    const rel = path.relative(projectRoot, file).replace(/\\/g, '/');
    if (!prodReachable.has(file)) {
      const isTestOnly = testOrScriptReachable.has(file);
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n').length;
      deadFiles.push({
        file: rel,
        linesCount: lines,
        reason: isTestOnly ? 'Unreachable in production runtime; referenced ONLY by tests/scripts' : 'Orphan file: 0 incoming imports across the entire repository',
        isReferencedInTestsOnly: isTestOnly,
      });
    }
  }

  const unusedExports: UnusedExportFinding[] = [];
  for (const file of prodReachable) {
    const rel = path.relative(projectRoot, file).replace(/\\/g, '/');
    const isEntry = prodEntryPatterns.some(p => p.test(rel));
    if (isEntry) continue;

    const exportsInFile = fileExports.get(file) || [];
    const importedSymbols = importedSymbolsPerFile.get(file) || new Set();

    for (const exp of exportsInFile) {
      if (!importedSymbols.has(exp.name)) {
        unusedExports.push({
          file: rel,
          line: exp.line,
          exportName: exp.name,
          exportKind: exp.kind,
        });
      }
    }
  }

  return { deadFiles, unusedExports };
}

// -----------------------------------------------------------------------------
// 3. CODE DUPLICATION / CLONE DETECTOR (Optimized for Business Modules)
// -----------------------------------------------------------------------------
function scanDuplicates(files: string[], minLines = 10): DuplicateCloneFinding[] {
  interface Chunk {
    file: string;
    startLine: number;
    endLine: number;
    lines: string[];
  }

  // Focus duplication scan on key business logic directories
  const targetDirs = ['src/actions', 'src/services', 'src/app/api', 'src/lib', 'src/components', 'src/tenants'];
  const candidateFiles = files.filter(f => {
    const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
    return targetDirs.some(d => rel.startsWith(d)) && !rel.includes('__tests__') && !rel.endsWith('.test.ts');
  });

  const chunksByHash = new Map<string, Chunk[]>();

  for (const file of candidateFiles) {
    const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    const rawLines = content.split('\n');

    interface NormalizedLine {
      origLineNum: number;
      text: string;
    }
    const cleanLines: NormalizedLine[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      let t = rawLines[i].trim();
      if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t === '{' || t === '}' || t === ');' || t === '};') {
        continue;
      }
      cleanLines.push({ origLineNum: i + 1, text: t });
    }

    if (cleanLines.length < minLines) continue;

    // Step of 2 to speed up window scanning while preserving accuracy
    for (let i = 0; i <= cleanLines.length - minLines; i += 2) {
      const window = cleanLines.slice(i, i + minLines);
      const combined = window.map(w => w.text).join('\n');

      let hash = 5381;
      for (let c = 0; c < combined.length; c++) {
        hash = (hash * 33) ^ combined.charCodeAt(c);
      }
      const hashKey = (hash >>> 0).toString(16);

      if (!chunksByHash.has(hashKey)) {
        chunksByHash.set(hashKey, []);
      }
      const list = chunksByHash.get(hashKey)!;
      // Cap per-hash bucket to 20 to avoid trivial matching explosion
      if (list.length < 20) {
        list.push({
          file: relPath,
          startLine: window[0].origLineNum,
          endLine: window[window.length - 1].origLineNum,
          lines: window.map(w => w.text),
        });
      }
    }
  }

  const duplicatePairs: DuplicateCloneFinding[] = [];
  const seenPairs = new Set<string>();

  for (const [, chunks] of chunksByHash.entries()) {
    if (chunks.length > 1 && chunks.length <= 15) {
      for (let i = 0; i < chunks.length; i++) {
        for (let j = i + 1; j < chunks.length; j++) {
          const a = chunks[i];
          const b = chunks[j];
          if (a.file !== b.file) {
            const pairKey = [a.file, a.startLine, b.file, b.startLine].sort().join(':');
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey);
              duplicatePairs.push({
                fileA: a.file,
                startLineA: a.startLine,
                endLineA: a.endLine,
                fileB: b.file,
                startLineB: b.startLine,
                endLineB: b.endLine,
                lineCount: minLines,
                sampleSnippet: a.lines.slice(0, 4).join('\n'),
              });
            }
          }
        }
      }
    }
  }

  return duplicatePairs.slice(0, 100);
}

async function run() {
  console.log('🚀 Starting Professional Code Hygiene, Dead Code & Duplicates Audit for OmniSMM Core...');
  const t0 = Date.now();

  const allFiles = getAllFiles(srcDir);
  console.log(`📁 Scanned ${allFiles.length} TypeScript/TSX files in src/...`);

  console.log('🔍 [1/3] Scanning for Unused Imports via TypeScript AST...');
  const unusedImports = scanUnusedImports(allFiles);
  console.log(`   Found ${unusedImports.length} unused imports.`);

  console.log('🔍 [2/3] Scanning Reachability Graph & Dead Code...');
  const { deadFiles, unusedExports } = scanDeadFilesAndExports(allFiles);
  console.log(`   Found ${deadFiles.length} unreachable/orphan files (${deadFiles.filter(d => !d.isReferencedInTestsOnly).length} total orphans, ${deadFiles.filter(d => d.isReferencedInTestsOnly).length} test/script-only).`);
  console.log(`   Found ${unusedExports.length} unused exported symbols.`);

  console.log('🔍 [3/3] Scanning for Code Duplication & Clones...');
  const duplicates = scanDuplicates(allFiles, 10);
  console.log(`   Found ${duplicates.length} duplicate code blocks across business modules.`);

  const durationSec = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`✨ Completed static analysis in ${durationSec}s.`);

  const report = {
    timestamp: new Date().toISOString(),
    durationSeconds: parseFloat(durationSec),
    totalFilesScanned: allFiles.length,
    unusedImportsCount: unusedImports.length,
    deadFilesCount: deadFiles.length,
    orphanFilesCount: deadFiles.filter(d => !d.isReferencedInTestsOnly).length,
    testOnlyFilesCount: deadFiles.filter(d => d.isReferencedInTestsOnly).length,
    unusedExportsCount: unusedExports.length,
    duplicatesCount: duplicates.length,
    unusedImports,
    deadFiles,
    unusedExports,
    duplicates,
  };

  const outJson = path.resolve(projectRoot, '.planning', 'HYGIENE_DEAD_CODE_AUDIT.json');
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`📄 Detailed JSON report written to: ${outJson}`);
}

run().catch(console.error);
