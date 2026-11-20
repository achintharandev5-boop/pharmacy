/** Public, build-time marker only. Authorization and database isolation remain server-side. */
export function syntheticStaging() {
  return process.env.NEXT_PUBLIC_DEPLOYMENT_PROFILE === 'synthetic-staging';
}

export function clinicalPrintBlocker(): string | null {
  return syntheticStaging() ? 'Synthetic staging: clinical printing is disabled. Use the on-screen test preview.' : null;
}
