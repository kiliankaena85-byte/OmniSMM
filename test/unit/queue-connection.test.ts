import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { getRedisConnection, createQueue, closeQueues } from '../../src/lib/queue-manager';

describe('BullMQ Infrastructure Tests', () => {
    beforeAll(() => {
    // Setup any required mocks if testing without real Redis
        // For CI environments where Redis might not be guaranteed
    });

    it('should initialize a single Redis connection without crashing', () => {
        const connection1 = getRedisConnection();
        const connection2 = getRedisConnection();
        expect(connection1).toBe(connection2);
    });

    it('should create queues with exponential backoff configurations', () => {
        const testQueue = createQueue('test-queue');
        const defaultOptions = testQueue.defaultJobOptions;
        
        expect(defaultOptions?.attempts).toBe(3); // Testing default backoff
        expect(defaultOptions?.backoff).toHaveProperty('type', 'exponential');
    });

    it('should safely disconnect', async () => {
        await expect(closeQueues()).resolves.not.toThrow();
    });
});
