import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '../components/Navbar';

export const metadata: Metadata = {
  title: 'StyleSync — Library',
  description: 'Your personal design reference library.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-fg)] antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
