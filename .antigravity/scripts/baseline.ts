import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface BaselineResult {
  commit: string;
  branch: string;
  gitLog: string;
  isCleanTree: boolean;
  dirtyFiles: string[];
  schemaSha256: string;
  schemaPath: string;
  packageVersions: Record<string, string>;
  timestamp: string;
  status?: string;
  error?: string;
}

const PLACEHOLDERS = ['...', 'placeholder', 'todo', 'uncommitted', 'unknown'];

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return PLACEHOLDERS.includes(value.trim().toLowerCase());
}

export function getBaselineEvidence(allowDirtyFlag: boolean = false): BaselineResult {
  // 1. Git Commit & Branch & Log
  let commit = '';
  let branch = '';
  let gitLog = '';
  let gitStatusOutput = '';

  try {
    commit = execSync('git rev-parse HEAD').toString().trim();
    branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    gitLog = execSync('git log -1 --oneline').toString().trim();
    gitStatusOutput = execSync('git status --porcelain').toString().trim();
  } catch (err) {
    console.error('Error executing git commands:', err);
    process.exit(1);
  }

  if (!commit || isPlaceholder(commit)) {
    console.error('ERROR: NO_COMMIT - Valid git commit is required');
    process.exit(1);
  }

  // 2. Parse Dirty Files
  const dirtyFiles = gitStatusOutput
    ? gitStatusOutput.split('\n').map(line => line.trim()).filter(Boolean)
    : [];
  const isCleanTree = dirtyFiles.length === 0;

  // 3. Schema Check
  const schemaPath = 'prisma/schema.prisma';
  const fullSchemaPath = path.resolve(process.cwd(), schemaPath);
  if (!fs.existsSync(fullSchemaPath)) {
    console.error('ERROR: SCHEMA_NOT_FOUND - prisma/schema.prisma does not exist');
    process.exit(1);
  }

  const schemaContent = fs.readFileSync(fullSchemaPath, 'utf8');
  const schemaSha256 = crypto.createHash('sha256').update(schemaContent).digest('hex');

  if (!schemaSha256 || isPlaceholder(schemaSha256)) {
    console.error('ERROR: SCHEMA_HASH_EMPTY - Schema SHA-256 computation returned empty or invalid hash');
    process.exit(1);
  }

  // 4. Package Versions
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const packageVersions: Record<string, string> = {};
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      ['next', 'react', 'prisma', '@prisma/client', 'typescript'].forEach(name => {
        if (deps[name]) {
          packageVersions[name] = deps[name];
        }
      });
    } catch {
      // Ignore package parsing errors
    }
  }

  // 5. Clean Tree Enforcement
  let status = 'CLEAN_BASELINE_VERIFIED';
  if (!isCleanTree) {
    if (!allowDirtyFlag) {
      console.error('ERROR: DIRTY_TREE_REJECTED - Working tree has uncommitted changes. Commit changes or pass --allow-dirty');
      console.error('Dirty files:', dirtyFiles);
      process.exit(1);
    } else {
      status = 'DIRTY_TREE_ALLOWED_WITH_WARNING';
    }
  }

  const result: BaselineResult = {
    commit,
    branch,
    gitLog,
    isCleanTree,
    dirtyFiles,
    schemaSha256,
    schemaPath,
    packageVersions,
    timestamp: new Date().toISOString(),
    status
  };

  return result;
}

if (require.main === module) {
  const allowDirty = process.argv.includes('--allow-dirty');
  const result = getBaselineEvidence(allowDirty);
  console.log('=== AEARH BASELINE EVIDENCE ===');
  console.log(JSON.stringify(result, null, 2));
}
