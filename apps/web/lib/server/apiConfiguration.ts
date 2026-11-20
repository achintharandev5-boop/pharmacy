/** Server-side API target. Production must never fall back to an unrelated local API. */
export function frontendOnlyMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FRONTEND_ONLY_MODE === 'true';
}

export function apiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.API_URL || env.NEXT_PUBLIC_API_URL;
  if (env.NODE_ENV !== 'production') return configured || 'http://localhost:3001';
  try {
    const target = new URL(configured || '');
    const approved = new URL(env.PILOT_API_URL || '');
    if (target.protocol !== 'https:' || target.username || target.password ||
        target.pathname !== '/' || target.search || target.hash || target.href !== approved.href) {
      throw new Error('Invalid API target');
    }
    return target.origin;
  } catch {
    throw new Error('API_URL must match the approved HTTPS PILOT_API_URL in production.');
  }
}

export function loginApiUrls(env: NodeJS.ProcessEnv = process.env): string[] {
  const target = apiBaseUrl(env);
  return env.NODE_ENV === 'production' ? [target]
    : [...new Set([target, 'http://127.0.0.1:3001', 'http://localhost:3001'])];
}
