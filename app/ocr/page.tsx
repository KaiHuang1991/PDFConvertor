"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Image, Loader2, Download, Settings, Table2, FileText, BarChart3 } from "lucide-react";
import Link from "next/link";
import FileUploader from "@/components/FileUploader";
import {
  recognizeImage,
  recognizePDF,
  exportToWord,
  detectTables,
  isImageFile,
  isPDFFile,
  type OCRResult,
  type TableData,
} from "@/lib/ocr-utils";

type ViewMode = "text" | "table" | "stats";

export default function OCRPage() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OCRResult | OCRResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("text");
  const [enablePreprocessing, setEnablePreprocessing] = useState(true);
  const [enableTableDetection, setEnableTableDetection] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const handleOCR = async () => {
    if (uploadedFiles.length === 0) return;

    setProcessing(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setViewMode("text");

    try {
      const file = uploadedFiles[0]; // 先处理第一个文件
      let ocrResult: OCRResult | OCRResult[];

      const options = {
        enablePreprocessing,
        enableTableDetection,
      };

      if (isPDFFile(file)) {
        // PDF文件OCR
        ocrResult = await recognizePDF(file, (progress) => {
          setProgress(progress);
        }, options);
      } else if (isImageFile(file)) {
        // 图片文件OCR
        ocrResult = await recognizeImage(file, (progress) => {
          setProgress(progress);
        }, options);
      } else {
        throw new Error("不支持的文件格式，请上传PDF或图片文件");
      }

      setResult(ocrResult);
      
      // 如果检测到表格，自动切换到表格视图
      if (enableTableDetection) {
        const resultsArray = Array.isArray(ocrResult) ? ocrResult : [ocrResult];
        const hasTables = resultsArray.some(r => {
          const tables = detectTables(r);
          return tables.length > 0;
        });
        if (hasTables) {
          setViewMode("table");
        }
      }
    } catch (err: any) {
      setError(err.message || "OCR处理失败");
      console.error("OCR错误:", err);
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const handleExportToWord = async () => {
    if (!result) return;

    try {
      const filename = uploadedFiles[0]
        ? `ocr_${uploadedFiles[0].name.replace(/\.[^/.]+$/, "")}.docx`
        : "ocr_result.docx";
      await exportToWord(result, filename);
    } catch (err: any) {
      setError(err.message || "导出Word失败");
      console.error("导出错误:", err);
    }
  };

  // 格式化显示结果文本
  const getResultText = (): string => {
    if (!result) return "";
    
    if (Array.isArray(result)) {
      // 多页PDF结果
      return result
        .map((r, index) => {
          const pageInfo = r.pageNumber
            ? `\n--- 第 ${r.pageNumber} 页 (置信度: ${r.confidence.toFixed(1)}%) ---\n`
            : `\n--- 页面 ${index + 1} (置信度: ${r.confidence.toFixed(1)}%) ---\n`;
          return pageInfo + r.text;
        })
        .join("\n\n");
    } else {
      // 单页结果
      return `置信度: ${result.confidence.toFixed(1)}%\n\n${result.text}`;
    }
  };

  // 获取所有表格
  const getAllTables = (): { result: OCRResult; tables: TableData[]; pageNumber?: number }[] => {
    if (!result) return [];
    
    const resultsArray = Array.isArray(result) ? result : [result];
    return resultsArray.map(r => ({
      result: r,
      tables: detectTables(r),
      pageNumber: r.pageNumber,
    })).filter(item => item.tables.length > 0);
  };

  // 获取统计信息
  const getStats = () => {
    if (!result) return null;
    
    const resultsArray = Array.isArray(result) ? result : [result];
    const totalPages = resultsArray.length;
    const avgConfidence = resultsArray.reduce((sum, r) => sum + r.confidence, 0) / totalPages;
    const totalChars = resultsArray.reduce((sum, r) => sum + r.text.length, 0);
    const totalWords = resultsArray.reduce((sum, r) => sum + r.text.split(/\s+/).filter(w => w.length > 0).length, 0);
    const totalTables = resultsArray.reduce((sum, r) => sum + detectTables(r).length, 0);
    
    return {
      totalPages,
      avgConfidence: avgConfidence.toFixed(1),
      totalChars,
      totalWords,
      totalTables,
    };
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
              {/* Settings Panel */}
              {showSettings && (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    识别设置
                  </h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enablePreprocessing}
                        onChange={(e) => setEnablePreprocessing(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm">启用图片预处理（提高准确度，但处理时间更长）</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableTableDetection}
                        onChange={(e) => setEnableTableDetection(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm">启用表格检测（自动识别表格结构）</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="mb-6">
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={handleOCR}
                    disabled={processing || uploadedFiles.length === 0}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>正在识别中... {progress > 0 && `${progress}%`}</span>
                      </>
                    ) : (
                      <>
                        <Image className="w-5 h-5" />
                        <span>开始OCR识别</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="px-4 py-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                    title="设置"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Progress Bar */}
                {processing && progress > 0 && (
                  <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
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
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-lg font-semibold">识别结果</h3>
                    <div className="flex items-center gap-2">
                      {/* View Mode Tabs */}
                      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <button
                          onClick={() => setViewMode("text")}
                          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                            viewMode === "text"
                              ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                          }`}
                        >
                          <FileText className="w-4 h-4 inline mr-1" />
                          文本
                        </button>
                        {getAllTables().length > 0 && (
                          <button
                            onClick={() => setViewMode("table")}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                              viewMode === "table"
                                ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                            }`}
                          >
                            <Table2 className="w-4 h-4 inline mr-1" />
                            表格 ({getAllTables().reduce((sum, item) => sum + item.tables.length, 0)})
                          </button>
                        )}
                        <button
                          onClick={() => setViewMode("stats")}
                          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                            viewMode === "stats"
                              ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                          }`}
                        >
                          <BarChart3 className="w-4 h-4 inline mr-1" />
                          统计
                        </button>
                      </div>
                      <button
                        onClick={handleExportToWord}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      >
                        <Download className="w-4 h-4" />
                        <span>导出Word</span>
                      </button>
                    </div>
                  </div>

                  {/* Text View */}
                  {viewMode === "text" && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono">
                        {getResultText()}
                      </pre>
                    </div>
                  )}

                  {/* Table View */}
                  {viewMode === "table" && (
                    <div className="space-y-6">
                      {getAllTables().map((item, idx) => (
                        <div key={idx} className="space-y-2">
                          {item.pageNumber && (
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              第 {item.pageNumber} 页 - 表格 {idx + 1}
                            </h4>
                          )}
                          {item.tables.map((table, tableIdx) => (
                            <div
                              key={tableIdx}
                              className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg"
                            >
                              <table className="w-full text-sm">
                                {table.headers && table.headers.length > 0 && (
                                  <thead className="bg-gray-100 dark:bg-gray-800">
                                    <tr>
                                      {table.headers.map((header, hIdx) => (
                                        <th
                                          key={hIdx}
                                          className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700"
                                        >
                                          {header}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                )}
                                <tbody>
                                  {table.rows.map((row, rIdx) => (
                                    <tr
                                      key={rIdx}
                                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    >
                                      {row.map((cell, cIdx) => (
                                        <td
                                          key={cIdx}
                                          className="px-4 py-2 text-gray-800 dark:text-gray-200"
                                        >
                                          {cell || "-"}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      ))}
                      {getAllTables().length === 0 && (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                          未检测到表格
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stats View */}
                  {viewMode === "stats" && (
                    <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                      {getStats() && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                              {getStats()!.totalPages}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">总页数</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {getStats()!.avgConfidence}%
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">平均置信度</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                              {getStats()!.totalChars.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">总字符数</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                              {getStats()!.totalWords.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">总词数</div>
                          </div>
                          {getStats()!.totalTables > 0 && (
                            <div className="text-center col-span-2 md:col-span-4">
                              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                {getStats()!.totalTables}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">检测到的表格数</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
              支持格式：PDF、PNG、JPG、JPEG、WEBP等
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}

