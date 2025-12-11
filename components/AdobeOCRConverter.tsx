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

type ConvertFormat = "ocr" | "docx" | "pptx" | "xlsx" | "rtf" | "jpg" | "png" | "word-to-pdf" | "office-to-pdf";

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
      
      // Word转PDF或Office转PDF
      if (format === "word-to-pdf" || format === "office-to-pdf") {
        setProgress(30);

        const response = await fetch("/api/adobe/create-pdf", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "转 PDF 失败");
        }

        setProgress(70);

        // 下载结果文件
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const baseName = file.name.replace(/\.[^.]+$/, "");
        a.download = `${baseName}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setProgress(100);
        setSuccess("转换成功！已下载 PDF 文件");
      } else {
        // PDF转其他格式
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📤 [前端调试] 开始PDF转Word请求");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("文件信息:");
        console.log("  - 文件名:", file.name);
        console.log("  - 文件大小:", file.size, "bytes");
        console.log("  - 文件类型:", file.type);
        console.log("  - 目标格式:", format);
        
        formData.append("format", format);

        setProgress(30);
        console.log("⏳ 发送请求到 /api/adobe/convert...");

        const response = await fetch("/api/adobe/convert", {
          method: "POST",
          body: formData,
        });

        console.log("📥 收到响应:");
        console.log("  - 状态码:", response.status);
        console.log("  - 状态文本:", response.statusText);
        console.log("  - Content-Type:", response.headers.get("Content-Type"));
        console.log("  - Content-Length:", response.headers.get("Content-Length"));
        console.log("  - Content-Disposition:", response.headers.get("Content-Disposition"));

        if (!response.ok) {
          const errorData = await response.json();
          console.error("❌ API返回错误:", errorData);
          throw new Error(errorData.error || "转换失败");
        }

        setProgress(70);
        console.log("📥 开始读取响应Blob...");

        // 下载结果文件
        const blob = await response.blob();
        console.log("✅ Blob创建成功:");
        console.log("  - Blob大小:", blob.size, "bytes");
        console.log("  - Blob类型:", blob.type);
        
        if (blob.size === 0) {
          console.error("❌ Blob大小为0，文件为空！");
          throw new Error("下载的文件为空，可能是转换失败");
        }
        
        // 检查Blob内容（仅用于调试）
        if (format === 'docx') {
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const header = Array.from(uint8Array.slice(0, 4))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          console.log("  - 文件头(hex):", header);
          if (header === '504b0304') {
            console.log("✅ DOCX文件头验证通过 (ZIP格式)");
          } else {
            console.warn("⚠️ 警告: DOCX文件头不正确");
            console.warn("  期望: 504b0304 (ZIP格式)");
            console.warn("  实际:", header);
          }
        }

        console.log("📥 创建下载链接...");
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const extension = format;
        const baseName = file.name.replace(/\.pdf$/i, "");
        a.download = `${baseName}.${extension}`;
        console.log("  - 下载文件名:", a.download);
        
        document.body.appendChild(a);
        console.log("🖱️ 触发下载...");
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log("✅ 下载完成");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        setProgress(100);
        setSuccess(`转换成功！已下载 ${format.toUpperCase()} 文件`);
      }
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
    {
      id: "word-to-pdf",
      name: "Word 转 PDF",
      description: "将 Word 文档转换为 PDF",
      icon: FileType,
      color: "indigo",
    },
    {
      id: "office-to-pdf",
      name: "Office 转 PDF",
      description: "将 Office 文档转换为 PDF",
      icon: FileType,
      color: "teal",
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
      <FileUploader 
        files={uploadedFiles} 
        onFilesChange={setUploadedFiles}
        accept={activeFormat === "word-to-pdf" || activeFormat === "office-to-pdf" 
          ? ".docx,.doc,.pptx,.ppt,.xlsx,.xls,.rtf,.txt,.html,.htm" 
          : ".pdf"}
      />

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
            indigo: isActive
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-indigo-300",
            teal: isActive
              ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-teal-300",
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
                } else if (format.id === "word-to-pdf" || format.id === "office-to-pdf") {
                  // 检查文件类型
                  const file = uploadedFiles[0];
                  if (!file) return;
                  
                  const fileName = file.name.toLowerCase();
                  const isWord = fileName.endsWith('.docx') || fileName.endsWith('.doc');
                  const isOffice = fileName.endsWith('.pptx') || fileName.endsWith('.xlsx') || 
                                   fileName.endsWith('.ppt') || fileName.endsWith('.xls') ||
                                   fileName.endsWith('.rtf') || fileName.endsWith('.txt') ||
                                   fileName.endsWith('.html') || fileName.endsWith('.htm');
                  
                  if (format.id === "word-to-pdf" && !isWord) {
                    setError("请上传 Word 文档 (.docx 或 .doc)");
                    return;
                  }
                  
                  if (format.id === "office-to-pdf" && !isOffice && !isWord) {
                    setError("请上传 Office 文档 (.docx, .pptx, .xlsx, .rtf, .txt, .html)");
                    return;
                  }
                  
                  handleConvert(format.id);
                } else {
                  // PDF转其他格式，检查是否为PDF
                  const file = uploadedFiles[0];
                  if (!file) return;
                  
                  const fileName = file.name.toLowerCase();
                  if (!fileName.endsWith('.pdf') && file.type !== 'application/pdf') {
                    setError("请上传 PDF 文件");
                    return;
                  }
                  
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
                      :                     format.color === "pink"
                      ? "bg-pink-100 dark:bg-pink-900/30"
                      : format.color === "cyan"
                      ? "bg-cyan-100 dark:bg-cyan-900/30"
                      : format.color === "indigo"
                      ? "bg-indigo-100 dark:bg-indigo-900/30"
                      : format.color === "teal"
                      ? "bg-teal-100 dark:bg-teal-900/30"
                      : "bg-gray-100 dark:bg-gray-900/30"
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
          <li>支持将 Word、Office 文档转换为 PDF</li>
          <li>需要配置 Adobe API 凭证才能使用</li>
        </ul>
      </div>
    </div>
  );
}

