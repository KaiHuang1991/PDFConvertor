/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 优化构建性能
  typescript: {
    // 在构建时忽略类型错误（开发时仍会检查）
    ignoreBuildErrors: false,
  },
  eslint: {
    // 在构建时忽略 ESLint 错误（开发时仍会检查）
    ignoreDuringBuilds: false,
  },
  // 减少构建时间
  swcMinify: true,
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    // 优化 webpack 性能
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig

