"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Image as ImageIcon,
  FileText,
  Globe,
  Download,
  Loader2,
  CheckCircle2,
  X,
  Settings,
  FileImage,
  FileType,
} from "lucide-react";
import {
  pdfToImages,
  pdfToText,
  pdfToHTML,
  pdfToWord,
  downloadFile,
  downloadImages,
  PDFToImageOptions,
  PDFToHTMLOptions,
  PDFToWordOptions,
} from "@/lib/pdf-convert";

interface PDFConverterProps {
  file: File;
}

type ConvertFormat = "image" | "text" | "html" | "word";

export default function PDFConverter({ file }: PDFConverterProps) {
  const { t } = useLanguage();
  const [activeFormat, setActiveFormat] = useState<ConvertFormat | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 图片转换选项
  const [imageFormat, setImageFormat] = useState<"png" | "jpg">("png");
  const [imageScale, setImageScale] = useState(2.0);
  const [imageQuality, setImageQuality] = useState(0.9);

  // HTML 转换选项
  const [htmlIncludeImages, setHtmlIncludeImages] = useState(true);
  const [htmlImageFormat, setHtmlImageFormat] = useState<"png" | "jpg">("png");

  // Word 转换选项
  const [wordPreserveFormatting, setWordPreserveFormatting] = useState(true);
  const [wordPreserveLayout, setWordPreserveLayout] = useState(true);
  const [wordIncludeImages, setWordIncludeImages] = useState(true);

  const handleConvertToImages = async () => {
    setActiveFormat("image");
    setLoading(true);
    setError(null);
    setSuccess(null);
    setProgress({ current: 0, total: 0 });

    try {
      const options: PDFToImageOptions = {
        format: imageFormat,
        scale: imageScale,
        quality: imageQuality,
      };

      const images = await pdfToImages(
        file,
        options,
        (current, total) => {
          setProgress({ current, total });
        }
      );

      // 下载所有图片
      const baseName = file.name.replace(/\.pdf$/i, "");
      await downloadImages(images, baseName, imageFormat);

      setSuccess(t.pdfConverter.imagesSuccess.replace('{count}', images.length.toString()));
    } catch (err: any) {
      setError(err.message || t.pdfConverter.convertFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToText = async () => {
    setActiveFormat("text");
    setLoading(true);
    setError(null);
    setSuccess(null);
    setProgress({ current: 0, total: 0 });

    try {
      const text = await pdfToText(file, (current, total) => {
        setProgress({ current, total });
      });

      // 创建文本文件并下载
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const filename = file.name.replace(/\.pdf$/i, ".txt");
      await downloadFile(blob, filename);

      setSuccess(t.pdfConverter.textSuccess);
    } catch (err: any) {
      setError(err.message || t.pdfConverter.convertFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToHTML = async () => {
    setActiveFormat("html");
    setLoading(true);
    setError(null);
    setSuccess(null);
    setProgress({ current: 0, total: 0 });

    try {
      const options: PDFToHTMLOptions = {
        includeImages: htmlIncludeImages,
        imageFormat: htmlImageFormat,
        imageScale: 1.5,
      };

      const html = await pdfToHTML(file, options, (current, total) => {
        setProgress({ current, total });
      });

      // 创建 HTML 文件并下载
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const filename = file.name.replace(/\.pdf$/i, ".html");
      await downloadFile(blob, filename);

      setSuccess(t.pdfConverter.htmlSuccess);
    } catch (err: any) {
      setError(err.message || t.pdfConverter.convertFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToWord = async () => {
    setActiveFormat("word");
    setLoading(true);
    setError(null);
    setSuccess(null);
    setProgress({ current: 0, total: 0 });

    try {
      const options: PDFToWordOptions = {
        preserveFormatting: wordPreserveFormatting,
        preserveLayout: wordPreserveLayout,
        includeImages: wordIncludeImages,
        imageScale: 1.5,
      };

      await pdfToWord(file, options, (current, total) => {
        setProgress({ current, total });
      });

      setSuccess(t.pdfConverter.wordSuccess);
    } catch (err: any) {
      setError(err.message || t.pdfConverter.convertFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 格式选择卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PDF 转图片 */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative p-6 rounded-xl border-2 transition-all cursor-pointer ${
            activeFormat === "image"
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300"
          }`}
          onClick={() => setActiveFormat(activeFormat === "image" ? null : "image")}
        >
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ImageIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
              {t.pdfConverter.toImage}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t.pdfConverter.toImageDesc}
            </p>
          </div>
        </motion.div>

        {/* PDF 转文本 */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative p-6 rounded-xl border-2 transition-all cursor-pointer ${
            activeFormat === "text"
              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-green-300"
          }`}
          onClick={() => setActiveFormat(activeFormat === "text" ? null : "text")}
        >
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <FileText className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
              {t.pdfConverter.toText}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t.pdfConverter.toTextDesc}
            </p>
          </div>
        </motion.div>

        {/* PDF 转 HTML */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative p-6 rounded-xl border-2 transition-all cursor-pointer ${
            activeFormat === "html"
              ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300"
          }`}
          onClick={() => setActiveFormat(activeFormat === "html" ? null : "html")}
        >
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Globe className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
              {t.pdfConverter.toHTML}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t.pdfConverter.toHTMLDesc}
            </p>
          </div>
        </motion.div>

        {/* PDF 转 Word */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative p-6 rounded-xl border-2 transition-all cursor-pointer ${
            activeFormat === "word"
              ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300"
          }`}
          onClick={() => setActiveFormat(activeFormat === "word" ? null : "word")}
        >
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <FileType className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
              {t.pdfConverter.toWord}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t.pdfConverter.toWordDesc}
            </p>
          </div>
        </motion.div>
      </div>

      {/* 转换选项和操作 */}
      {activeFormat && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
        >
          {/* 图片转换选项 */}
          {activeFormat === "image" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                  {t.pdfConverter.imageSettings}
                </h4>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t.pdfConverter.imageFormat}
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setImageFormat("png")}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        imageFormat === "png"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      PNG
                    </button>
                    <button
                      onClick={() => setImageFormat("jpg")}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        imageFormat === "jpg"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      JPG
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t.pdfConverter.scale}: {imageScale}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={imageScale}
                    onChange={(e) => setImageScale(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{t.pdfConverter.lowQuality}</span>
                    <span>{t.pdfConverter.recommended}</span>
                    <span>{t.pdfConverter.highQuality}</span>
                  </div>
                </div>

                {imageFormat === "jpg" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t.pdfConverter.jpegQuality}: {Math.round(imageQuality * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={imageQuality}
                      onChange={(e) =>
                        setImageQuality(parseFloat(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>
                )}

                <button
                  onClick={handleConvertToImages}
                  disabled={loading}
                  className="w-full mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>
                        {t.pdfConverter.converting} ({progress.current}/{progress.total})
                      </span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>{t.pdfConverter.convertToImages}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 文本转换选项 */}
          {activeFormat === "text" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                  {t.pdfConverter.textExtraction}
                </h4>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t.pdfConverter.textExtractionDesc}
              </p>

              <button
                onClick={handleConvertToText}
                disabled={loading}
                className="w-full mt-4 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>
                      {t.pdfConverter.converting} ({progress.current}/{progress.total})
                    </span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>{t.pdfConverter.convertToText}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* HTML 转换选项 */}
          {activeFormat === "html" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-purple-600" />
                <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                  {t.pdfConverter.htmlSettings}
                </h4>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="includeImages"
                    checked={htmlIncludeImages}
                    onChange={(e) => setHtmlIncludeImages(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <label
                    htmlFor="includeImages"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t.pdfConverter.includeImages}
                  </label>
                </div>

                {htmlIncludeImages && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t.pdfConverter.imageFormat}
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setHtmlImageFormat("png")}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                          htmlImageFormat === "png"
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                      >
                        PNG
                      </button>
                      <button
                        onClick={() => setHtmlImageFormat("jpg")}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                          htmlImageFormat === "jpg"
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                      >
                        JPG
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleConvertToHTML}
                  disabled={loading}
                  className="w-full mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>
                        {t.pdfConverter.converting} ({progress.current}/{progress.total})
                      </span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>{t.pdfConverter.convertToHTML}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Word 转换选项 */}
          {activeFormat === "word" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FileType className="w-5 h-5 text-orange-600" />
                <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                  {t.pdfConverter.wordSettings}
                </h4>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t.pdfConverter.toWordDesc}
                </p>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="preserveFormatting"
                    checked={wordPreserveFormatting}
                    onChange={(e) => setWordPreserveFormatting(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                  <label
                    htmlFor="preserveFormatting"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t.pdfConverter.preserveFormattingFull}
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="preserveLayout"
                    checked={wordPreserveLayout}
                    onChange={(e) => setWordPreserveLayout(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                  <label
                    htmlFor="preserveLayout"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t.pdfConverter.preserveLayoutFull}
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="wordIncludeImages"
                    checked={wordIncludeImages}
                    onChange={(e) => setWordIncludeImages(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                  <label
                    htmlFor="wordIncludeImages"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t.pdfConverter.includeImages}
                  </label>
                </div>

                <button
                  onClick={handleConvertToWord}
                  disabled={loading}
                  className="w-full mt-4 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>
                        {t.pdfConverter.converting} ({progress.current}/{progress.total})
                      </span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>{t.pdfConverter.convertToWord}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2"
            >
              <X className="w-5 h-5 text-red-600" />
              <span className="text-sm text-red-700 dark:text-red-400">
                {error}
              </span>
            </motion.div>
          )}

          {/* 成功提示 */}
          {success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-700 dark:text-green-400">
                {success}
              </span>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

