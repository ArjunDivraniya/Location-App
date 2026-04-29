import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Space_Grotesk } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: 'Location Chat',
  description: 'Location-aware group chat for nearby users',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} bg-ink text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
