import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['passkey-kit', 'passkey-kit-sdk', 'sac-sdk'],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      'sodium-native': false,
    };
    return config;
  },
};

export default nextConfig;
