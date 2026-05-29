import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TipHouse",
  description: "Production donation platform with PromptPay and realtime OBS alerts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
