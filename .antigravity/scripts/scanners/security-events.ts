import fs from 'fs';
import path from 'path';

export interface SecurityEventMatch {
  file: string;
  line: number;
  snippet: string;
  eventName?: string;
}

export interface SecurityEventScanResult {
  totalLoggedEventsCount: number;
  eventNames: string[];
  matches: SecurityEventMatch[];
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
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export function scanSecurityEvents(): SecurityEventScanResult {
  const srcDir = path.resolve(process.cwd(), 'src');
  const files = walkDir(srcDir);
  const matches: SecurityEventMatch[] = [];
  const eventNameSet = new Set<string>();

  for (const file of files) {
    const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      if (line.includes('securityEvent.create') || line.includes('SecurityEvent.')) {
        const lineNum = idx + 1;
        const block = lines.slice(idx, idx + 5).join(' ');
        const eventMatch = block.match(/event:\s*['"]([^'"]+)['"]/);
        const eventName = eventMatch ? eventMatch[1] : undefined;
        if (eventName) eventNameSet.add(eventName);

        matches.push({
          file: relPath,
          line: lineNum,
          snippet: line.trim(),
          eventName
        });
      }
    });
  }

  return {
    totalLoggedEventsCount: matches.length,
    eventNames: Array.from(eventNameSet),
    matches,
    timestamp: new Date().toISOString()
  };
}

if (require.main === module) {
  const result = scanSecurityEvents();
  const outDir = path.resolve(process.cwd(), '.antigravity/evidence/scanners');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'security-events.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
