
import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zombie Corridor | Endless Survival',
  description: 'An intense first-person survival experience in an endless emergency facility.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground overflow-hidden select-none">
        {children}
      </body>
    </html>
  );
}
