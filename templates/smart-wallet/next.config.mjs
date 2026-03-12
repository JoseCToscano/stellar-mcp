/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // passkey-kit uses Node.js crypto internals — tell webpack to ignore them
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
