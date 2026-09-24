import type { NextConfig } from 'next';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // @gsm/shared duoc publish duoi dang .ts thuan (khong co buoc build),
  // nen Next phai tu transpile no.
  transpilePackages: ['@gsm/shared'],

  /**
   * Proxy `/api/*` sang apps/api. Day la quyet dinh ky thuat quan trong nhat
   * cua viec tach BE — khong phai tien tay.
   *
   * Neu de trinh duyet goi thang http://localhost:4000/api/events, moi POST
   * `Content-Type: application/json` cross-origin se kich hoat PREFLIGHT OPTIONS,
   * tuc 2 round trip cho MOI event. Dung luc do lai va vao quy tac keepalive
   * o screen-map.md muc 4: hai event ket thuc funnel (`confirm_ride`, `place_order`)
   * ban NGAY TRUOC router.push, phai kip ca preflight lan POST truoc khi trang chuyen.
   * Mat hai event nay la mat dung cai moc "hoan thanh" ma toan bo phan tich dua vao.
   *
   * Qua proxy, trinh duyet thay `/api/events` la same-origin -> khong preflight,
   * va `trackEvent` giu nguyen fetch('/api/events', ...) dung nhu tai lieu da viet.
   */
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
