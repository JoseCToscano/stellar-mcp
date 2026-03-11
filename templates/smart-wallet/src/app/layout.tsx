import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Stellar MCP Smart Wallet',
  description: 'PasskeyKit-powered smart wallet for Stellar MCP servers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}

// Inline script injected before hydration to avoid FOUC (flash of unstyled content)
// Reads localStorage 'sw:theme' and applies 'dark' class immediately.
function ThemeScript() {
  const script = `
    (function() {
      try {
        var t = localStorage.getItem('sw:theme');
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (t === 'dark' || (!t && prefersDark)) {
          document.documentElement.classList.add('dark');
        }
      } catch(e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
