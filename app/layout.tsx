import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SVI IP blocklist manager',
  description: 'View, add, and remove IPs from the SVI blocklist. Chat for IP lookup with VirusTotal & AI recommendations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="app-body">{children}</body>
    </html>
  );
}
