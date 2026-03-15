import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['passkey-kit', 'passkey-kit-sdk', 'sac-sdk'],

  // Proxy /mcp requests to the actual MCP server to avoid browser CORS issues.
  // The MCPClient runs in the browser, so cross-origin requests get blocked.
  async rewrites() {
    const target = process.env.MCP_PROXY_TARGET || 'http://localhost:3000/mcp';
    return [
      {
        source: '/mcp',
        destination: target,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      'sodium-native': false,
    };

    // stellar-sdk's lib/minimal/bindings/config.js does require('../../package.json')
    // which resolves to lib/package.json (wrong depth). Redirect to the actual file.
    const sdkPkgJson = path.resolve(
      __dirname,
      'node_modules/@stellar/stellar-sdk/package.json',
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webpack = require('webpack');
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /\.\.\/\.\.\/package\.json$/,
        (resource: { context?: string; request?: string }) => {
          if (resource.context?.includes('@stellar/stellar-sdk')) {
            resource.request = sdkPkgJson;
          }
        },
      ),
    );

    return config;
  },
};

export default nextConfig;
