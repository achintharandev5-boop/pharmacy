import type { NextConfig } from "next";
import { validateStagingConfiguration } from './lib/server/stagingConfiguration';

validateStagingConfiguration();

if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_UI_TEST_MODE === 'true') {
  throw new Error('UI testing mode cannot be enabled in production builds.');
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ...(process.env.DEPLOYMENT_PROFILE === 'synthetic-staging' ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }] : []),
    ] }];
  },
};

export default nextConfig;
