import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AppProvider } from '@/lib/app-context';
import './globals.css';

/**
 * Subset `vietnamese` la BAT BUOC — thieu no thi "Banh mi", "Dat xe" se roi ve
 * font he thong va lech han khoi phan con lai (tailwind-theme.md muc 2).
 */
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GSM — Mô phỏng đặt xe',
  description: 'Mô phỏng web đặt xe kiểu Green SM, dùng để thu thập event hành vi người dùng.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="bg-canvas-softer">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
