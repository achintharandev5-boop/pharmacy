import type { NextConfig } from "next";

if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_UI_TEST_MODE === 'true') {
  throw new Error('UI testing mode cannot be enabled in production builds.');
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
