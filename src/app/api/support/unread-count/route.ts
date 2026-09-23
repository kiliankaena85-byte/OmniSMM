export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ count: 0 });
    }

    const count = await db.ticket.count({
      where: {
        userId: session.userId,
        status: 'PENDING',
        ...(session.tenantId ? { tenantId: session.tenantId } : {}),
      },
    });

    return NextResponse.json({ count });
  } catch (err) {
    console.error('[API] Failed to get unread support count:', err);
    return NextResponse.json({ count: 0 });
  }
}
