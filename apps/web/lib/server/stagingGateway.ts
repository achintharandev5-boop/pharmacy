/** Import only from server code; this secret must never enter a client component. */
export function stagingGatewayHeaders(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  if (env.DEPLOYMENT_PROFILE !== 'synthetic-staging') return {};
  if (!/^[a-f0-9]{64}$/.test(env.STAGING_GATEWAY_TOKEN || '')) {
    throw new Error('Staging gateway configuration is missing or invalid.');
  }
  return { 'X-Staging-Gateway-Token': env.STAGING_GATEWAY_TOKEN! };
}
