import React from 'react';
import { enforceSectionAccess } from '@/lib/server/rbac';
import { getStaffMembersWithMetrics } from '@/actions/admin/staff';
import { db } from '@/lib/db';
import { StaffClient } from './staff-client';
import { Users, Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminStaffPage() {
  const admin = await enforceSectionAccess('staff');

  const staffRes = await getStaffMembersWithMetrics();
  const staffMembers = staffRes.success ? staffRes.data : [];
  const selectedDate = staffRes.success ? staffRes.date : new Date().toISOString().split('T')[0];

  const staffRoles = await db.staffRole.findMany({
    include: { permissions: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            Команда и контроль смен
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary shrink-0" />
            Сотрудники & График активности
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Мониторинг рабочих смен, 24-часовой график активности, простой по тикетам и персональный аудит действий на русском языке.
          </p>
        </div>
      </div>

      {/* Interactive Client Hub */}
      <StaffClient
        initialStaff={staffMembers}
        selectedDate={selectedDate}
        staffRoles={staffRoles}
        currentUserRole={admin.role}
      />
    </div>
  );
}
