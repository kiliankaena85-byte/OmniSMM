import { redirect, RedirectType } from 'next/navigation';

/**
 * Legacy A/B testing route decommissioned.
 * Permanently redirects any incoming traffic to the home route.
 */
export default function LegacyLovablePage() {
  redirect('/', RedirectType.replace);
}
