"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const PDFEditor = dynamic(() => import("@/components/PDFEditor"), { ssr: false });

export default function EditorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="p-6">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </Link>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">PDF 编辑器</h1>
            <p className="text-gray-600 dark:text-gray-400">
              支持图像/形状插入、注释标记、页面管理、表单填写、签名添加等功能
            </p>
          </div>
        </div>
        <PDFEditor />
      </div>
    </div>
  );
}

