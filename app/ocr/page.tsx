"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Image, Loader2, Download } from "lucide-react";
import Link from "next/link";
import FileUploader from "@/components/FileUploader";
import { downloadBlob } from "@/lib/utils";

export default function OCRPage() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOCR = async () => {
    if (uploadedFiles.length === 0) return;

    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      // TODO: 集成PaddleOCR WebAssembly
      // 这里先显示一个占位实现
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // 模拟OCR结果
      setResult(
        "OCR功能正在开发中...\n\n" +
        "计划功能：\n" +
        "1. 支持中文、英文识别\n" +
        "2. 支持手写文字识别\n" +
        "3. 支持表格识别\n" +
        "4. 识别后直接导出Word文档\n\n" +
        "技术方案：PaddleOCR WebAssembly（完全前端运行）"
      );
    } catch (err: any) {
      setError(err.message || "OCR处理失败");
    } finally {
      setProcessing(false);
    }
  };

  const exportToWord = () => {
    if (!result) return;
    
    // 简单的Word导出（实际应该使用docx库）
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, "ocr_result.txt");
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>返回首页</span>
              </Link>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
              <div className="flex items-center gap-2">
                <Image className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h1 className="text-xl font-bold">OCR识别</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            OCR文字识别
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            支持中文、手写、表格识别，识别后直接导出Word - 完全前端运行，保护隐私
          </p>
        </motion.div>

        {/* File Upload */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto mb-12"
        >
          <FileUploader files={uploadedFiles} onFilesChange={setUploadedFiles} />
        </motion.div>

        {/* OCR Section */}
        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              {/* Action Button */}
              <div className="mb-6">
                <button
                  onClick={handleOCR}
                  disabled={processing || uploadedFiles.length === 0}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>正在识别中...</span>
                    </>
                  ) : (
                    <>
                      <Image className="w-5 h-5" />
                      <span>开始OCR识别</span>
                    </>
                  )}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Result */}
              {result && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">识别结果</h3>
                    <button
                      onClick={exportToWord}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>导出Word</span>
                    </button>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono">
                      {result}
                    </pre>
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-300">
                <strong>💡 提示：</strong>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>支持PDF扫描件、图片文件</li>
                  <li>支持中文、英文、手写文字识别</li>
                  <li>支持表格识别和结构化提取</li>
                  <li>所有处理在浏览器中完成，不上传服务器</li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {uploadedFiles.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-6">
              <Image className="w-12 h-12 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              请先上传PDF或图片文件以开始OCR识别
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}

