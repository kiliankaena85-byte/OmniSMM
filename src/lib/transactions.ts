import { db } from './db';
import { Prisma } from '@prisma/client';

export async function runSerializableTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  maxRetries = 15
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await db.$transaction(fn, { isolationLevel: 'Serializable', timeout: 30000 });
    } catch (err: unknown) {
      attempt++;
      const error = (typeof err === 'object' && err !== null ? err : {}) as { code?: string; message?: string };
      const isSerializationError = 
        error.code === 'P2034' || 
        error.message?.includes('could not serialize access') ||
        error.message?.includes('deadlock') ||
        error.message?.includes('40001');
      
      if (isSerializationError && attempt < maxRetries) {
        console.warn(`[Transaction] Serialization failure on attempt ${attempt}, retrying...`);
        // Exponential backoff with jitter to resolve concurrent lock contention faster
        const delay = Math.min(200, Math.pow(2, attempt) * 10) + Math.random() * 30;
        await new Promise(res => setTimeout(res, delay));
        continue;
      }
      throw err;
    }
  }
}
