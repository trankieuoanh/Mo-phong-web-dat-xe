import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Khong con `serverExternalPackages`: app goi D1 bang `fetch` (lib/server/db/d1.ts),
  // khong co goi native/grpc nao can giu ngoai bundle webpack.
};

export default nextConfig;
