"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const PDFViewer = dynamic(() => import("@/components/PDFViewer"), { ssr: false });

export default function ViewerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </Link>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">PDF 查看器</h1>
          <p className="text-gray-600 dark:text-gray-400">
            支持上传 PDF、放大缩小、旋转、页面跳转、全文搜索、全屏预览
          </p>
        </div>

        <PDFViewer />
      </div>
    </div>
  );
}

