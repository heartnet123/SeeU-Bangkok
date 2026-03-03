import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Configure for monorepo file tracing
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Mapbox GL JS requires specific webpack configuration
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'mapbox-gl': 'mapbox-gl'
      };
    }
    return config;
  },
};

export default nextConfig;
