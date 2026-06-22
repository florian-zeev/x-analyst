import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "X Analyst",
  description: "A daily AI brief from curated X sources and linked articles."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
