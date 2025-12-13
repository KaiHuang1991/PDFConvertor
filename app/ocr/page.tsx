"use client";

import { useState, useEffect } from "react";
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
import { recognizeWithCloudOCR, pdfToImages, type CloudOCRResult } from "@/lib/ocr-cloud";
import { useLanguage } from "@/contexts/LanguageContext";

type ViewMode = "text" | "table" | "stats";
type OCREngine = "local" | "cloud";

export default function OCRPage() {
  const { t } = useLanguage();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OCRResult | OCRResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("text");
  const [enablePreprocessing, setEnablePreprocessing] = useState(true);
  const [enableTableDetection, setEnableTableDetection] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [ocrEngine, setOcrEngine] = useState<OCREngine>("local");
  const [baiduApiAvailable, setBaiduApiAvailable] = useState<boolean | null>(null);

  // 检测百度API是否可用
  useEffect(() => {
    const checkBaiduAPI = async () => {
      try {
        // 使用专门的配置检测端点（不会真正调用 OCR API）
        const response = await fetch("/api/ocr/check-config", {
          method: "GET",
        });
        
        if (!response.ok) {
          throw new Error("检测配置失败");
        }
        
        const data = await response.json();
        const isConfigured = data.configured === true;
        setBaiduApiAvailable(isConfigured);
        
        // 如果配置了，默认使用云端OCR
        if (isConfigured) {
          setOcrEngine("cloud");
          console.log("✅ 检测到百度 OCR API 已配置，默认使用云端 OCR");
        } else {
          console.log("ℹ️  百度 OCR API 未配置，使用本地 OCR");
          if (data.message) {
            console.log(`   提示: ${data.message}`);
          }
        }
      } catch (e: any) {
        setBaiduApiAvailable(false);
        console.log("ℹ️  无法检测百度 OCR API 状态，使用本地 OCR");
        console.log(`   错误: ${e.message || "未知错误"}`);
      }
    };
    
    checkBaiduAPI();
  }, []);

  // 将云端OCR结果转换为本地OCR结果格式
  const convertCloudOCRToLocal = (cloudResult: CloudOCRResult, pageNumber?: number): OCRResult => {
    console.log("开始转换云端OCR结果:", {
      textLength: cloudResult.text?.length || 0,
      confidence: cloudResult.confidence,
      wordsCount: cloudResult.words?.length || 0,
      linesCount: cloudResult.lines?.length || 0,
      tablesCount: cloudResult.tables?.length || 0,
      hasTables: !!cloudResult.tables && cloudResult.tables.length > 0,
      hasPageNumber: pageNumber !== undefined,
    });
    
    // 如果有表格，输出表格信息
    if (cloudResult.tables && cloudResult.tables.length > 0) {
      console.log(`📊 发现 ${cloudResult.tables.length} 个表格:`);
      cloudResult.tables.forEach((table, idx) => {
        console.log(`  表格 ${idx + 1}: ${table.rows?.length || 0} 行, ${table.headers?.length || 0} 个表头`);
      });
    } else {
      console.warn("⚠️  没有表格数据");
    }
    
    const result: OCRResult = {
      text: cloudResult.text || "",
      confidence: cloudResult.confidence || 0,
      pageNumber,
      words: cloudResult.words?.map(w => ({
        text: w.text,
        bbox: w.bbox,
        confidence: w.confidence,
      })),
      lines: cloudResult.lines?.map(l => ({
        text: l.text,
        words: l.words.map(w => ({
          text: w.text,
          bbox: w.bbox,
          confidence: w.confidence,
        })),
        bbox: l.bbox,
      })),
      // 传递表格数据
      tables: cloudResult.tables,
    };
    
    console.log("转换完成:", {
      textLength: result.text.length,
      confidence: result.confidence,
      pageNumber: result.pageNumber,
      tablesCount: result.tables?.length || 0,
      hasTables: !!result.tables && result.tables.length > 0,
    });
    
    // 如果有表格，输出详细信息
    if (result.tables && result.tables.length > 0) {
      console.log(`✅ 表格数据已传递到OCRResult: ${result.tables.length} 个表格`);
    }
    
    return result;
  };

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

      // 【OCR引擎信息】输出当前使用的OCR服务器
      const isCloudOCR = ocrEngine === "cloud" && baiduApiAvailable;
      
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔍 OCR 识别引擎信息");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📄 文件信息:");
      console.log(`   文件名: ${file.name}`);
      console.log(`   文件类型: ${file.type}`);
      console.log(`   文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      if (isCloudOCR) {
        console.log("🖥️  当前使用的 OCR 引擎: 百度云端 OCR");
        console.log("   - 引擎类型: 百度智能云 OCR API");
        console.log("   - 识别语言: 中英文混合");
        console.log("   - 准确率: 95%+ (高精度)");
        console.log("   - 处理速度: 200-500ms (快速)");
        console.log("   - 数据隐私: 需要上传到百度服务器");
      } else {
        console.log("🖥️  当前使用的 OCR 引擎: 本地 OCR (Tesseract.js)");
        console.log("   - 引擎类型: 本地 WebAssembly");
        console.log("   - 识别语言: 简体中文 + 英文");
        console.log("   - 数据隐私: 完全本地处理，不上传服务器");
        console.log("   - 处理方式: 浏览器内处理，保护隐私");
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      if (isCloudOCR) {
        // 使用云端OCR
        if (isPDFFile(file)) {
          console.log("📚 开始PDF云端OCR识别...");
          setProgress(10);
          
          // PDF转图片
          const images = await pdfToImages(file);
          setProgress(30);
          
          const results: OCRResult[] = [];
          const totalPages = images.length;
          
          for (let i = 0; i < images.length; i++) {
            const image = images[i];
            const pageNum = i + 1;
            
            console.log(`正在识别第 ${pageNum}/${totalPages} 页...`);
            setProgress(30 + (i / totalPages) * 60);
            
            try {
              // 启用表格识别：同时调用普通识别和表格识别API，合并结果
              const cloudResult = await recognizeWithCloudOCR(
                image,
                "baidu",
                { enableTable: enableTableDetection } // 启用表格识别
              );
              
              console.log(`第 ${pageNum} 页云端OCR结果:`, {
                text: cloudResult.text?.substring(0, 100) + "...",
                confidence: cloudResult.confidence,
                wordsCount: cloudResult.words?.length || 0,
                linesCount: cloudResult.lines?.length || 0,
              });
              
              const localResult = convertCloudOCRToLocal(cloudResult, pageNum);
              console.log(`第 ${pageNum} 页转换后的结果:`, {
                text: localResult.text?.substring(0, 100) + "...",
                confidence: localResult.confidence,
                pageNumber: localResult.pageNumber,
              });
              
              results.push(localResult);
            } catch (err: any) {
              console.error(`第 ${pageNum} 页识别失败:`, err);
              // 如果云端OCR失败，可以继续处理其他页
              results.push({
                text: `第 ${pageNum} 页识别失败: ${err.message}`,
                confidence: 0,
                pageNumber: pageNum,
              });
            }
          }
          
          ocrResult = results;
          setProgress(100);
        } else if (isImageFile(file)) {
          console.log("🖼️  开始图片云端OCR识别...");
          setProgress(30);
          
          // 启用表格识别：同时调用普通识别和表格识别API，合并结果
          const cloudResult = await recognizeWithCloudOCR(
            file,
            "baidu",
            { enableTable: enableTableDetection } // 启用表格识别
          );
          
          console.log("图片云端OCR结果:", cloudResult);
          
          ocrResult = convertCloudOCRToLocal(cloudResult);
          console.log("转换后的结果:", ocrResult);
          setProgress(100);
        } else {
          throw new Error("不支持的文件格式，请上传PDF或图片文件");
        }
      } else {
        // 使用本地OCR
        if (isPDFFile(file)) {
          console.log("📚 开始PDF本地OCR识别...");
          ocrResult = await recognizePDF(file, (progress) => {
            setProgress(progress);
          }, options);
        } else if (isImageFile(file)) {
          console.log("🖼️  开始图片本地OCR识别...");
          ocrResult = await recognizeImage(file, (progress) => {
            setProgress(progress);
          }, options);
        } else {
          throw new Error("不支持的文件格式，请上传PDF或图片文件");
        }
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
                <span>{t.pages.backToHome}</span>
              </Link>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
              <div className="flex items-center gap-2">
                <Image className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h1 className="text-xl font-bold">{t.ocr.title}</h1>
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
            {t.ocr.subtitle}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t.ocr.description}
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
                    {/* OCR引擎选择 */}
                    <div>
                      <label className="block text-sm font-medium mb-2">OCR 引擎</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setOcrEngine("local")}
                          disabled={processing}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                            ocrEngine === "local"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                          } ${processing ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          本地 OCR
                          <div className="text-xs mt-0.5 opacity-90">免费 · 隐私</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setOcrEngine("cloud")}
                          disabled={processing || !baiduApiAvailable}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                            ocrEngine === "cloud"
                              ? "bg-green-600 text-white"
                              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                          } ${processing || !baiduApiAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
                          title={!baiduApiAvailable ? "百度 API 未配置，请查看 OCR_BAIDU_SETUP.md" : ""}
                        >
                          百度云端 OCR
                          <div className="text-xs mt-0.5 opacity-90">
                            {baiduApiAvailable ? "高精度 · 快速" : "需要配置"}
                          </div>
                        </button>
                      </div>
                      {!baiduApiAvailable && ocrEngine === "cloud" && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                          ⚠️ 百度 OCR API 未配置，请查看 OCR_BAIDU_SETUP.md 进行配置
                        </p>
                      )}
                    </div>
                    
                    {/* 仅在本地OCR时显示这些选项 */}
                    {ocrEngine === "local" && (
                      <>
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
                      </>
                    )}
                    
                    {/* 云端OCR说明 */}
                    {ocrEngine === "cloud" && baiduApiAvailable && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-800 dark:text-green-300">
                        <strong>✅ 百度云端 OCR 已启用</strong>
                        <ul className="mt-1 list-disc list-inside space-y-1 text-xs">
                          <li>识别准确率: 95%+</li>
                          <li>处理速度: 200-500ms</li>
                          <li>支持表格和手写识别</li>
                          <li>数据需要上传到百度服务器</li>
                        </ul>
                      </div>
                    )}
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
                        <span>{t.ocr.processing} {progress > 0 && `${progress}%`}</span>
                      </>
                    ) : (
                      <>
                        <Image className="w-5 h-5" />
                        <span>{t.ocr.startOCR}</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="px-4 py-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                    title={t.ocr.settings}
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
                    <h3 className="text-lg font-semibold">{t.ocr.recognitionResult}</h3>
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
                          {t.ocr.text}
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
                            {t.ocr.table} ({getAllTables().reduce((sum, item) => sum + item.tables.length, 0)})
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
                          {t.ocr.stats}
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

