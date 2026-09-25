/**
 * Dynamic brand metadata resolver for safe fallbacks on N-tenants.
 * Eliminates binary ternaries and brand bleeding when new tenants are introduced.
 */
export function getTenantFallbackBranding(tenantSlug: string | null | undefined) {
  const clean = (tenantSlug || '').trim().toLowerCase();
  if (clean === 'flux') {
    return {
      name: 'SMMflux',
      domain: 'smmflux.ru',
      supportEmail: 'support@smmflux.ru',
      privacyEmail: 'privacy@smmflux.ru',
      bot: 'smmflux_support_bot',
      channel: 'smmflux_support',
    };
  }
  if (clean === 'smmplan') {
    return {
      name: 'SMMplan',
      domain: 'smmplan.pro',
      supportEmail: 'support@smmplan.pro',
      privacyEmail: 'privacy@smmplan.pro',
      bot: 'smmplan_support_bot',
      channel: 'smmplan_support',
    };
  }
  const capitalized = clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'OmniSMM';
  const domain = clean ? `${clean}.pro` : 'smmplan.pro';
  return {
    name: capitalized,
    domain,
    supportEmail: `support@${domain}`,
    privacyEmail: `privacy@${domain}`,
    bot: clean ? `${clean}_support_bot` : 'smmplan_support_bot',
    channel: clean ? `${clean}_support` : 'smmplan_support',
  };
}
