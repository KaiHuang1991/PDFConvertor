/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // 临时禁用以解决 ActionQueueContext 错误
  // 优化构建性能
  typescript: {
    // 在构建时忽略类型错误（开发时仍会检查）
    ignoreBuildErrors: false,
  },
  // 实验性功能配置
  experimental: {
    // 优化 App Router
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  // Turbopack 配置（Next.js 16+）
  turbopack: {
    resolveAlias: {
      canvas: false,
    },
  },
  // 兼容 webpack（如果使用 --webpack 标志）
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    // 优化 webpack 性能
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    // 支持Tesseract.js
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
}

module.exports = nextConfig

