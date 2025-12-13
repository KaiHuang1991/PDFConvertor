"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Merge,
  Scissors,
  Minimize2,
  Lock,
  Image as ImageIcon,
  Download,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import {
  mergePDFs,
  splitPDF,
  compressPDF,
  unlockPDF,
  addWatermark,
} from "@/lib/pdf-utils";
import { downloadBlob, formatFileSize } from "@/lib/utils";
import WatermarkPreview from "./WatermarkPreview";

interface PDFToolsProps {
  files: File[];
}

export default function PDFTools({ files }: PDFToolsProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [compressProgress, setCompressProgress] = useState(0);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<{ originalSize: number; compressedSize: number } | null>(null);

  // 水印配置
  const [watermarkText, setWatermarkText] = useState("AIPDF Pro");
  const [watermarkRotation, setWatermarkRotation] = useState(-45);
  const [watermarkRows, setWatermarkRows] = useState(2);
  const [watermarkCols, setWatermarkCols] = useState(2);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3);
  const [watermarkFontSize, setWatermarkFontSize] = useState(50);

  // 拆分配置
  const [splitRanges, setSplitRanges] = useState("1-5");

  // 解锁配置
  const [unlockPassword, setUnlockPassword] = useState("");

  const handleMerge = async () => {
    if (files.length < 2) {
      setError(t.pdfTools.atLeast2Files);
      return;
    }
    setLoading("merge");
    setError(null);
    try {
      const blob = await mergePDFs(files);
      downloadBlob(blob, "merged.pdf");
    } catch (err: any) {
      setError(err.message || t.pdfTools.mergeFailed);
    } finally {
      setLoading(null);
    }
  };

  const handleSplit = async () => {
    if (files.length === 0 || !splitRanges.trim()) {
      setError(t.pdfTools.invalidRange);
      return;
    }
    setLoading("split");
    setError(null);
    try {
      const ranges = splitRanges.split(",").map((r) => r.trim());
      const blobs = await splitPDF(files[0], ranges);
      blobs.forEach((blob, idx) => {
        downloadBlob(blob, `split_${idx + 1}.pdf`);
      });
    } catch (err: any) {
      setError(err.message || t.pdfTools.splitFailed);
    } finally {
      setLoading(null);
    }
  };

  const handleCompress = async () => {
    if (files.length === 0) return;
    setLoading("compress");
    setError(null);
    setCompressProgress(0);
    setCompressedBlob(null);
    setCompressionInfo(null);
    
    try {
      const originalSize = files[0].size;
      
      const blob = await compressPDF(files[0], (progress) => {
        setCompressProgress(progress);
      });
      
      const compressedSize = blob.size;
      setCompressedBlob(blob);
      setCompressionInfo({ originalSize, compressedSize });
      setCompressProgress(100);
    } catch (err: any) {
      setError(err.message || t.pdfTools.compressFailed);
      setCompressProgress(0);
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadCompressed = () => {
    if (compressedBlob) {
      downloadBlob(compressedBlob, "compressed.pdf");
    }
  };

  const handleUnlock = async () => {
    if (files.length === 0) return;
    if (!unlockPassword.trim()) {
      setError(t.pdfTools.enterPassword);
      return;
    }
    setLoading("unlock");
    setError(null);
    try {
      const blob = await unlockPDF(files[0], unlockPassword);
      downloadBlob(blob, "unlocked.pdf");
    } catch (err: any) {
      setError(err.message || t.pdfTools.unlockFailed);
    } finally {
      setLoading(null);
    }
  };

  const handleWatermark = async () => {
    if (files.length === 0) return;
    if (!watermarkText.trim()) {
      setError(t.pdfTools.enterWatermarkText);
      return;
    }
    setLoading("watermark");
    setError(null);
    try {
      const blob = await addWatermark(files[0], watermarkText, {
        rotation: watermarkRotation,
        rows: watermarkRows,
        cols: watermarkCols,
        opacity: watermarkOpacity,
        fontSize: watermarkFontSize,
      });
      downloadBlob(blob, "watermarked.pdf");
    } catch (err: any) {
      setError(err.message || t.pdfTools.watermarkFailed);
    } finally {
      setLoading(null);
    }
  };

  const tools = [
    {
      id: "merge",
      icon: Merge,
      title: t.pdfTools.merge,
      desc: t.pdfTools.mergeDesc,
      action: handleMerge,
      disabled: files.length < 2,
    },
    {
      id: "split",
      icon: Scissors,
      title: t.pdfTools.split,
      desc: t.pdfTools.splitDesc,
      action: () => setActiveTool(activeTool === "split" ? null : "split"),
      disabled: files.length === 0,
    },
    {
      id: "compress",
      icon: Minimize2,
      title: t.pdfTools.compress,
      desc: t.pdfTools.compressDesc,
      action: () => setActiveTool(activeTool === "compress" ? null : "compress"),
      disabled: files.length === 0,
    },
    {
      id: "unlock",
      icon: Lock,
      title: t.pdfTools.unlock,
      desc: t.pdfTools.unlockDesc,
      action: () => setActiveTool(activeTool === "unlock" ? null : "unlock"),
      disabled: files.length === 0,
    },
    {
      id: "watermark",
      icon: ImageIcon,
      title: t.pdfTools.watermark,
      desc: t.pdfTools.watermarkDesc,
      action: () => setActiveTool(activeTool === "watermark" ? null : "watermark"),
      disabled: files.length === 0,
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 shadow-md"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span className="font-semibold">{error}</span>
          </div>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isLoading = loading === tool.id;
          const isActive = activeTool === tool.id;

          return (
            <div key={tool.id}>
              <motion.button
                onClick={tool.action}
                disabled={tool.disabled || isLoading}
                whileHover={{ scale: tool.disabled || isLoading ? 1 : 1.02, y: tool.disabled || isLoading ? 0 : -2 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left relative overflow-hidden
                  ${
                    tool.disabled || isLoading
                      ? "border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 cursor-not-allowed opacity-50"
                      : isActive
                      ? "border-blue-500 dark:border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 shadow-lg"
                      : "border-gray-200/50 dark:border-gray-700/50 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-xl cursor-pointer"
                  }
                `}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5"></div>
                )}
                <div className="flex items-start gap-4 relative z-10">
                  <div className={`
                    p-3 rounded-xl transition-all duration-300
                    ${isActive 
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg" 
                      : "bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30"
                    }
                  `}>
                    {isLoading ? (
                      <Loader2 className={`w-6 h-6 animate-spin ${isActive ? "text-white" : "text-blue-600 dark:text-blue-400"}`} />
                    ) : (
                      <Icon className={`w-6 h-6 ${isActive ? "text-white" : "text-blue-600 dark:text-blue-400"}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-bold text-lg mb-1 ${isActive ? "text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-gray-200"}`}>
                      {tool.title}
                    </h4>
                    <p className={`text-sm ${isActive ? "text-blue-600/80 dark:text-blue-400/80" : "text-gray-600 dark:text-gray-400"}`}>
                      {tool.desc}
                    </p>
                  </div>
                  {isActive && (
                    <ChevronUp className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-1" />
                  )}
                </div>
              </motion.button>
            </div>
          );
        })}
      </div>

      {/* 水印配置面板 */}
      <AnimatePresence>
        {activeTool === "watermark" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl border-2 border-blue-200/50 dark:border-blue-800/50 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-gray-800 dark:text-gray-200">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
                      <ImageIcon className="w-5 h-5 text-white" />
                    </div>
                    {t.pdfTools.watermarkSettings}
                  </h3>
                  <button
                    onClick={() => setActiveTool(null)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200 group"
                  >
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 p-6">
                {/* 左侧：配置选项 */}
                <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">{t.pdfTools.watermarkText}</label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                    placeholder={t.pdfTools.enterWatermarkText}
                  />
                </div>

                {/* 旋转角度：滑块和输入框在同一行 */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    {t.pdfTools.rotationAngle}: <span className="text-blue-600 dark:text-blue-400 font-bold">{watermarkRotation}°</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={watermarkRotation}
                      onChange={(e) => setWatermarkRotation(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <input
                      type="number"
                      min="-180"
                      max="180"
                      value={watermarkRotation}
                      onChange={(e) => setWatermarkRotation(Math.max(-180, Math.min(180, Number(e.target.value))))}
                      className="w-20 px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md text-center"
                    />
                  </div>
                </div>

                {/* 行数和列数：放在一行 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                      {t.pdfTools.rows}: <span className="text-blue-600 dark:text-blue-400 font-bold">{watermarkRows}</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={watermarkRows}
                      onChange={(e) => setWatermarkRows(Math.max(1, Math.min(10, Number(e.target.value))))}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                      {t.pdfTools.cols}: <span className="text-blue-600 dark:text-blue-400 font-bold">{watermarkCols}</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={watermarkCols}
                      onChange={(e) => setWatermarkCols(Math.max(1, Math.min(10, Number(e.target.value))))}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                    />
                  </div>
                </div>

                {/* 透明度：滑块和输入框在同一行 */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    {t.pdfTools.opacity}: <span className="text-blue-600 dark:text-blue-400 font-bold">{Math.round(watermarkOpacity * 100)}%</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={watermarkOpacity}
                      onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="10"
                      value={Math.round(watermarkOpacity * 100)}
                      onChange={(e) => setWatermarkOpacity(Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
                      className="w-20 px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md text-center"
                    />
                  </div>
                </div>

                {/* 字体大小 */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">{t.pdfTools.fontSize}</label>
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={watermarkFontSize}
                    onChange={(e) => setWatermarkFontSize(Number(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                  />
                </div>

                  <button
                    onClick={handleWatermark}
                    disabled={loading === "watermark" || !watermarkText.trim()}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:hover:scale-100"
                  >
                    {loading === "watermark" ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t.pdfTools.processing}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        <span>{t.pdfTools.applyAndDownload}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 右侧：实时预览 */}
                <div>
                  <WatermarkPreview
                    text={watermarkText}
                    rotation={watermarkRotation}
                    rows={watermarkRows}
                    cols={watermarkCols}
                    opacity={watermarkOpacity}
                    fontSize={watermarkFontSize}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 拆分配置面板 */}
        {activeTool === "split" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl border-2 border-blue-200/50 dark:border-blue-800/50 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-gray-800 dark:text-gray-200">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
                      <Scissors className="w-5 h-5 text-white" />
                    </div>
                    {t.pdfTools.splitSettings}
                  </h3>
                  <button
                    onClick={() => setActiveTool(null)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200 group"
                  >
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">{t.pdfTools.pageRange}</label>
                  <input
                    type="text"
                    value={splitRanges}
                    onChange={(e) => setSplitRanges(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                    placeholder={t.pdfTools.pageRangeExample}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                    <span>💡</span>
                    {t.pdfTools.pageRangeTip}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSplit}
                    disabled={loading === "split"}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:hover:scale-100"
                  >
                    {loading === "split" ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t.pdfTools.processing}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        <span>{t.pdfTools.splitAndDownload}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 压缩配置面板 */}
        {activeTool === "compress" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl border-2 border-blue-200/50 dark:border-blue-800/50 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-gray-800 dark:text-gray-200">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
                      <Minimize2 className="w-5 h-5 text-white" />
                    </div>
                    {t.pdfTools.compressSettings}
                  </h3>
                  <button
                    onClick={() => {
                      setActiveTool(null);
                      setCompressProgress(0);
                      setCompressedBlob(null);
                      setCompressionInfo(null);
                    }}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200 group"
                  >
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* 文件信息 */}
                {files.length > 0 && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {files[0].name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t.pdfTools.originalSize}: {formatFileSize(files[0].size)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 压缩进度 */}
                {loading === "compress" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {t.pdfTools.compressProgress}
                      </span>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {compressProgress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${compressProgress}%` }}
                        transition={{ duration: 0.3 }}
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                      />
                    </div>
                  </div>
                )}

                {/* 压缩结果 */}
                {compressedBlob && compressionInfo && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
                          {t.pdfTools.compressComplete}
                        </p>
                        <div className="space-y-1 text-xs text-green-700 dark:text-green-300">
                          <p>{t.pdfTools.originalSize}: {formatFileSize(compressionInfo.originalSize)}</p>
                          <p>{t.pdfTools.compressedSize}: {formatFileSize(compressionInfo.compressedSize)}</p>
                          <p className="font-bold">
                            {t.pdfTools.reduce}: {(
                              ((compressionInfo.originalSize - compressionInfo.compressedSize) /
                                compressionInfo.originalSize) *
                              100
                            ).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex gap-3">
                  {!compressedBlob ? (
                    <button
                      onClick={handleCompress}
                      disabled={loading === "compress" || files.length === 0}
                      className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:hover:scale-100"
                    >
                      {loading === "compress" ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>{t.pdfTools.processing}</span>
                        </>
                      ) : (
                        <>
                          <Minimize2 className="w-5 h-5" />
                          <span>{t.pdfTools.startCompress}</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleDownloadCompressed}
                      className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                    >
                      <Download className="w-5 h-5" />
                      <span>{t.pdfTools.downloadCompressed}</span>
                    </button>
                  )}
                </div>

                {/* 提示信息 */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    {t.pdfTools.compressTip}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 解锁配置面板 */}
        {activeTool === "unlock" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl border-2 border-blue-200/50 dark:border-blue-800/50 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-gray-800 dark:text-gray-200">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
                      <Lock className="w-5 h-5 text-white" />
                    </div>
                    {t.pdfTools.unlockSettings}
                  </h3>
                  <button
                    onClick={() => setActiveTool(null)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200 group"
                  >
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">{t.pdfTools.pdfPassword}</label>
                  <input
                    type="password"
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                    placeholder={t.pdfTools.enterPassword}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleUnlock}
                    disabled={loading === "unlock"}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:hover:scale-100"
                  >
                    {loading === "unlock" ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t.pdfTools.processing}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        <span>{t.pdfTools.unlockAndDownload}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/50 shadow-md">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-blue-500 rounded-lg mt-0.5">
            <span className="text-white text-sm">💡</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">隐私保护提示</p>
            <p className="text-sm text-blue-800/80 dark:text-blue-300/80">
              所有操作都在您的浏览器中完成，文件不会上传到服务器，完全保护您的隐私安全。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
