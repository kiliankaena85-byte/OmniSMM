const { execSync } = require('child_process');
const myPid = process.pid;
const parentPid = process.ppid;
console.log('My PID:', myPid, 'Parent PID:', parentPid);

try {
  // Use tasklist to get processes on Windows
  const output = execSync('wmic process where "name=\'node.exe\'" get processid,commandline /format:csv', { encoding: 'utf8' });
  const lines = output.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    if (parts.length < 3) continue;
    const pidStr = parts[parts.length - 1].trim();
    const cmdLine = parts.slice(1, parts.length - 1).join(',');
    const pid = parseInt(pidStr, 10);
    if (isNaN(pid)) continue;
    if (pid === myPid || pid === parentPid) continue;
    
    // Kill processes running next, webpack, playwright, prisma, npm run build
    if (cmdLine.includes('next') || cmdLine.includes('webpack') || cmdLine.includes('playwright') || cmdLine.includes('prisma') || cmdLine.includes('build') || cmdLine.includes('start')) {
      console.log(`Killing process ${pid}: ${cmdLine.substring(0, 100)}...`);
      try {
        execSync(`taskkill /F /PID ${pid}`);
      } catch (err) {
        console.error(`Failed to kill ${pid}:`, err.message);
      }
    }
  }
} catch (e) {
  console.error('Error running script:', e.message);
}
