// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  StaffTableSection,
  CustomRolesSection,
  PromoteUserSection,
  DeleteRoleModal,
  DemoteStaffModal,
  EditStaffModal,
  type StaffUser,
  type RegularUser,
} from '@/app/admin/settings/team';
import { TeamManagement } from '@/app/admin/settings/team-management';
import type { StaffRole, StaffPermission } from '@prisma/client';

// Mock actions
vi.mock('@/actions/admin/team', () => ({
  updateSupportLimit: vi.fn().mockResolvedValue({ success: true }),
  createStaffRoleAction: vi.fn().mockResolvedValue({ success: true }),
  updateStaffRolePermissionsAction: vi.fn().mockResolvedValue({ success: true }),
  deleteStaffRoleAction: vi.fn().mockResolvedValue({ success: true }),
  removeStaffMemberAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/actions/admin/settings', () => ({
  updateUserRole: vi.fn().mockResolvedValue({ success: true }),
  updateStaffGeminiApiKeyAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/actions/admin/roles', () => ({
  updateRoleAction: vi.fn().mockResolvedValue({ success: true }),
}));

const mockStaffUsers: StaffUser[] = [
  {
    id: 'user-1',
    email: 'alice@smmplan.pro',
    role: 'SUPPORT',
    balance: BigInt(100000),
    supportLimitCents: 50000,
    geminiApiKey: 'ai-key-1',
    createdAt: new Date(),
    staffRoleId: 'role-1',
    staffRole: { id: 'role-1', name: 'Junior Support' },
    _count: { orders: 12, tickets: 45 },
  },
  {
    id: 'user-2',
    email: 'bob@smmplan.pro',
    role: 'MANAGER',
    balance: BigInt(500000),
    supportLimitCents: 100000,
    geminiApiKey: null,
    createdAt: new Date(),
    staffRoleId: null,
    staffRole: null,
    _count: { orders: 50, tickets: 10 },
  },
];

const mockRegularUsers: RegularUser[] = [
  {
    id: 'user-3',
    email: 'client@example.com',
    role: 'USER',
    balance: BigInt(25000),
    supportLimitCents: 0,
    createdAt: new Date(),
    staffRoleId: null,
    _count: { orders: 5, tickets: 1 },
  },
];

const mockStaffRoles: (StaffRole & { permissions: StaffPermission[] })[] = [
  {
    id: 'role-1',
    name: 'Junior Support',
    description: 'Basic support role for SMMplan',
    isSystem: false,
    tenantId: 'smmplan',
    allowedTenants: ['smmplan'],
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: [
      { id: 'p-1', tenantId: 'smmplan', roleId: 'role-1', section: 'orders', canView: true, canEdit: false },
      { id: 'p-2', tenantId: 'smmplan', roleId: 'role-1', section: 'finance', canView: false, canEdit: false },
    ],
  },
  {
    id: 'role-2',
    name: 'Flux Operator',
    description: 'Dedicated operator for SMMflux brand',
    isSystem: false,
    tenantId: 'flux',
    allowedTenants: ['flux'],
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: [
      { id: 'p-3', tenantId: 'flux', roleId: 'role-2', section: 'orders', canView: true, canEdit: true },
      { id: 'p-4', tenantId: 'flux', roleId: 'role-2', section: 'catalog', canView: true, canEdit: false },
    ],
  },
  {
    id: 'role-3',
    name: 'OmniSMM Global Lead',
    description: 'Cross-tenant supervisor for all storefronts',
    isSystem: false,
    tenantId: 'smmplan',
    allowedTenants: ['smmplan', 'flux'],
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: [
      { id: 'p-5', tenantId: 'smmplan', roleId: 'role-3', section: 'orders', canView: true, canEdit: true },
      { id: 'p-6', tenantId: 'smmplan', roleId: 'role-3', section: 'finance', canView: true, canEdit: false },
    ],
  },
];

