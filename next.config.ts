import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/pyodide/:path*',
        destination: '/node_modules/pyodide/:path*',
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      child_process: false,
      crypto: false,
      stream: false,
      util: false,
      url: false,
      zlib: false,
    };
    
    // 忽略 Pyodide 的 Node.js 依赖
    config.externals = config.externals || [];
    if (typeof config.externals === 'object' && !Array.isArray(config.externals)) {
      config.externals = [config.externals];
    }
    config.externals.push({
      'child_process': 'commonjs child_process',
      'fs': 'commonjs fs',
      'path': 'commonjs path',
    });
    
    return config;
  },
};

export default nextConfig;
