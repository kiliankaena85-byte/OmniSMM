import { execSync } from 'child_process';

function resolveBuildId(): string {
  let sha = process.env.GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_GIT_SHA || process.env.BUILD_ID || '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      sha = 'b6fd9610d';
    }
  }
  const timestamp = process.env.BUILD_TIMESTAMP || new Date().toISOString();
  return `v6-${sha}; ${timestamp}`;
}

export const BUILD_ID = resolveBuildId();