describe('TeamManagement Decomposition Suite (Wave 12 CDD-TDD)', () => {
  it('renders StaffTableSection and responds to search and edit click', () => {
    const onOpenEdit = vi.fn();
    const onOpenDemote = vi.fn();

    render(
      <StaffTableSection
        staffUsers={mockStaffUsers}
        staffRoles={mockStaffRoles}
        onOpenEdit={onOpenEdit}
        onOpenDemote={onOpenDemote}
        canDemote={() => true}
        isPending={false}
      />
    );

    expect(screen.getByText('Команда и Escrow Guard')).toBeDefined();
    expect(screen.getByText('alice@smmplan.pro')).toBeDefined();
    expect(screen.getByText('bob@smmplan.pro')).toBeDefined();
    expect(screen.getByText('Junior Support')).toBeDefined();

    // Filter search
    const searchInput = screen.getByPlaceholderText('Поиск по email...');
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    expect(screen.getByText('alice@smmplan.pro')).toBeDefined();
    expect(screen.queryByText('bob@smmplan.pro')).toBeNull();
  });

  it('renders CustomRolesSection and toggles quick permissions', () => {
    const onToggle = vi.fn();
    const onOpenPerms = vi.fn();
    const onOpenDelete = vi.fn();

    render(
      <CustomRolesSection
        staffRoles={mockStaffRoles}
        onOpenRolePermissions={onOpenPerms}
        onOpenDeleteRole={onOpenDelete}
        onTogglePermission={onToggle}
        onCreateRole={vi.fn().mockResolvedValue(undefined)}
        isPending={false}
      />
    );

    expect(screen.getByText('Роли и Права Доступа')).toBeDefined();
    expect(screen.getByText('Junior Support')).toBeDefined();
    expect(screen.getByText('Flux Operator')).toBeDefined();
    expect(screen.getByText('OmniSMM Global Lead')).toBeDefined();
    expect(screen.getAllByText('Все 16 прав').length).toBe(3);

    fireEvent.click(screen.getAllByText('Все 16 прав')[0]);
    expect(onOpenPerms).toHaveBeenCalled();
  });

  it('renders PromoteUserSection with regular users', () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    render(
      <PromoteUserSection
        regularUsers={mockRegularUsers}
        searchQuery="client"
        currentAdminRole="OWNER"
        staffRoles={mockStaffRoles}
        onUpdateRole={onUpdate}
      />
    );

    expect(screen.getByText('Назначение ролей')).toBeDefined();
    expect(screen.getByText('client@example.com')).toBeDefined();
    expect(screen.getAllByText('Назначить').length).toBeGreaterThanOrEqual(1);
  });

  it('renders DeleteRoleModal and DemoteStaffModal', () => {
    const onDeleteConfirm = vi.fn();
    const onDemoteConfirm = vi.fn();

    const { rerender } = render(
      <DeleteRoleModal
        roleToDelete={{ id: 'role-1', name: 'Junior Support' }}
        onClose={vi.fn()}
        onConfirm={onDeleteConfirm}
      />
    );

    expect(screen.getByText('Удалить роль')).toBeDefined();
    expect(screen.getByText(/«Junior Support»/)).toBeDefined();

    rerender(
      <DemoteStaffModal
        staffToRemove={{ id: 'user-1', email: 'alice@smmplan.pro', role: 'SUPPORT' }}
        onClose={vi.fn()}
        onConfirm={onDemoteConfirm}
      />
    );

    expect(screen.getByText('Разжаловать сотрудника')).toBeDefined();
    expect(screen.getByText('alice@smmplan.pro')).toBeDefined();
  });

  it('renders EditStaffModal with user properties', () => {
    render(
      <EditStaffModal
        editingUser={mockStaffUsers[0]}
        onClose={vi.fn()}
        editRole="SUPPORT"
        setEditRole={vi.fn()}
        editStaffRoleId="role-1"
        setEditStaffRoleId={vi.fn()}
        editGeminiKey=""
        setEditGeminiKey={vi.fn()}
        editLimit="500"
        setEditLimit={vi.fn()}
        isSavingEdit={false}
        onSave={vi.fn().mockResolvedValue(undefined)}
        staffRoles={mockStaffRoles}
        currentAdminRole="OWNER"
        canDemote={() => true}
        onDemoteClick={vi.fn()}
        onOpenRolePermissions={vi.fn()}
      />
    );

    expect(screen.getByText('Настройки сотрудника')).toBeDefined();
    expect(screen.getByText('alice@smmplan.pro')).toBeDefined();
    expect(screen.getByText('Дневной лимит компенсаций (₽)')).toBeDefined();
  });

  it('renders full TeamManagement orchestrator without errors', () => {
    render(
      <TeamManagement
        staffUsers={mockStaffUsers}
        regularUsers={mockRegularUsers}
        searchQuery=""
        currentAdminRole="OWNER"
        staffRoles={mockStaffRoles}
      />
    );

    expect(screen.getByText('Команда и Escrow Guard')).toBeDefined();
    expect(screen.getByText('Роли и Права Доступа')).toBeDefined();
    expect(screen.getByText('Назначение ролей')).toBeDefined();
  });
});
