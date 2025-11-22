"use client";

import { useEffect, useRef, useState } from "react";

interface WatermarkPreviewProps {
  text: string;
  rotation: number;
  rows: number;
  cols: number;
  opacity: number;
  fontSize: number;
}

export default function WatermarkPreview({
  text,
  rotation,
  rows,
  cols,
  opacity,
  fontSize,
}: WatermarkPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const drawPreview = () => {
      if (!text.trim() || !canvasRef.current) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 设置canvas尺寸（A4比例，缩放0.8）
        const scale = 0.8;
        const width = 595 * scale; // A4宽度
        const height = 842 * scale; // A4高度
        
        canvas.width = width;
        canvas.height = height;

        // 清空画布，填充白色背景
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        // 设置文字样式
        ctx.font = `${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = `rgba(128, 128, 128, ${opacity})`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // 根据行数和列数计算水印位置
        const spacingX = width / (cols + 1);
        const spacingY = height / (rows + 1);

        // 绘制水印
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const x = spacingX * (col + 1);
            const y = spacingY * (row + 1);

          // 保存当前状态
          ctx.save();

          // 移动到水印位置
          ctx.translate(x, y);
          
          // 旋转
          const radians = (rotation * Math.PI) / 180;
          ctx.rotate(radians);

            // 绘制文字（旋转后，原点在中心）
            ctx.fillText(text, 0, 0);

            // 恢复状态
            ctx.restore();
          }
        }

        setLoading(false);
      } catch (err: any) {
        console.error("预览生成失败:", err);
        setError(err.message || "预览生成失败");
        setLoading(false);
      }
    };

    // 防抖处理，避免频繁更新
    const timer = setTimeout(() => {
      drawPreview();
    }, 200);

    return () => clearTimeout(timer);
  }, [text, rotation, rows, cols, opacity, fontSize]);

  return (
    <div className="w-full">
      <div className="mb-3">
        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          实时预览
        </h4>
      </div>
      <div className="border-2 border-gray-200/50 dark:border-gray-700/50 rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 flex items-center justify-center min-h-[400px] shadow-lg">
        {loading && (
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">生成预览中...</p>
          </div>
        )}

        {error && (
          <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && !text.trim() && (
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📄</span>
            </div>
            <p className="text-sm font-medium text-gray-400 dark:text-gray-500">请输入水印文字以查看预览</p>
          </div>
        )}

        {!loading && !error && text.trim() && (
          <div className="flex justify-center w-full">
            <canvas
              ref={canvasRef}
              className="border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-w-full h-auto bg-white"
            />
          </div>
        )}
      </div>
    </div>
  );
}

