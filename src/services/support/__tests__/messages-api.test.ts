import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/support/messages/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jwtVerify } from 'jose';

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    ticket: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    ticketMessage: {
      findMany: vi.fn(),
    }
  }
}));

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}));

describe('Support Messages API GET Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  const createMockRequest = (urlStr: string, token: string = 'mock-token') => {
    const req = new NextRequest(new URL(urlStr));
    req.cookies.set('session_token', token);
    return req;
  };

  it('should reject unauthorized request if no token present', async () => {
    const req = new NextRequest(new URL('http://localhost/api/support/messages?ticketId=t1'));
    const response = await GET(req);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should correctly default limit to 50 (take 51 in db) and handle cursor pagination', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { userId: 'u1' }
    } as any);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: 'u1',
      role: 'USER'
    } as any);

    vi.mocked(db.ticket.findFirst).mockResolvedValueOnce({
      id: 't1',
      status: 'OPEN'
    } as any);

    const mockMessages = Array.from({ length: 5 }, (_, i) => ({
      id: `msg-${i}`,
      sender: 'USER',
      text: `Hello ${i}`,
      mediaUrl: null,
      mediaType: null,
      createdAt: new Date(),
      isDeleted: false,
      isEdited: false,
      originalText: null,
      replyTo: null,
      attachments: [],
    }));

    vi.mocked(db.ticketMessage.findMany).mockResolvedValueOnce(mockMessages as any);

    const req = createMockRequest('http://localhost/api/support/messages?ticketId=t1');
    const response = await GET(req);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.messages).toHaveLength(5);
    expect(data.nextCursor).toBeNull();

    // Verify Prisma findMany options
    expect(db.ticketMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 51,
      orderBy: { createdAt: 'desc' },
    }));
  });

  it('should enforce maximum limit of 100 even if limit param is higher', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { userId: 'u1' }
    } as any);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: 'u1',
      role: 'USER'
    } as any);

    vi.mocked(db.ticket.findFirst).mockResolvedValueOnce({
      id: 't1',
      status: 'OPEN'
    } as any);

    vi.mocked(db.ticketMessage.findMany).mockResolvedValueOnce([]);

    const req = createMockRequest('http://localhost/api/support/messages?ticketId=t1&limit=250');
    await GET(req);

    // Verify limit is capped at 100 (take 101)
    expect(db.ticketMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 101
    }));
  });

  it('should return nextCursor if more messages exist than limit', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { userId: 'u1' }
    } as any);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: 'u1',
      role: 'USER'
    } as any);

    vi.mocked(db.ticket.findFirst).mockResolvedValueOnce({
      id: 't1',
      status: 'OPEN'
    } as any);

    // Mock 4 messages for a limit of 3
    const mockMessages = Array.from({ length: 4 }, (_, i) => ({
      id: `msg-${i}`,
      sender: 'USER',
      text: `Hello ${i}`,
      mediaUrl: null,
      mediaType: null,
      createdAt: new Date(),
      isDeleted: false,
      isEdited: false,
      originalText: null,
      replyTo: null,
      attachments: [],
    }));

    vi.mocked(db.ticketMessage.findMany).mockResolvedValueOnce(mockMessages as any);

    const req = createMockRequest('http://localhost/api/support/messages?ticketId=t1&limit=3');
    const response = await GET(req);
    const data = await response.json();

    // Response should be sliced to 3, and return nextCursor equal to the 4th item's ID
    expect(data.messages).toHaveLength(3);
    expect(data.nextCursor).toBe('msg-3');
  });
});
