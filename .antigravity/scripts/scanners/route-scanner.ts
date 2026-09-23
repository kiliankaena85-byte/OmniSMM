import fs from 'fs';
import path from 'path';

export interface RouteScanResult {
  pages: string[];
  routes: string[];
  layouts: string[];
  middlewares: string[];
  cronRoutes: string[];
  webhookRoutes: string[];
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
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export function scanRoutes(): RouteScanResult {
  const srcDir = path.resolve(process.cwd(), 'src');
  const allFiles = walkDir(srcDir);

  const pages: string[] = [];
  const routes: string[] = [];
  const layouts: string[] = [];
  const middlewares: string[] = [];
  const cronRoutes: string[] = [];
  const webhookRoutes: string[] = [];

  for (const file of allFiles) {
    const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
    if (file.endsWith('page.tsx')) pages.push(relPath);
    else if (file.endsWith('route.ts')) {
      routes.push(relPath);
      if (relPath.includes('/cron/') || relPath.includes('cron')) cronRoutes.push(relPath);
      if (relPath.includes('/webhook') || relPath.includes('yookassa') || relPath.includes('robokassa') || relPath.includes('cryptobot')) {
        webhookRoutes.push(relPath);
      }
    } else if (file.endsWith('layout.tsx')) layouts.push(relPath);
    else if (file.includes('middleware.ts')) middlewares.push(relPath);
  }

  return {
    pages,
    routes,
    layouts,
    middlewares,
    cronRoutes,
    webhookRoutes,
    timestamp: new Date().toISOString()
  };
}

if (require.main === module) {
  const result = scanRoutes();
  const outDir = path.resolve(process.cwd(), '.antigravity/evidence/scanners');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'route-scanner.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
