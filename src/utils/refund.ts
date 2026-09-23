import { ExactMath } from '@/lib/financial/exact-math';

/**
 * Единая формула расчёта частичного возврата.
 * 
 * ARCHITECTURE CONTRACT: Все места в коде, где нужно посчитать
 * сумму возврата за невыполненную часть заказа, ОБЯЗАНЫ использовать
 * эту функцию. Не дублируйте формулу.
 * 
 * Использует детерминированную копеечную арифметику ExactMath.calculatePartialRefund
 * с банковским округлением Half-Even.
 * 
 * Граничные случаи:
 *   - quantity <= 0 → возврат 0 (деление на ноль)
 *   - remains <= 0 → возврат 0
 *   - charge <= 0 → возврат 0
 *   - remains >= quantity → возврат полного charge (защита от переплат)
 */
export function calculatePartialRefund(order: {
  remains: number | bigint;
  quantity: number | bigint;
  charge: number | bigint;
}): number {
  const chargeBig = typeof order.charge === 'bigint'
    ? order.charge
    : BigInt(Math.max(0, Math.floor(Number(order.charge) || 0)));
  const quantityBig = typeof order.quantity === 'bigint'
    ? order.quantity
    : BigInt(Math.max(0, Math.floor(Number(order.quantity) || 0)));
  const remainsBig = typeof order.remains === 'bigint'
    ? order.remains
    : BigInt(Math.max(0, Math.floor(Number(order.remains) || 0)));

  if (quantityBig <= BigInt(0) || remainsBig <= BigInt(0) || chargeBig <= BigInt(0)) {
    return 0;
  }

  const refundBigInt = ExactMath.calculatePartialRefund(chargeBig, quantityBig, remainsBig);
  return Number(refundBigInt);
}

