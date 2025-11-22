"use client";

import { useCallback, useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatFileSize } from "@/lib/utils";

interface FileUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export default function FileUploader({ files, onFilesChange }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (file) => file.type === "application/pdf"
      );
      onFilesChange([...files, ...droppedFiles]);
    },
    [files, onFilesChange]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []).filter(
        (file) => file.type === "application/pdf"
      );
      onFilesChange([...files, ...selectedFiles]);
    },
    [files, onFilesChange]
  );

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = files.filter((_, i) => i !== index);
      onFilesChange(newFiles);
    },
    [files, onFilesChange]
  );

  return (
    <div className="w-full">
      {/* Upload Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300
          ${isDragging 
            ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-lg scale-[1.02]" 
            : "border-gray-300/50 dark:border-gray-700/50 hover:border-blue-400/50 dark:hover:border-blue-600/50"
          }
          ${files.length === 0 
            ? "bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-md" 
            : "bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm"
          }
        `}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleFileInput}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center gap-5"
        >
          <div className={`
            p-6 rounded-2xl transition-all duration-300
            ${isDragging 
              ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl scale-110" 
              : "bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30"
            }
          `}>
            <Upload
              className={`w-12 h-12 transition-all duration-300 ${
                isDragging ? "text-white" : "text-blue-600 dark:text-blue-400"
              }`}
            />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">
              拖拽PDF文件到这里，或{" "}
              <span className="text-blue-600 dark:text-blue-400 font-bold">点击选择文件</span>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              支持多个PDF文件 • 完全前端处理 • 保护隐私
            </p>
          </div>
        </label>
      </div>

      {/* File List */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-6 space-y-2"
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
              已上传的文件 <span className="text-blue-600 dark:text-blue-400">({files.length})</span>
            </h3>
            {files.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center justify-between p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-md border border-gray-200/50 dark:border-gray-700/50 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="ml-4 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200 group"
                  aria-label="删除文件"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

