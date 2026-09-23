// SC10 Negative Fixture: SmartDripService.createCampaign inside runSerializableTransaction
import { SmartDripService } from '@/services/dripfeed/smart-drip.service';

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
export async function processCheckout(userId: string, serviceId: string, orderId: string, tx: any) {
  await runSerializableTransaction(async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await SmartDripService.createCampaign(tx, userId, serviceId, orderId, 'p1', 'http', 100, 5, {} as any);
  });
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
function runSerializableTransaction(fn: any) {}
