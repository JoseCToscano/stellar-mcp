/** @type {import('next').NextConfig} */
const nextConfig = {
  // passkey-kit, passkey-kit-sdk, and sac-sdk all ship raw TypeScript source
  // (their package.json has main: "src/index.ts"). Tell Next.js/SWC to transpile them.
  transpilePackages: ['passkey-kit', 'passkey-kit-sdk', 'sac-sdk'],

  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // Node.js built-ins — not available in the browser
      fs: false,
      net: false,
      tls: false,
      // sodium-native is a Node.js native crypto addon; @stellar/stellar-base
      // uses TweetNaCl as the browser fallback automatically.
      'sodium-native': false,
    };

    return config;
  },
};

export default nextConfig;
