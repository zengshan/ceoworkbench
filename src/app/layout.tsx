import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CEO Workbench",
  description: "A CEO operating system for a one-person AI company.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
