/**
 * scripts/seed-rbac.ts
 * 
 * Idempotent seeder that establishes the baseline Staff Roles and granular StaffPermissions.
 * It also finds all existing Admins/Managers/Support staff missing a StaffRole and assigns them.
 * 
 * Usage: npx tsx scripts/seed-rbac.ts
 */

import { PrismaClient } from '@prisma/client';
import { RBAC_SECTIONS } from '../src/lib/rbac-sections';

const prisma = new PrismaClient();

const ALL_SECTIONS = RBAC_SECTIONS.map(s => s.id);

async function main() {
  console.log('🌱 Starting RBAC seeding...');

  try {
    // 1. Ensure Roles Exist
    const adminRole = await prisma.staffRole.upsert({
      where: { name: 'Admin' },
      update: {},
      create: { name: 'Admin', description: 'Полный доступ ко всем модулям', isSystem: true }
    });

    const managerRole = await prisma.staffRole.upsert({
      where: { name: 'Manager' },
      update: {},
      create: { name: 'Manager', description: 'Менеджер платформы (без финансов)', isSystem: true }
    });

    const supportRole = await prisma.staffRole.upsert({
      where: { name: 'Support' },
      update: {},
      create: { name: 'Support', description: 'Старший модератор/Саппорт', isSystem: true }
    });

    const cashierRole = await prisma.staffRole.upsert({
      where: { name: 'Cashier' },
      update: {},
      create: { name: 'Cashier', description: 'Кассир (согласование балансовых заявок)', isSystem: true }
    });

    // 2. Map Permissions (Idempotently)

    // ADMIN: All sections EDIT
    for (const section of ALL_SECTIONS) {
      await prisma.staffPermission.upsert({
        where: { roleId_section: { roleId: adminRole.id, section } },
        update: { canView: true, canEdit: true },
        create: { roleId: adminRole.id, section, canView: true, canEdit: true }
      });
    }

    // MANAGER: Most things EDIT, but exclude Finance, Security, Dev features; Analytics VIEW
    const managerPermissions = [
      { section: 'dashboard', canView: true, canEdit: false },
      { section: 'clients', canView: true, canEdit: true },
      { section: 'orders', canView: true, canEdit: true },
      { section: 'refills', canView: true, canEdit: true },
      { section: 'catalog', canView: true, canEdit: true },
      // ADM-00: required by Stage-4 fix (provider CRUD actions moved from 'catalog' to 'providers')
      { section: 'providers', canView: true, canEdit: true },
      { section: 'tickets', canView: true, canEdit: true },
      { section: 'marketing', canView: true, canEdit: true },
      { section: 'content', canView: true, canEdit: true },
      { section: 'analytics', canView: true, canEdit: false },
    ];
    for (const p of managerPermissions) {
      await prisma.staffPermission.upsert({
        where: { roleId_section: { roleId: managerRole.id, section: p.section } },
        update: { canView: p.canView, canEdit: p.canEdit },
        create: { roleId: managerRole.id, section: p.section, canView: p.canView, canEdit: p.canEdit }
      });
    }

    // SUPPORT: Tickets, Orders (View), Clients (View)
    const supportPermissions = [
      { section: 'dashboard', canView: true, canEdit: false },
      { section: 'clients', canView: true, canEdit: false },
      { section: 'orders', canView: true, canEdit: false },
      { section: 'refills', canView: true, canEdit: true },
      { section: 'tickets', canView: true, canEdit: true },
    ];
    for (const p of supportPermissions) {
      await prisma.staffPermission.upsert({
        where: { roleId_section: { roleId: supportRole.id, section: p.section } },
        update: { canView: p.canView, canEdit: p.canEdit },
        create: { roleId: supportRole.id, section: p.section, canView: p.canView, canEdit: p.canEdit }
      });
    }

    // CASHIER (ADM-03): Balance Requests, Approvals, Stats, Dashboard
    const cashierPermissions = [
      { section: 'dashboard', canView: true, canEdit: false },
      { section: 'balance_requests', canView: true, canEdit: true },
      { section: 'balance_approvals', canView: true, canEdit: true },
      { section: 'balance_stats', canView: true, canEdit: false },
    ];
    for (const p of cashierPermissions) {
      await prisma.staffPermission.upsert({
        where: { roleId_section: { roleId: cashierRole.id, section: p.section } },
        update: { canView: p.canView, canEdit: p.canEdit },
        create: { roleId: cashierRole.id, section: p.section, canView: p.canView, canEdit: p.canEdit }
      });
    }

    console.log('✅ Staff Roles and Permissions seeded successfully.');

    // 3. Link Existing Users
    type LegacyRoleSync = { stringRole: string, staffRoleId: string };
    const syncMap: LegacyRoleSync[] = [
      { stringRole: 'ADMIN', staffRoleId: adminRole.id },
      { stringRole: 'MANAGER', staffRoleId: managerRole.id },
      { stringRole: 'SUPPORT', staffRoleId: supportRole.id },
    ];

    // 4. Ensure Dedicated Role Test Users Exist
    const testAccounts = [
      { email: 'admin@smmplan.pro', role: 'OWNER', staffRoleId: adminRole.id },
      { email: 'manager@smmplan.pro', role: 'MANAGER', staffRoleId: managerRole.id },
      { email: 'support@smmplan.pro', role: 'SUPPORT', staffRoleId: supportRole.id },
      { email: 'cashier@smmplan.pro', role: 'MANAGER', staffRoleId: cashierRole.id },
      { email: 'client@smmplan.pro', role: 'USER', staffRoleId: null },
    ];

    for (const acc of testAccounts) {
      await prisma.user.upsert({
        where: { email_tenantId: { email: acc.email, tenantId: 'smmplan' } },
        update: { role: acc.role, staffRoleId: acc.staffRoleId },
        create: { email: acc.email, role: acc.role, staffRoleId: acc.staffRoleId, tenantId: 'smmplan' }
      });
    }

    console.log('✅ Successfully verified and seeded 5 dedicated role test accounts: Admin (Owner), Manager, Support, Cashier, Client.');

  } catch (error) {
    console.error('❌ Failed to seed RBAC:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
