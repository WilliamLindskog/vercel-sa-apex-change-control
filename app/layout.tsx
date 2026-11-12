import type { Metadata } from "next";
import "./globals.css";
import "./munzing.css";

export const metadata: Metadata = {
  title: "Apex Change Control | SCC-2026-041",
  description: "Supplier change decision workspace POC",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
