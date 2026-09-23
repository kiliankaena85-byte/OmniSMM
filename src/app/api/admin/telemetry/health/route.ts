import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { SystemTelemetryService } from '@/services/telemetry/system-telemetry.service';

export async function GET() {
  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { role: true }
    });

    if (!user || user.role === 'USER' || user.role === 'BANNED') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const snapshot = await SystemTelemetryService.collectSnapshot();
    return NextResponse.json({
      timestamp: snapshot.timestamp,
      overallStatus: snapshot.overallStatus,
      activeAlerts: snapshot.activeAlerts,
      disk: snapshot.disk,
      memory: snapshot.memory,
      database: snapshot.database,
      queues: snapshot.queues,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message, activeAlerts: [] },
      { status: 500 }
    );
  }
}
