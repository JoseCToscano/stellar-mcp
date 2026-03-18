import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeScript } from '@/components/ThemeScript';

export const metadata: Metadata = {
  title: 'Stellar Smart Wallet',
  description: 'Passkey-powered smart account interface for Stellar MCP servers.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
