/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Sprint 1 不引入 ESLint 配置，构建时跳过 lint，专注 TypeScript 类型检查
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
