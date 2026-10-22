import type { Metadata } from 'next';
import { AppProviders } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Loja Suzano — Escolhas que renovam o seu dia',
  description:
    'Explore papéis, embalagens e produtos de higiene do portfólio Suzano. Loja de demonstração.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
