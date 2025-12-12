"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import AdobeOCRConverter from "@/components/AdobeOCRConverter";

export default function AdobePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/50 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">返回首页</span>
              </Link>
              <div className="h-6 w-px bg-gray-300/50 dark:bg-gray-700/50" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Adobe PDF 服务
                </h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
            <span className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              使用 Adobe 专业 PDF 服务
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
            Adobe PDF 服务
          </h2>
          <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            使用 Adobe PDF Services API 提供的高质量 OCR 和转换服务
            <br className="hidden md:block" />
            <span className="text-purple-600 dark:text-purple-400 font-semibold">
              专业级识别和转换精度
            </span>
          </p>
        </motion.div>

        {/* Adobe Converter Component */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-6xl mx-auto"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 md:p-8">
            <AdobeOCRConverter />
          </div>
        </motion.div>

        {/* Features Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-4xl mx-auto mt-12"
        >
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                  OCR 识别
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                将扫描的 PDF 文档转换为可搜索的 PDF，保留原始图像质量，添加不可见的文本层，支持多种语言识别。
              </p>
            </div>

            <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                  格式转换
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                支持将 PDF 转换为 Word、PowerPoint、Excel、RTF 和图片格式，保持原始布局和格式，转换质量高。
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="max-w-4xl mx-auto mt-12 p-6 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800"
        >
          <h4 className="font-semibold text-purple-900 dark:text-purple-200 mb-3">
            💡 使用提示：
          </h4>
          <ul className="space-y-2 text-sm text-purple-800 dark:text-purple-300">
            <li>
              • <strong>配置要求：</strong>使用前需要配置 Adobe API 凭证，请查看{" "}
              <a
                href="/ADOBE_API_SETUP.md"
                target="_blank"
                className="underline hover:text-purple-600 dark:hover:text-purple-400"
              >
                ADOBE_API_SETUP.md
              </a>{" "}
              了解详细配置步骤
            </li>
            <li>
              • <strong>OCR 识别：</strong>适用于扫描的 PDF 文档，可以提取文本内容并创建可搜索的 PDF
            </li>
            <li>
              • <strong>格式转换：</strong>支持多种办公文档格式，转换后保持原始布局和格式
            </li>
            <li>
              • <strong>服务优势：</strong>Adobe 提供专业级的识别和转换精度，适合高质量文档处理需求
            </li>
          </ul>
        </motion.div>
      </main>
    </div>
  );
}


