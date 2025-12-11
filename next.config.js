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
  // 添加空的 turbopack 配置以强制使用 webpack
  turbopack: {},
  // Webpack 配置（强制使用 webpack 而不是 Turbopack）
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
      // 确保 Adobe SDK 不会被打包到客户端
      config.resolve.alias['@adobe/pdfservices-node-sdk'] = false;
      config.resolve.alias['lib/adobe-pdf-services'] = false;
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

