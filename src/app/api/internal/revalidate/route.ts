import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const secret = process.env.INTERNAL_API_SECRET;

    // Fail securely if secret is not configured in production
    if (!secret) {
      console.error('[API/Revalidate] INTERNAL_API_SECRET is not configured.');
      return NextResponse.json({ success: false, message: 'Server misconfiguration.' }, { status: 500 });
    }

    const expectedAuth = `Bearer ${secret}`;
    const crypto = await import('crypto');
    const authBuf = Buffer.from(authHeader || '');
    const expectedBuf = Buffer.from(expectedAuth);

    if (authBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(authBuf, expectedBuf)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const tags: string[] = body.tags;

    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json({ success: false, message: 'Missing or invalid tags array' }, { status: 400 });
    }

    for (const tag of tags) {
      (revalidateTag as (tag: string) => void)(tag);
      logger.info('Cache tag revalidated', { tag });
    }

    return NextResponse.json({ success: true, revalidated: true, tags });
  } catch (error) {
    console.error('[API/Revalidate] Error processing revalidation:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
