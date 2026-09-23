export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db';
import { settingsService } from '@/services/admin/settings.service';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { getEncodedKey, readSessionTokenFromCookies } from '@/lib/session';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_FAVICON_SIZE = 500 * 1024; // 500 KB

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication & RBAC Check
    const token = readSessionTokenFromCookies(req.cookies);
    if (!token) return new NextResponse('Unauthorized', { status: 401 });

    const { payload } = await jwtVerify(token, getEncodedKey(), { algorithms: ['HS256'] });
    const userId = payload.userId as string;
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { staffRole: { include: { permissions: true } } }
    });

    if (!user) return new NextResponse('Unauthorized', { status: 401 });

    // Enforce ADMIN or OWNER or granular permission settings:edit
    const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(user.role);
    const hasPermission = user.staffRole?.permissions.some(
      p => p.section.toUpperCase() === 'SETTINGS' && p.canEdit
    );

    if (!isOwnerOrAdmin && !hasPermission) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // 2. Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as 'logo' | 'favicon' | null; // logo or favicon

    if (!file || !type || !['logo', 'favicon'].includes(type)) {
      return new NextResponse('Missing file or invalid upload type', { status: 400 });
    }

    // 3. Validation size & format
    const maxSize = type === 'logo' ? MAX_LOGO_SIZE : MAX_FAVICON_SIZE;
    if (file.size > maxSize) {
      const displaySize = type === 'logo' ? '2MB' : '500KB';
      return new NextResponse(`Размер файла превышает лимит (${displaySize})`, { status: 400 });
    }

    if (!ALLOWED_MIME.includes(file.type)) {
      return new NextResponse('Неподдерживаемый формат файла. Разрешены только PNG, JPG, WEBP, SVG, ICO.', { status: 400 });
    }

    // 4. Read settings to find old branding path
    const settings = await settingsService.getSystemSettings();

    // 5. Generate secure name & path
    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/x-icon': 'ico',
      'image/vnd.microsoft.icon': 'ico'
    };
    const ext = mimeToExt[file.type] || 'png';
    const filename = `${type}_${hash}.${ext}`;
    
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'site');
    const absolutePath = path.join(uploadsDir, filename);

    // Create directory if not exists
    await fs.mkdir(uploadsDir, { recursive: true });

    // 6. Delete old branding file from disk to save space
    const oldUrl = type === 'logo' ? settings.siteLogoUrl : settings.siteFaviconUrl;
    if (oldUrl && oldUrl.startsWith('/uploads/site/')) {
      const oldFilename = path.basename(oldUrl);
      // Delete only if it is a different file
      if (oldFilename !== filename) {
        const oldFilePath = path.join(uploadsDir, oldFilename);
        try {
          await fs.unlink(oldFilePath);
        } catch (unlinkErr) {
          // Log and continue, maybe file was already deleted manually
          console.warn('[BrandingUpload] Failed to delete old branding file:', oldFilePath, unlinkErr);
        }
      }
    }

    // 7. Write new file
    await fs.writeFile(absolutePath, buffer);

    const relativeUrl = `/uploads/site/${filename}`;

    // 8. Update DB SystemSettings
    await settingsService.updateSystemSettings({
      [type === 'logo' ? 'siteLogoUrl' : 'siteFaviconUrl']: relativeUrl
    });

    // 9. Invalidate next/cache settings tag
    try {
      const { revalidateTag } = await import('next/cache');
      revalidateTag('settings', {});
    } catch (cacheErr) {
      console.error('[BrandingUpload] Warning: Failed to invalidate cache tag:', cacheErr);
    }

    return NextResponse.json({
      success: true,
      url: relativeUrl
    });

  } catch (error) {
    console.error('[BrandingUpload] Error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new NextResponse(errorMsg || 'Server Error', { status: 500 });
  }
}
