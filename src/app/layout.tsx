import type { Metadata } from "next";
import { Manrope, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const display = Manrope({ subsets: ["latin"], variable: "--font-display" });
const body = Noto_Sans_KR({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Cafe Scout · 숫자로 읽는 카페",
  description: "현장 관찰을 사업성 스냅샷으로 바꾸는 카페 벤치마킹 도구",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
