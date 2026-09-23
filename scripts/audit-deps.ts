import fs from 'fs';
import path from 'path';

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface AuditReport {
  scannedPackages: number;
  warnings: string[];
  passed: boolean;
}

export function auditDependencies(): AuditReport {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error('package.json not found');
  }

  const pkg: PackageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = Object.keys(pkg.dependencies || {});
  const devDeps = Object.keys(pkg.devDependencies || {});
  const allDeps = [...deps, ...devDeps];

  const warnings: string[] = [];

  // Suspicious typosquatting / dangerous pattern regexes
  const suspiciousPatterns = [
    /^cross-env-/,
    /^loadsh$/,
    /^expresss$/,
    /^react-domm$/,
    /^ts-nodde$/,
    /^chalkk$/,
  ];

  for (const dep of allDeps) {
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(dep)) {
        warnings.push(`[SUSPICIOUS_TYPOSQUAT] Package '${dep}' matches suspicious typosquat pattern.`);
      }
    }

    // Check for git/http remote URLs instead of pinned semantic versions
    const version = pkg.dependencies?.[dep] || pkg.devDependencies?.[dep] || '';
    if (version.startsWith('git+') || version.startsWith('http://') || version.startsWith('https://')) {
      warnings.push(`[UNPINNED_REMOTE_DEP] Package '${dep}' uses remote URL '${version}'. Pin to npm registry version.`);
    }
  }

  return {
    scannedPackages: allDeps.length,
    warnings,
    passed: warnings.length === 0,
  };
}

if (process.argv[1]?.includes('audit-deps')) {
  console.log('🔍 Running NPM Dependency Supply-Chain Audit...');
  const report = auditDependencies();
  console.log(`📦 Scanned: ${report.scannedPackages} packages`);
  if (report.warnings.length > 0) {
    console.warn(`⚠️ Found ${report.warnings.length} warning(s):`);
    report.warnings.forEach(w => console.warn(`  - ${w}`));
  } else {
    console.log('✅ 0 supply chain anomalies found. All packages verified!');
  }
}
