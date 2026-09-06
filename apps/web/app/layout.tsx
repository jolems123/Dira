import './globals.css';
import type { Metadata } from 'next';
import { SessionBootstrap } from '../components/SessionBootstrap';

export const metadata: Metadata = {
  title: 'Dira | Procurement engine',
  description: 'B2B procurement workflow for buyers and suppliers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><SessionBootstrap />{children}</body>
    </html>
  );
}
