import { db } from '@/lib/db';

export const ESCROW_RATE = 0.3;
export const ESCROW_LOCK_HOURS = 72;

export const REPUTATION_CHANGES = {
  TASK_COMPLETED: 2,
  AUDIT_PASSED: 5,
  FOLLOW_30_DAYS: 10,
  TOO_FAST: -5,
  UNFOLLOW_BEFORE_VERIFY: -20,
  UNFOLLOW_AFTER_AUDIT: -30,
  PATTERN_FRAUD: -50,
} as const;

export class DePinEscrowService {
  static async lockEscrow(nodeId: string, targetId: string, reward: number): Promise<{ escrowId: string; amount: number }> {
    const amount = Math.floor(reward * ESCROW_RATE);
    const expiresAt = new Date(Date.now() + ESCROW_LOCK_HOURS * 60 * 60 * 1000);
    const [escrow] = await db.$transaction([
      db.dePinEscrow.create({ data: { nodeId, targetId, amount, expiresAt, status: 'LOCKED' } }),
      db.dePinNode.update({ where: { id: nodeId }, data: { creditsBalance: { decrement: amount }, escrowCredits: { increment: amount } } }),
    ]);
    return { escrowId: escrow.id, amount };
  }

  static async releaseEscrow(targetId: string): Promise<void> {
    const escrow = await db.dePinEscrow.findUnique({ where: { targetId } });
    if (!escrow || escrow.status !== 'LOCKED') return;
    await db.$transaction([
      db.dePinEscrow.update({ where: { targetId }, data: { status: 'RELEASED', updatedAt: new Date() } }),
      db.dePinNode.update({ where: { id: escrow.nodeId }, data: { escrowCredits: { decrement: escrow.amount }, creditsBalance: { increment: escrow.amount } } }),
    ]);
  }

  static async burnEscrow(targetId: string, reason: string): Promise<void> {
    const escrow = await db.dePinEscrow.findUnique({ where: { targetId } });
    if (!escrow || escrow.status !== 'LOCKED') return;
    void reason;
    await db.$transaction([
      db.dePinEscrow.update({ where: { targetId }, data: { status: 'BURNED', updatedAt: new Date() } }),
      db.dePinNode.update({ where: { id: escrow.nodeId }, data: { escrowCredits: { decrement: escrow.amount } } }),
    ]);
  }

  static async adjustReputation(nodeId: string, delta: number): Promise<number> {
    const node = await db.dePinNode.update({
      where: { id: nodeId },
      data: { reputation: { increment: delta }, lastAuditAt: new Date(), ...(delta < 0 ? { tasksFailed: { increment: 1 } } : {}) },
      select: { reputation: true },
    });
    const clamped = Math.max(0, Math.min(100, node.reputation));
    if (clamped !== node.reputation) await db.dePinNode.update({ where: { id: nodeId }, data: { reputation: clamped } });
    return clamped;
  }

  static calcRewardWithReputation(baseReward: number, reputation: number): number {
    return Math.floor(baseReward * Math.max(0.2, reputation / 100));
  }

  static async getExpiredEscrows() {
    return db.dePinEscrow.findMany({
      where: { status: 'LOCKED', expiresAt: { lt: new Date() } },
      select: { id: true, nodeId: true, targetId: true, amount: true },
    });
  }
}
