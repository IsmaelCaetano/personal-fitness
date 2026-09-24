import type { Metadata } from "next";
import "./globals.css";
import "./fitness.css";
import "./fitness-forms.css";

export const metadata: Metadata = {
  title: "Personal Fitness",
  description: "Seu diário de musculação. Registre cada série e acompanhe sua evolução.",
  manifest: "/manifest.webmanifest",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  appleWebApp: { capable: true, title: "Personal Fitness", statusBarStyle: "black-translucent" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
