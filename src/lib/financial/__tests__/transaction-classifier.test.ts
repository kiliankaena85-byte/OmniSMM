import { describe, it, expect } from 'vitest';
import { classifyTransaction, matchesTransactionTypeFilter } from '../transaction-classifier';

describe('Transaction Classifier Unit Tests', () => {
  it('should correctly classify TOPUP as DEPOSIT', () => {
    const item = { amountRub: 500, transactionType: 'TOPUP' };
    expect(classifyTransaction(item)).toBe('DEPOSIT');
    expect(matchesTransactionTypeFilter(item, 'DEPOSIT')).toBe(true);
    expect(matchesTransactionTypeFilter(item, 'SPENT')).toBe(false);
  });

  it('should correctly classify ORDER_CHARGE as SPENT', () => {
    const item = { amountRub: -150, transactionType: 'ORDER_CHARGE' };
    expect(classifyTransaction(item)).toBe('SPENT');
    expect(matchesTransactionTypeFilter(item, 'SPENT')).toBe(true);
    expect(matchesTransactionTypeFilter(item, 'DEPOSIT')).toBe(false);
  });

  it('should correctly classify REFUND as REFUND', () => {
    const item = { amountRub: 100, transactionType: 'REFUND' };
    expect(classifyTransaction(item)).toBe('REFUND');
    expect(matchesTransactionTypeFilter(item, 'REFUND')).toBe(true);
  });

  it('should correctly classify ORDER_CANCEL (admin refund) as REFUND', () => {
    const item = { amountRub: 250, transactionType: 'ORDER_CANCEL' };
    expect(classifyTransaction(item)).toBe('REFUND');
    expect(matchesTransactionTypeFilter(item, 'REFUND')).toBe(true);
  });

  it('should correctly classify positive COMPENSATION as REFUND', () => {
    const item = { amountRub: 50, transactionType: 'COMPENSATION' };
    expect(classifyTransaction(item)).toBe('REFUND');
    expect(matchesTransactionTypeFilter(item, 'REFUND')).toBe(true);
  });

  it('should correctly classify REROUTE (negative) as SPENT', () => {
    const item = { amountRub: -80, transactionType: 'REROUTE' };
    expect(classifyTransaction(item)).toBe('SPENT');
    expect(matchesTransactionTypeFilter(item, 'SPENT')).toBe(true);
  });

  it('should correctly classify legacy PAYMENT based on sign', () => {
    const deposit = { amountRub: 1000, transactionType: 'PAYMENT' };
    const spent = { amountRub: -300, transactionType: 'PAYMENT' };

    expect(classifyTransaction(deposit)).toBe('DEPOSIT');
    expect(classifyTransaction(spent)).toBe('SPENT');
  });

  it('should return true for ALL filter type', () => {
    const item = { amountRub: -100, transactionType: 'ORDER_CHARGE' };
    expect(matchesTransactionTypeFilter(item, 'ALL')).toBe(true);
  });
});
