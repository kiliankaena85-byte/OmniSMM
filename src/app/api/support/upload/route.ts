export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

import { getEncodedKey, readSessionTokenFromCookies } from '@/lib/session';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const token = readSessionTokenFromCookies(req.cookies);
    if (!token) return new NextResponse('Unauthorized', { status: 401 });

    const { payload } = await jwtVerify(token, getEncodedKey(), { algorithms: ['HS256'] });
    const userId = payload.userId as string;
    const tokenTenantId = (payload.tenantId as string) || 'smmplan';
    const user = await db.user.findFirst({
      where: { id: userId, tenantId: tokenTenantId }
    });
    if (!user) return new NextResponse('Unauthorized', { status: 401 });

    // 2. Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const ticketId = formData.get('ticketId') as string | null;

    if (!file || !ticketId) {
      return new NextResponse('Missing file or ticketId', { status: 400 });
    }

    // 3. Size and type validation
    if (file.size > MAX_FILE_SIZE) {
      return new NextResponse('File too large (max 5MB)', { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return new NextResponse('Unsupported file type', { status: 400 });
    }

    // 4. Access control: verify user owns ticket or is staff with strict tenant boundary
    const isStaff = ['ADMIN', 'SUPPORT', 'OWNER'].includes(user.role);
    const tenantId = user.tenantId ?? 'smmplan';
    const ticket = await db.ticket.findFirst({
      where: isStaff ? { id: ticketId, tenantId } : { id: ticketId, userId, tenantId }
    });
    if (!ticket) return new NextResponse('Ticket not found or access denied', { status: 404 });

    // 5. Save the file locally & Magic Byte Validation
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Magic Byte validation (header signature check)
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

    if (!isPng && !isJpg && !isWebp && !isPdf) {
      return new NextResponse('Invalid file signature (magic byte mismatch)', { status: 400 });
    }

    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    
    // Enforce strict mime-to-extension mapping
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/pdf': 'pdf'
    };
    const ext = mimeToExt[file.type] || 'bin';
    
    const relativePath = `tickets/${ticket.id}/${hash}.${ext}`;
    const absolutePath = path.join(process.cwd(), 'private', 'uploads', ...relativePath.split('/'));

    // Ensure directory exists
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    // Save
    await fs.writeFile(absolutePath, buffer);

    // 6. Return response
    let mediaType = 'file';
    if (file.type.startsWith('image/')) mediaType = 'image';
    else if (file.type === 'application/pdf') mediaType = 'document';

    return NextResponse.json({
      mediaUrl: relativePath,
      mediaType: mediaType,
      fileName: file.name
    });

  } catch (error) {
    console.error('File upload error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

