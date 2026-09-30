/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Stitch Autonomous Loop Manager.
 * Orchestrates multi-screen progression with file-based baton handoff.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ScreenNode {
  id: string;
  route: string;
  title: string;
  status: 'PENDING' | 'GENERATING' | 'APPROVED' | 'REJECTED';
  screenFile?: string;
  componentFile?: string;
  layaScore?: number;
  promptRequirements: string;
}

export interface StitchWorkspaceManifest {
  projectId: string;
  brand: 'smmflux' | 'smmplan';
  designDna: string;
  viewport: 'desktop' | 'mobile' | 'tablet';
  status: 'INITIALIZING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  activeScreenIndex: number;
  screens: ScreenNode[];
}

export class StitchLoopManager {
  private workspaceDir: string;
  private manifestPath: string;
  private batonPath: string;

  constructor(workspaceDir: string = path.join(process.cwd(), '.stitch')) {
    this.workspaceDir = workspaceDir;
    this.manifestPath = path.join(this.workspaceDir, 'workspace.json');
    this.batonPath = path.join(this.workspaceDir, 'next-prompt.md');
    this.ensureWorkspace();
  }

  private ensureWorkspace(): void {
    if (!fs.existsSync(this.workspaceDir)) {
      fs.mkdirSync(this.workspaceDir, { recursive: true });
    }
    const screensDir = path.join(this.workspaceDir, 'screens');
    const compDir = path.join(this.workspaceDir, 'components');
    if (!fs.existsSync(screensDir)) fs.mkdirSync(screensDir, { recursive: true });
    if (!fs.existsSync(compDir)) fs.mkdirSync(compDir, { recursive: true });
  }

  public initWorkspace(manifest: StitchWorkspaceManifest): void {
    fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    if (manifest.screens[0]) {
      this.writeNextBaton(manifest.screens[0]);
    }
  }

  public loadWorkspace(): StitchWorkspaceManifest {
    if (!fs.existsSync(this.manifestPath)) {
      const defaultManifest: StitchWorkspaceManifest = {
        projectId: `proj-${Date.now()}`,
        brand: 'smmflux',
        designDna: 'High-Frequency Financial Terminal',
        viewport: 'desktop',
        status: 'INITIALIZING',
        activeScreenIndex: 0,
        screens: []
      };
      this.initWorkspace(defaultManifest);
      return defaultManifest;
    }
    return JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
  }

  public writeNextBaton(screen: ScreenNode): void {
    const batonContent = [
      `# Active Baton: ${screen.title} (${screen.id})`,
      `Target Route: ${screen.route}`,
      `Status: ${screen.status}`,
      '',
      '## Prompt Requirements',
      screen.promptRequirements,
      '',
      '## Token Contract Reference',
      'Inherit all color, typography, and radius rules from .stitch/DESIGN.md.'
    ].join('\n');
    fs.writeFileSync(this.batonPath, batonContent, 'utf-8');
  }

  public completeScreen(screenId: string, layaScore: number, screenMarkup: string): void {
    const manifest = this.loadWorkspace();
    let screen = manifest.screens.find((s) => s.id === screenId);
    if (!screen) {
      screen = {
        id: screenId,
        route: '/',
        title: screenId,
        status: 'GENERATING',
        promptRequirements: 'Auto-registered screen'
      };
      manifest.screens.push(screen);
    }

    screen.status = layaScore >= 80 ? 'APPROVED' : 'REJECTED';
    screen.layaScore = layaScore;
    const screenFileName = `${screen.id}.html`;
    fs.writeFileSync(path.join(this.workspaceDir, 'screens', screenFileName), screenMarkup, 'utf-8');
    screen.screenFile = screenFileName;

    const nextPending = manifest.screens.find((s) => s.status === 'PENDING');
    if (nextPending) {
      manifest.activeScreenIndex = manifest.screens.indexOf(nextPending);
      manifest.status = 'IN_PROGRESS';
      this.writeNextBaton(nextPending);
    } else {
      manifest.status = manifest.screens.every((s) => s.status === 'APPROVED') ? 'COMPLETED' : 'FAILED';
    }

    fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  public getSummary(): string {
    const manifest = this.loadWorkspace();
    const total = manifest.screens.length;
    const approved = manifest.screens.filter((s) => s.status === 'APPROVED').length;
    return `Stitch Loop: [${manifest.status}] ${approved}/${total} screens approved. Brand: ${manifest.brand}.`;
  }
}

if (process.argv[1]?.endsWith('stitch-loop-manager.ts')) {
  const manager = new StitchLoopManager();
  console.log('Stitch Loop Manager initialized.');
}
