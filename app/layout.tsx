import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Animal Chain | A new life in the food chain",
  description: "A real-time multiplayer forest survival game. Spawn as a new animal, complete tasks, and find your place in the food chain.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
