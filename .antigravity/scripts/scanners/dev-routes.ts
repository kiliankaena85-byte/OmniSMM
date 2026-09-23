import fs from 'fs';
import path from 'path';

export interface DevRouteMatch {
  route: string;
  hasProdGuard: boolean;
  fileContentSnippet: string;
}

export interface DevRoutesScanResult {
  routes: DevRouteMatch[];
  unprotectedCount: number;
  timestamp: string;
}

function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (file.endsWith('route.ts') || file.endsWith('route.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export function scanDevRoutes(): DevRoutesScanResult {
  const devApiDir = path.resolve(process.cwd(), 'src/app/api/dev');
  const files = walkDir(devApiDir);
  const routes: DevRouteMatch[] = [];

  for (const file of files) {
    const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const hasProdGuard = content.includes("process.env.NODE_ENV === 'production'") ||
                         content.includes('NODE_ENV === "production"') ||
                         content.includes("NODE_ENV === 'production'") ||
                         content.includes('isProduction');

    routes.push({
      route: relPath,
      hasProdGuard,
      fileContentSnippet: content.slice(0, 300)
    });
  }

  const unprotectedCount = routes.filter(r => !r.hasProdGuard).length;

  return {
    routes,
    unprotectedCount,
    timestamp: new Date().toISOString()
  };
}

if (require.main === module) {
  const result = scanDevRoutes();
  const outDir = path.resolve(process.cwd(), '.antigravity/evidence/scanners');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'dev-routes.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
