import { ClerkProvider } from '@clerk/nextjs';
import { registerBuiltInModules } from '@gymx/modules';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import './globals.css';

// Register modules once per server process, before anything reads the registry.
registerBuiltInModules();

export const metadata: Metadata = {
  title: 'GymX',
  description: 'Gym management for Mauritius',
};

/**
 * Applies the stored theme before first paint, so the page never flashes light
 * before switching to dark. Inline and synchronous by necessity.
 */
const THEME_SCRIPT = `
try {
  var stored = localStorage.getItem('gymx.theme');
  var dark = stored ? stored === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <ClerkProvider>
      <html lang={locale} suppressHydrationWarning>
        <head>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: must run before paint */}
          <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        </head>
        <body>
          <NextIntlClientProvider messages={messages} locale={locale}>
            {children}
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
