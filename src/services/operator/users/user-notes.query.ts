import { db } from '@/lib/db';

/**
 * Fetches all operator notes for a specific user, ordered by creation date descending.
 * Includes basic author details for display (email and role).
 */
export async function getUserNotes(userId: string) {
  return db.userNote.findMany({
    where: { userId },
    include: {
      author: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Adds an operator note about a user, with optional references to a ticket or order.
 */
export async function addUserNote(
  userId: string,
  authorId: string | null,
  content: string,
  orderId?: string | null,
  ticketId?: string | null
) {
  return db.userNote.create({
    data: {
      userId,
      authorId,
      content,
      orderId: orderId || null,
      ticketId: ticketId || null,
    },
    include: {
      author: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });
}
