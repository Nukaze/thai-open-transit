// apps/web/app/layout.tsx
import type { ReactNode } from 'react';

export const metadata = {
  title: 'BangkokOpenTransit',
  description: "Bangkok's rail transit network as an open, structured dataset.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
