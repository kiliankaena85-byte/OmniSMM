import { describe, it, expect } from 'vitest';
import { getLegalFallback, LEGAL_FALLBACKS } from '@/data/legal-fallbacks';

describe('Legal Documents & Fallback Compliance (Enterprise v5.1)', () => {
  it('should have all 5 core legal documents registered in LEGAL_FALLBACKS', () => {
    expect(LEGAL_FALLBACKS.terms).toBeDefined();
    expect(LEGAL_FALLBACKS.privacy).toBeDefined();
    expect(LEGAL_FALLBACKS.refund).toBeDefined();
    expect(LEGAL_FALLBACKS.cookies).toBeDefined();
    expect(LEGAL_FALLBACKS['service-rules']).toBeDefined();
  });

  it('terms: should contain proper statutory references and no dormant fee', () => {
    const terms = getLegalFallback('terms');
    expect(terms).not.toBeNull();
    expect(terms?.html).toContain('437');
    expect(terms?.html).toContain('706'); // Subcontracting
    expect(terms?.html).toContain('782'); // Unilateral refusal & FPR
    expect(terms?.html).toContain('160'); // Simple Electronic Signature (PEP)
    expect(terms?.html).toContain('15% до 40%'); // Flexible FPR
    expect(terms?.html).toContain('54-ФЗ');
    expect(terms?.html).toContain('115-ФЗ');
    // Ensure no dormant fee or negative balance clauses
    expect(terms?.html).not.toContain('100 рублей в месяц');
    expect(terms?.html).not.toContain('абонентская плата');
  });

  it('refund: should contain 100% auto-refund and 15-40% FPR on withdrawal', () => {
    const refund = getLegalFallback('refund');
    expect(refund).not.toBeNull();
    expect(refund?.html).toContain('100%');
    expect(refund?.html).toContain('ERROR');
    expect(refund?.html).toContain('CANCELED');
    expect(refund?.html).toContain('PARTIAL');
    expect(refund?.html).toContain('15% до 40%');
    expect(refund?.html).toContain('115-ФЗ');
    expect(refund?.html).toContain('10 рабочих дней');
    expect(refund?.html).not.toContain('100 рублей в месяц');
  });

  it('service-rules: should contain 8 zero-tolerance categories and Meta disclaimer', () => {
    const rules = getLegalFallback('service-rules');
    expect(rules).not.toBeNull();
    expect(rules?.html).toContain('282 УК РФ'); // Extremism
    expect(rules?.html).toContain('141 УК РФ'); // Elections
    expect(rules?.html).toContain('159.6'); // IT fraud
    expect(rules?.html).toContain('Meta Platforms Inc.');
    expect(rules?.html).toContain('Zero Tolerance');
  });

  it('privacy: should comply with 152-FZ, server localization in RF and PCI DSS', () => {
    const privacy = getLegalFallback('privacy');
    expect(privacy).not.toBeNull();
    expect(privacy?.html).toContain('152-ФЗ');
    expect(privacy?.html).toContain('ч. 5 ст. 18');
    expect(privacy?.html).toContain('Российской Федерации');
    expect(privacy?.html).toContain('PCI DSS');
    expect(privacy?.html).toContain('10 рабочих дней');
  });

  it('cookies: should specify session and security cookies without tracking', () => {
    const cookies = getLegalFallback('cookies');
    expect(cookies).not.toBeNull();
    expect(cookies?.html).toContain('session_token');
    expect(cookies?.html).toContain('csrf_token');
    expect(cookies?.html).toContain('x_admin_tenant');
  });
});
