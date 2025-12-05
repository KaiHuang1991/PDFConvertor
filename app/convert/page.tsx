"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, X } from "lucide-react";
import Link from "next/link";
import FileUploader from "@/components/FileUploader";
import PDFConverter from "@/components/PDFConverter";

export default function ConvertPage() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleFilesChange = (files: File[]) => {
    // 只保留 PDF 文件
    const pdfFiles = files.filter((file) => file.type === "application/pdf");
    setUploadedFiles(pdfFiles);
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

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
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  PDF格式转换
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              完全本地处理，保护隐私
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            PDF 格式转换工具
          </h2>
          <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            支持 PDF 转图片、文本、HTML 等多种格式
            <br className="hidden md:block" />
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              所有转换在浏览器中完成
            </span>
            ，无需上传服务器
          </p>
        </motion.div>

        {/* File Upload */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto mb-8"
        >
          <FileUploader
            files={uploadedFiles}
            onFilesChange={handleFilesChange}
            accept="application/pdf"
          />
        </motion.div>

        {/* Convert Tools */}
        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-6xl mx-auto space-y-6"
          >
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                        {file.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="p-2 text-gray-400 hover:text-red-600 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <PDFConverter file={file} />
              </div>
            ))}
          </motion.div>
        )}

        {/* Empty State */}
        {uploadedFiles.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 mb-6 shadow-lg">
              <FileText className="w-14 h-14 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
              准备转换 PDF
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              请先上传 PDF 文件以开始格式转换
            </p>
          </motion.div>
        )}

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="max-w-4xl mx-auto mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800"
        >
          <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-3">
            💡 使用提示：
          </h4>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
            <li>
              • <strong>PDF 转图片：</strong>支持 PNG 和 JPG 格式，可调整缩放比例和质量
            </li>
            <li>
              • <strong>PDF 转文本：</strong>自动提取 PDF 中的所有文本内容
            </li>
            <li>
              • <strong>PDF 转 HTML：</strong>生成包含文本和图片的 HTML 文件，可在浏览器中查看
            </li>
            <li>
              • 所有转换操作在本地浏览器中完成，不会上传文件到服务器，保护您的隐私
            </li>
          </ul>
        </motion.div>
      </main>
    </div>
  );
}

