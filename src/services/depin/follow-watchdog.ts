import { db } from '@/lib/db';
import { DePinEscrowService, REPUTATION_CHANGES } from './escrow';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

async function checkMembership(telegramUserId: string, channelId: string): Promise<boolean> {
  if (!BOT_TOKEN) return true;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${channelId}&user_id=${telegramUserId}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { result?: { status?: string } };
    const status = data.result?.status;
    return status === 'member' || status === 'administrator' || status === 'creator';
  } catch {
    return true;
  }
}

export async function runFollowAuditRound(): Promise<{ audited: number; churned: number; bonused: number }> {
  const activeFollows = await db.dePinTarget.findMany({
    where: { type: 'FOLLOW_CHANNEL', status: 'COMPLETED' },
    select: { id: true, nodeId: true, channel: true },
  });

  const sampleSize = Math.max(1, Math.floor(activeFollows.length * 0.1));
  const sample = [...activeFollows].sort(() => Math.random() - 0.5).slice(0, sampleSize);

  let audited = 0, churned = 0, bonused = 0;

  for (const follow of sample) {
    if (!follow.nodeId) continue;
    const telegramUserId = follow.nodeId.replace('tg_', '');
    if (telegramUserId === follow.nodeId) continue;

    const stillMember = await checkMembership(telegramUserId, follow.channel);
    const reputationDelta = stillMember ? REPUTATION_CHANGES.AUDIT_PASSED : REPUTATION_CHANGES.UNFOLLOW_AFTER_AUDIT;

    await db.dePinFollowAudit.create({
      data: { nodeId: follow.nodeId, targetId: follow.id, telegramUserId, channelId: follow.channel, stillMember, reputationDelta },
    });
    audited++;

    if (!stillMember) {
      await Promise.all([
        DePinEscrowService.burnEscrow(follow.id, 'unfollow_watchdog'),
        DePinEscrowService.adjustReputation(follow.nodeId, REPUTATION_CHANGES.UNFOLLOW_AFTER_AUDIT),
        db.dePinTarget.update({ where: { id: follow.id }, data: { status: 'FAILED', auditCount: { increment: 1 } } }),
      ]);
      churned++;
    } else {
      await Promise.all([
        DePinEscrowService.adjustReputation(follow.nodeId, REPUTATION_CHANGES.AUDIT_PASSED),
        DePinEscrowService.releaseEscrow(follow.id),
        db.dePinTarget.update({ where: { id: follow.id }, data: { auditCount: { increment: 1 }, verifiedAt: new Date() } }),
      ]);
      bonused++;
    }
  }
  return { audited, churned, bonused };
}
