import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediAssist — Multilingual Medical Assistant",
  description:
    "Ask medical questions in English, Kinyarwanda, or Taita. Powered by Knowledge Graph + AI.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
