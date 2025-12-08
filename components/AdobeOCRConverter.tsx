"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  X,
  Settings,
  FileImage,
  Image as ImageIcon,
  FileType,
} from "lucide-react";
import FileUploader from "@/components/FileUploader";

type ConvertFormat = "ocr" | "docx" | "pptx" | "xlsx" | "rtf" | "jpg" | "png";

export default function AdobeOCRConverter() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [activeFormat, setActiveFormat] = useState<ConvertFormat | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adobeConfigured, setAdobeConfigured] = useState<boolean | null>(null);

  // 检测 Adobe API 配置
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const response = await fetch("/api/adobe/ocr");
        const data = await response.json();
        setAdobeConfigured(data.configured === true);
      } catch (error) {
        setAdobeConfigured(false);
      }
    };
    checkConfig();
  }, []);

  const handleOCR = async () => {
    if (uploadedFiles.length === 0) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setProgress(0);
    setActiveFormat("ocr");

    try {
      const file = uploadedFiles[0];
      const formData = new FormData();
      formData.append("file", file);

      setProgress(30);

      const response = await fetch("/api/adobe/ocr", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "OCR 处理失败");
      }

      setProgress(70);

      // 下载结果文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ocr_${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress(100);
      setSuccess("OCR 处理成功！已下载可搜索的 PDF 文件");
    } catch (err: any) {
      setError(err.message || "OCR 处理失败");
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleConvert = async (format: ConvertFormat) => {
    if (uploadedFiles.length === 0 || format === "ocr") return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setProgress(0);
    setActiveFormat(format);

    try {
      const file = uploadedFiles[0];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("format", format);

      setProgress(30);

      const response = await fetch("/api/adobe/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "转换失败");
      }

      setProgress(70);

      // 下载结果文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const extension = format;
      const baseName = file.name.replace(/\.pdf$/i, "");
      a.download = `${baseName}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress(100);
      setSuccess(`转换成功！已下载 ${format.toUpperCase()} 文件`);
    } catch (err: any) {
      setError(err.message || "转换失败");
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const formats: Array<{
    id: ConvertFormat;
    name: string;
    description: string;
    icon: any;
    color: string;
  }> = [
    {
      id: "ocr",
      name: "OCR 识别",
      description: "将扫描的 PDF 转换为可搜索的 PDF",
      icon: FileText,
      color: "blue",
    },
    {
      id: "docx",
      name: "PDF 转 Word",
      description: "转换为 Microsoft Word 文档",
      icon: FileType,
      color: "blue",
    },
    {
      id: "pptx",
      name: "PDF 转 PowerPoint",
      description: "转换为 Microsoft PowerPoint 演示文稿",
      icon: FileType,
      color: "orange",
    },
    {
      id: "xlsx",
      name: "PDF 转 Excel",
      description: "转换为 Microsoft Excel 电子表格",
      icon: FileType,
      color: "green",
    },
    {
      id: "rtf",
      name: "PDF 转 RTF",
      description: "转换为 RTF 富文本格式",
      icon: FileText,
      color: "purple",
    },
    {
      id: "jpg",
      name: "PDF 转 JPG",
      description: "转换为 JPEG 图片",
      icon: ImageIcon,
      color: "pink",
    },
    {
      id: "png",
      name: "PDF 转 PNG",
      description: "转换为 PNG 图片",
      icon: ImageIcon,
      color: "cyan",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 配置提示 */}
      {adobeConfigured === false && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            ⚠️ Adobe API 未配置。请查看 ADOBE_API_SETUP.md 进行配置。
          </p>
        </div>
      )}

      {/* 文件上传 */}
      <FileUploader files={uploadedFiles} onFilesChange={setUploadedFiles} />

      {/* 格式选择卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {formats.map((format) => {
          const Icon = format.icon;
          const isActive = activeFormat === format.id;
          const colorClasses = {
            blue: isActive
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-blue-300",
            orange: isActive
              ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-orange-300",
            green: isActive
              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-green-300",
            purple: isActive
              ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-purple-300",
            pink: isActive
              ? "border-pink-500 bg-pink-50 dark:bg-pink-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-pink-300",
            cyan: isActive
              ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-cyan-300",
          };

          return (
            <motion.div
              key={format.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative p-6 rounded-xl border-2 transition-all cursor-pointer ${
                colorClasses[format.color as keyof typeof colorClasses]
              } bg-white dark:bg-gray-800`}
              onClick={() => {
                if (format.id === "ocr") {
                  handleOCR();
                } else {
                  handleConvert(format.id);
                }
              }}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div
                  className={`p-3 rounded-lg ${
                    format.color === "blue"
                      ? "bg-blue-100 dark:bg-blue-900/30"
                      : format.color === "orange"
                      ? "bg-orange-100 dark:bg-orange-900/30"
                      : format.color === "green"
                      ? "bg-green-100 dark:bg-green-900/30"
                      : format.color === "purple"
                      ? "bg-purple-100 dark:bg-purple-900/30"
                      : format.color === "pink"
                      ? "bg-pink-100 dark:bg-pink-900/30"
                      : "bg-cyan-100 dark:bg-cyan-900/30"
                  }`}
                >
                  <Icon className="w-8 h-8" />
                </div>
                <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                  {format.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {format.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 进度和状态 */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-800 dark:text-gray-200">
              处理中... {progress > 0 && `${progress}%`}
            </span>
          </div>
          {progress > 0 && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </motion.div>
      )}

      {/* 错误提示 */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2"
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
          className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-400">
            {success}
          </span>
        </motion.div>
      )}

      {/* 提示信息 */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-300">
        <strong>💡 提示：</strong>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li>Adobe API 提供高质量的 OCR 和转换服务</li>
          <li>OCR 功能可将扫描的 PDF 转换为可搜索的文档</li>
          <li>支持将 PDF 转换为 Word、PowerPoint、Excel、RTF、图片等格式</li>
          <li>需要配置 Adobe API 凭证才能使用</li>
        </ul>
      </div>
    </div>
  );
}

