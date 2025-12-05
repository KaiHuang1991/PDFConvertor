import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "AIPDF Pro - AI驱动的PDF工具平台",
  description: "免费、快速、强大的AI PDF工具 - 合并、拆分、压缩、解锁、OCR、智能聊天，完全前端运行，保护隐私",
  keywords: "PDF工具,AI PDF,PDF合并,PDF拆分,PDF压缩,PDF解锁,PDF OCR,PDF聊天",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

