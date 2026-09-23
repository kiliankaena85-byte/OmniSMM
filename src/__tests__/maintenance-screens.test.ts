/**
 * @file maintenance-screens.test.ts
 * @description Verifies decoupling of MaintenanceScreen and PreLaunchHoldingScreen.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Storefront Locker Engine: Maintenance vs Pre-Launch Screens', () => {
  const maintenancePath = path.resolve(process.cwd(), 'src/components/ui/MaintenanceScreen.tsx');
  const preLaunchPath = path.resolve(process.cwd(), 'src/components/landing/PreLaunchHoldingScreen.tsx');
  const layoutPath = path.resolve(process.cwd(), 'src/app/layout.tsx');

  const maintenanceCode = fs.readFileSync(maintenancePath, 'utf-8');
  const preLaunchCode = fs.readFileSync(preLaunchPath, 'utf-8');
  const layoutCode = fs.readFileSync(layoutPath, 'utf-8');

  it('asserts MaintenanceScreen is a dedicated component decoupled from PreLaunch', () => {
    expect(maintenanceCode).not.contains("from '../landing/PreLaunchHoldingScreen'");
    expect(maintenanceCode).contains('ПЛАНОВЫЕ РЕГЛАМЕНТНЫЕ ТЕХРАБОТЫ');
    expect(maintenanceCode).contains('База данных');
    expect(maintenanceCode).contains('Очереди BullMQ');
    expect(maintenanceCode).contains('Дежурный инженер в Telegram');
    expect(maintenanceCode).contains('HTTP 503 Maintenance');
  });

  it('asserts PreLaunchHoldingScreen focuses on waitlist and early access', () => {
    expect(preLaunchCode).contains('/api/prelaunch/subscribe');
    expect(preLaunchCode).contains('152-ФЗ');
    expect(preLaunchCode).contains('Готовность платформы:');
  });

  it('verifies RootLayout renders MaintenanceScreen with Staff Bypass', () => {
    expect(layoutCode).contains('MaintenanceScreen');
    expect(layoutCode).contains("['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'].includes(user.role)");
    expect(layoutCode).match(/isTestDomain/);
  });
});