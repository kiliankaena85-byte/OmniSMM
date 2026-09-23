// SC11 Negative Fixture: confirmPayment with explicit currency check
export async function confirmPayment(paymentId: string, currency: string) {
  if (currency !== 'RUB') throw new Error('Invalid currency');
  return { status: 'OK' };
}
