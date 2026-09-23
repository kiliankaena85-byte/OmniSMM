import type { StaffRole, StaffPermission } from '@prisma/client';

export interface StaffUser {
  id: string;
  email: string;
  role: string;
  balance: bigint;
  supportLimitCents: number;
  geminiApiKey: string | null;
  createdAt: Date;
  staffRoleId: string | null;
  staffRole?: { id: string; name: string } | null;
  _count: { orders: number; tickets: number };
}

export interface RegularUser {
  id: string;
  email: string;
  role: string;
  balance: bigint;
  supportLimitCents: number;
  createdAt: Date;
  staffRoleId?: string | null;
  _count: { orders: number; tickets: number };
}

export interface TeamManagementProps {
  staffUsers: StaffUser[];
  regularUsers: RegularUser[];
  searchQuery: string;
  currentAdminRole?: string;
  staffRoles?: (StaffRole & { permissions: StaffPermission[] })[];
}

export interface RolePermissionsState {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Record<string, { canView: boolean; canEdit: boolean }>;
}
