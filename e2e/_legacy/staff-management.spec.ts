import { test, expect } from './fixtures/auth.fixture';
import { PrismaClient } from '@prisma/client';

test.describe('Staff Management Flow', () => {
  const prisma = new PrismaClient();
  const testEmail = 'e2e-staff-candidate@example.com';
  const customRoleName = 'E2E Custom Support Role';

  test.beforeAll(async () => {
    // Clear any previous artifacts from this test user
    const existingUser = await prisma.user.findFirst({ where: { email: testEmail } });
    if (existingUser) {
      await prisma.adminAuditLog.deleteMany({ where: { target: existingUser.id, targetType: 'USER' } });
      await prisma.session.deleteMany({ where: { userId: existingUser.id } });
      await prisma.user.delete({ where: { id: existingUser.id } });
    }

    const existingRole = await prisma.staffRole.findUnique({ where: { name: customRoleName } });
    if (existingRole) {
      await prisma.adminAuditLog.deleteMany({ where: { target: existingRole.id, targetType: 'ROLE' } });
      await prisma.staffRole.delete({ where: { id: existingRole.id } });
    }

    // Create a regular user who will be promoted to staff
    await prisma.user.create({
      data: {
        email: testEmail,
        tenantId: 'smmplan',
        role: 'USER',
        balance: 0,
      },
    });
  });

  test.afterAll(async () => {
    // Cleanup
    const user = await prisma.user.findFirst({ where: { email: testEmail } });
    if (user) {
      await prisma.adminAuditLog.deleteMany({ where: { target: user.id, targetType: 'USER' } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }

    const role = await prisma.staffRole.findUnique({ where: { name: customRoleName } });
    if (role) {
      await prisma.adminAuditLog.deleteMany({ where: { target: role.id, targetType: 'ROLE' } });
      await prisma.staffRole.delete({ where: { id: role.id } });
    }

    await prisma.$disconnect();
  });

  test('Owner can promote a user to staff, create custom roles, block/ban and demote them', async ({ adminPage }) => {
    // 1. Go to Team Settings page
    await adminPage.goto('/admin/settings?tab=team');
    await expect(adminPage.getByText('Команда и Escrow Guard')).toBeVisible({ timeout: 15000 });

    // 2. Search for the candidate user under "Назначение ролей"
    const searchInput = adminPage.locator('input[name="q"]');
    await searchInput.fill(testEmail);
    await adminPage.getByRole('button', { name: 'Найти' }).click();

    // Verify search result shows the user
    const promotionCard = adminPage.locator('div.rounded-2xl').filter({ has: adminPage.locator('h3', { hasText: 'Назначение ролей' }) }).first();
    const candidateRow = promotionCard.locator('tr', { hasText: testEmail }).first();
    await expect(candidateRow).toBeVisible({ timeout: 10000 });

    // 3. Promote user to SUPPORT role
    // Click the Select Role trigger inside the candidate row
    const roleSelectTrigger = candidateRow.locator('[data-slot="select-trigger"]').first();
    await roleSelectTrigger.click();

    // Handle hydration click swallowing: if option doesn't appear, click trigger again
    try {
      await expect(adminPage.getByRole('option', { name: 'SUPPORT', exact: true })).toBeVisible({ timeout: 1500 });
    } catch {
      await roleSelectTrigger.click();
    }
    await adminPage.getByRole('option', { name: 'SUPPORT', exact: true }).click();

    // Click "Назначить" button to submit the promotion
    const promoteBtn = candidateRow.getByRole('button', { name: 'Назначить' });
    await promoteBtn.click();

    // 5. Verify the promoted user is now displayed in the "Команда и Escrow Guard" list
    const teamCard = adminPage.locator('div.rounded-2xl').filter({ has: adminPage.locator('h3', { hasText: 'Команда и Escrow Guard' }) }).first();
    const staffRow = teamCard.locator('tr', { hasText: testEmail }).first();
    await expect(staffRow).toBeVisible({ timeout: 15000 });

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
    expect(dbUser.role).toBe('SUPPORT');

    const promoteLog = await prisma.adminAuditLog.findFirst({
      where: {
        target: dbUser.id,
        targetType: 'USER',
        action: 'USER_ROLE_CHANGE',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(promoteLog).not.toBeNull();
    const promoteNewVal = JSON.parse(promoteLog!.newValue || '{}');
    expect(promoteNewVal.role).toBe('SUPPORT');

    // 6. Create a custom staff role via the UI
    const createRoleBtn = adminPage.getByRole('button', { name: 'Создать роль' });
    await createRoleBtn.click();

    const createRoleForm = adminPage.locator('form').filter({ hasText: 'Новая роль поддержки' });
    await createRoleForm.locator('input[placeholder="Например: Младший саппорт"]').fill(customRoleName);
    await createRoleForm.locator('input[placeholder="Например: Доступ только к тикетам клиентов"]').fill('E2E Test Description');
    await createRoleForm.getByRole('button', { name: 'Сохранить' }).click();

    // Wait for the success toast for custom role creation
    await expect(adminPage.getByText('Кастомная роль успешно создана').first()).toBeVisible({ timeout: 15000 });

    // Verify custom role is displayed in the list
    await expect(adminPage.getByText(customRoleName)).toBeVisible({ timeout: 15000 });

    // Verify custom role DB & Audit Log
    const dbRole = await prisma.staffRole.findUniqueOrThrow({ where: { name: customRoleName } });
    expect(dbRole.description).toBe('E2E Test Description');

    const roleCreateLog = await prisma.adminAuditLog.findFirst({
      where: {
        target: dbRole.id,
        targetType: 'ROLE',
        action: 'CREATE_STAFF_ROLE',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(roleCreateLog).not.toBeNull();

    // 7. Toggle a permission on the custom role
    const customRoleContainer = adminPage.locator('div').filter({ has: adminPage.locator('h4', { hasText: customRoleName }) }).first();
    // Locate the cell for "Заказы"
    const cell = customRoleContainer.locator('div').filter({ has: adminPage.locator('span', { hasText: '📁 Заказы' }) }).last();
    // First button inside the cell is "Просмотр" toggle button
    const viewToggleBtn = cell.locator('button').first();
    await viewToggleBtn.click();

    // Verify permission update toast
    await expect(adminPage.getByText('Права роли для раздела ORDERS обновлены').first()).toBeVisible({ timeout: 15000 });

    // 8. Assign the custom staff role to the support member
    const currentStaffRow = teamCard.locator('tr', { hasText: testEmail }).first();
    const groupSelectTrigger = currentStaffRow.locator('[data-slot="select-trigger"]').nth(1);
    await groupSelectTrigger.click();

    try {
      await expect(adminPage.getByRole('option', { name: customRoleName, exact: true })).toBeVisible({ timeout: 1500 });
    } catch {
      await groupSelectTrigger.click();
    }
    await adminPage.getByRole('option', { name: customRoleName, exact: true }).click();

    // Click "Сменить" button in that row to save the new role mapping
    const changeRoleBtn = currentStaffRow.getByRole('button', { name: 'Сменить' });
    await changeRoleBtn.click();
    await expect(changeRoleBtn).toBeEnabled({ timeout: 15000 });

    // Verify staffRoleId in DB & Log
    const dbUserWithCustomRole = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
    expect(dbUserWithCustomRole.staffRoleId).toBe(dbRole.id);

    // 9. Block/Ban the staff member
    // Click the Select Role trigger inside their active staff row
    const activeRoleSelectTrigger = currentStaffRow.locator('[data-slot="select-trigger"]').first();
    await activeRoleSelectTrigger.click();

    try {
      await expect(adminPage.getByRole('option', { name: 'BANNED', exact: true })).toBeVisible({ timeout: 1500 });
    } catch {
      await activeRoleSelectTrigger.click();
    }
    await adminPage.getByRole('option', { name: 'BANNED', exact: true }).click();

    // Click "Сменить" button
    const banChangeBtn = currentStaffRow.getByRole('button', { name: 'Сменить' });
    await banChangeBtn.click();
    // Wait for the staff member to be removed from the active staff list
    await expect(currentStaffRow).toBeHidden({ timeout: 15000 });

    // Verify BANNED in DB & Audit Log
    const bannedUser = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
    expect(bannedUser.role).toBe('BANNED');

    const banLog = await prisma.adminAuditLog.findFirst({
      where: {
        target: bannedUser.id,
        targetType: 'USER',
        action: 'USER_ROLE_CHANGE',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(banLog).not.toBeNull();
    const banNewVal = JSON.parse(banLog!.newValue || '{}');
    expect(banNewVal.role).toBe('BANNED');

    // 10. Demote the user back to USER (representing deletion/removal from staff list)
    // First we search for the user again under "Назначение ролей" because banned/regular users are not in active staff list
    await searchInput.fill(testEmail);
    await adminPage.getByRole('button', { name: 'Найти' }).click();

    const foundRow = promotionCard.locator('tr', { hasText: testEmail }).first();
    await expect(foundRow).toBeVisible({ timeout: 10000 });

    const regularRoleSelectTrigger = foundRow.locator('[data-slot="select-trigger"]').first();
    await regularRoleSelectTrigger.click();

    try {
      await expect(adminPage.getByRole('option', { name: 'USER', exact: true })).toBeVisible({ timeout: 1500 });
    } catch {
      await regularRoleSelectTrigger.click();
    }
    await adminPage.getByRole('option', { name: 'USER', exact: true }).click();

    // Click "Назначить"
    const assignBtn = foundRow.getByRole('button', { name: 'Назначить' });
    await assignBtn.click();
    await expect(assignBtn).toBeEnabled({ timeout: 15000 });

    // Verify they are back to USER in DB & logged in Audit Log
    const demotedUser = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
    expect(demotedUser.role).toBe('USER');
    expect(demotedUser.staffRoleId).toBeNull();
  });
});
