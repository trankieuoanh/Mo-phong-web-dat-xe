import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * `firebase-admin` KHONG duoc webpack bundle.
   *
   * No keo theo phu thuoc native/grpc va cac duong `require` dong ma webpack
   * khong tinh duoc tinh; bundle vao thi build hong. `serverExternalPackages`
   * bao Next de nguyen cho Node `require` luc chay.
   *
   * Chi co tac dung o phia server — va `firebase-admin` chi duoc nhap tu
   * `lib/server/**`, von da duoc `server-only` chan khong cho lot xuong client.
   */
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;
