export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';

import { getEncodedKey, readSessionTokenFromCookies } from '@/lib/session';
import { getMimeType } from '@/lib/mime';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Auth check
    const token = readSessionTokenFromCookies(req.cookies);
    if (!token) return new NextResponse('Unauthorized', { status: 401 });

    const { payload } = await jwtVerify(token, getEncodedKey(), { algorithms: ['HS256'] });
    const userId = payload.userId as string;
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return new NextResponse('Unauthorized', { status: 401 });

    const { path: pathSegments } = await params;
    const relativePath = pathSegments.join('/');

    // SD-08 SECURITY FIX: Robust path traversal prevention via resolved path containment.
    // Simple string checks for '..' can be bypassed via encoding tricks.
    // path.resolve() + startsWith() is the only reliable defense.
    const uploadBase = path.resolve(process.cwd(), 'private', 'uploads');
    const filePath = path.resolve(uploadBase, relativePath);
    if (!filePath.startsWith(uploadBase + path.sep) && filePath !== uploadBase) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Access control: if path starts with "tickets/{ticketId}/", verify user owns ticket or is staff
    const ticketMatch = relativePath.match(/^tickets\/([^/]+)\//);
    if (ticketMatch) {
      const ticketId = ticketMatch[1];
      const ticket = await db.ticket.findUnique({ where: { id: ticketId }, select: { userId: true, tenantId: true } });
      if (!ticket) return new NextResponse('Not Found', { status: 404 });

      const isGlobalStaff = ['ADMIN', 'OWNER'].includes(user.role);
      const isTenantSupport = user.role === 'SUPPORT' && ticket.tenantId === (user.tenantId || 'smmplan');
      // Owner of the ticket, global staff, or SUPPORT of the SAME tenant only (no cross-tenant media reads)
      if (ticket.userId !== userId && !isGlobalStaff && !isTenantSupport) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    try {
      const stat = await fs.stat(filePath);
      if (stat.size > 10 * 1024 * 1024) {
        return new NextResponse('Payload Too Large', { status: 413 });
      }
      // audit-ignore: ticket media attachments are bounded by upload limit (<10MB)
      const file = await fs.readFile(filePath);
      const contentType = getMimeType(filePath);

      return new NextResponse(file, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=3600',
        }
      });
    } catch {
      return new NextResponse('Not Found', { status: 404 });
    }
  } catch {
    return new NextResponse('Unauthorized', { status: 401 });
  }
}
