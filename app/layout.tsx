import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Applyly — Job application tracker",
  description: "A simple, focused workspace for tracking every application.",
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
      <body>{children}</body>
    </html>
  );
}
