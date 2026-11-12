import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apex | Supplier change control",
  description: "A decision workspace for evidence-led supplier change review.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
