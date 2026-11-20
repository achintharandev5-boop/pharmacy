import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';

/**
 * Sends a POS-only account (cashier) to the point of sale instead of a staff page.
 *
 * This is a convenience, not the security boundary: the API refuses a cashier on every staff
 * route whatever page is shown. If the identity cannot be checked (API unreachable, session
 * expired) the page renders as before and its own API calls report the problem.
 */
export async function redirectCashierToPos(): Promise<void> {
  const me = await getCurrentUser();
  if (me.ok && me.data.role === 'cashier') redirect('/pos');
}
