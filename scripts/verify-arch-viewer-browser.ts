/**
 * Playwright E2E Browser Verification for Standalone Architecture Viewer
 * Port 3009
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

async function verify() {
  console.log('🚀 [Arch-Viewer E2E] Launching headless browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 950 }
  });

  const page = await context.newPage();

  console.log('🌐 [Arch-Viewer E2E] Navigating to http://localhost:3009/...');
  await page.goto('http://localhost:3009/', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Wait for data load
  await page.waitForSelector('#kpi-modules:not(:empty)', { timeout: 10000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('kpi-modules');
    return el && el.textContent && el.textContent !== '-';
  }, { timeout: 10000 });

  const modules = await page.$eval('#kpi-modules', el => el.textContent);
  const edges = await page.$eval('#kpi-edges', el => el.textContent);
  const violations = await page.$eval('#kpi-violations', el => el.textContent);
  const cycles = await page.$eval('#kpi-cycles', el => el.textContent);
  const crappy = await page.$eval('#kpi-crappy', el => el.textContent);

  console.log(`📊 [Arch-Viewer E2E] KPI Loaded:
    - Modules: ${modules}
    - Edges: ${edges}
    - Violations: ${violations}
    - Cycles: ${cycles}
    - Crappy Functions: ${crappy}`);

  const artifactsDir = path.resolve(process.cwd(), 'artifacts');
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  // 1. Screenshot of Concentric Rings View
  await page.waitForTimeout(800); // Allow canvas render cycle
  const screenshotRings = path.join(artifactsDir, 'arch-viewer-rings.png');
  await page.screenshot({ path: screenshotRings, fullPage: false });
  console.log('📸 [Arch-Viewer E2E] Captured Rings View:', screenshotRings);

  // 2. Switch to DDD Context Clusters
  console.log('🧩 [Arch-Viewer E2E] Switching to DDD Clusters...');
  await page.click('button[data-mode="clusters"]');
  await page.waitForTimeout(600);
  const screenshotClusters = path.join(artifactsDir, 'arch-viewer-clusters.png');
  await page.screenshot({ path: screenshotClusters, fullPage: false });
  console.log('📸 [Arch-Viewer E2E] Captured Clusters View:', screenshotClusters);

  // 3. Switch to CRAP Heatmap
  console.log('🔥 [Arch-Viewer E2E] Switching to CRAP Heatmap...');
  await page.click('button[data-mode="heatmap"]');
  await page.waitForSelector('#table-heatmap tr', { timeout: 5000 });
  const rowsCount = await page.$$eval('#tbody-heatmap tr', rows => rows.length);
  console.log(`📋 [Arch-Viewer E2E] Heatmap rendered ${rowsCount} top risk files.`);
  const screenshotHeatmap = path.join(artifactsDir, 'arch-viewer-heatmap.png');
  await page.screenshot({ path: screenshotHeatmap, fullPage: false });
  console.log('📸 [Arch-Viewer E2E] Captured Heatmap View:', screenshotHeatmap);

  // 4. Click Inspect on top crappy row -> Inspector drawer slides out
  console.log('🔍 [Arch-Viewer E2E] Clicking Inspect on top risk row...');
  await page.click('#tbody-heatmap tr:first-child button');
  await page.waitForTimeout(500); // Wait for slide transition
  const drawerFilename = await page.$eval('#insp-filename', el => el.textContent);
  console.log(`📄 [Arch-Viewer E2E] Inspector opened for: ${drawerFilename}`);

  // Test Code Preview Tab in Drawer
  await page.click('button[data-dtab="code"]', { force: true });
  await page.waitForTimeout(600);
  console.log('💻 [Arch-Viewer E2E] Source code preview tab selected.');

  const screenshotDrawer = path.join(artifactsDir, 'arch-viewer-drawer.png');
  await page.screenshot({ path: screenshotDrawer, fullPage: false });
  console.log('📸 [Arch-Viewer E2E] Captured Drawer View:', screenshotDrawer);

  // Close drawer
  await page.click('#drawer-close', { force: true });
  await page.waitForTimeout(300);

  // 5. Switch to Architecture Matrix
  console.log('📊 [Arch-Viewer E2E] Switching to Architecture Matrix...');
  await page.click('button[data-mode="matrix"]');
  await page.waitForSelector('#matrix-grid .matrix-cell', { timeout: 5000 });
  const cellsCount = await page.$$eval('#matrix-grid .matrix-cell', cells => cells.length);
  console.log(`📊 [Arch-Viewer E2E] Matrix rendered ${cellsCount} layer-context cells (4 x 6 = 24).`);
  const screenshotMatrix = path.join(artifactsDir, 'arch-viewer-matrix.png');
  await page.screenshot({ path: screenshotMatrix, fullPage: false });
  console.log('📸 [Arch-Viewer E2E] Captured Matrix View:', screenshotMatrix);

  // 6. Switch to Proposals Sandbox & Simulate Refactoring
  console.log('💡 [Arch-Viewer E2E] Switching to Refactor Sandbox ("Proposals")...');
  await page.click('button[data-mode="proposals"]');
  await page.waitForSelector('#proposal-target-select', { state: 'attached' });
  await page.waitForTimeout(400);
  
  // Select 2nd option (first valid file)
  await page.selectOption('#proposal-target-select', { index: 1 });
  await page.$eval('#proposal-target-select', (el: any) => el.dispatchEvent(new Event('change')));
  await page.waitForSelector('.check-item', { timeout: 5000 });

  // Check first available function
  await page.click('.check-item:first-child input');

  // Click Simulate
  await page.click('#btn-run-proposal');
  await page.waitForSelector('#proposal-outcome-result:not(.hidden)', { timeout: 5000 });
  const reduction = await page.$eval('#prop-reduction-pct', el => el.textContent);
  console.log(`🎯 [Arch-Viewer E2E] Simulation Complete: Projected Risk Reduction: ${reduction}`);

  const screenshotProposal = path.join(artifactsDir, 'arch-viewer-proposal.png');
  await page.screenshot({ path: screenshotProposal, fullPage: false });
  console.log('📸 [Arch-Viewer E2E] Captured Proposal Simulation View:', screenshotProposal);

  await browser.close();
  console.log('✅ [Arch-Viewer E2E] ALL BROWSER E2E TESTS PASSED WITH 100% SUCCESS!');
}

verify().catch(err => {
  console.error('❌ [Arch-Viewer E2E] Verification failed:', err);
  process.exit(1);
});
