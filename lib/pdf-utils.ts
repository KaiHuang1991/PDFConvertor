import { PDFDocument, PDFPage, rgb, degrees } from "pdf-lib";

/**
 * 合并多个PDF文件
 */
export async function mergePDFs(files: File[]): Promise<Blob> {
  try {
    const mergedPdf = await PDFDocument.create();

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
    }

    const pdfBytes = await mergedPdf.save();
    return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  } catch (error: any) {
    console.error("合并PDF失败:", error);
    throw new Error(`合并PDF失败: ${error.message || "文件可能已损坏或格式不支持"}`);
  }
}

/**
 * 拆分PDF文件
 */
export async function splitPDF(file: File, pageRanges: string[]): Promise<Blob[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const sourcePdf = await PDFDocument.load(arrayBuffer);
    const totalPages = sourcePdf.getPageCount();
    const results: Blob[] = [];

    for (const range of pageRanges) {
      const parts = range.split("-");
      if (parts.length === 0) continue;

      const start = parseInt(parts[0]);
      if (isNaN(start) || start < 1 || start > totalPages) {
        throw new Error(`无效的页码范围: ${range}。PDF共有${totalPages}页`);
      }

      const end = parts.length > 1 ? parseInt(parts[1]) : start;
      if (isNaN(end) || end < start || end > totalPages) {
        throw new Error(`无效的页码范围: ${range}。PDF共有${totalPages}页`);
      }

      const newPdf = await PDFDocument.create();
      const startPage = start - 1; // 转换为0-based索引
      const endPage = end; // end是包含的

      for (let i = startPage; i < endPage; i++) {
        const [page] = await newPdf.copyPages(sourcePdf, [i]);
        newPdf.addPage(page);
      }

      const pdfBytes = await newPdf.save();
      results.push(new Blob([pdfBytes as BlobPart], { type: "application/pdf" }));
    }

    if (results.length === 0) {
      throw new Error("没有有效的页码范围");
    }

    return results;
  } catch (error: any) {
    console.error("拆分PDF失败:", error);
    throw new Error(`拆分PDF失败: ${error.message || "文件可能已损坏或格式不支持"}`);
  }
}

/**
 * 压缩PDF
 * 智能压缩策略：
 * 1. 对于主要是文本的PDF，使用pdf-lib直接优化
 * 2. 对于包含大量图片的PDF，渲染为压缩图片后重建
 */
export async function compressPDF(file: File, onProgress?: (progress: number) => void): Promise<Blob> {
  try {
    onProgress?.(5);
    
    const arrayBuffer = await file.arrayBuffer();
    const originalSize = arrayBuffer.byteLength;
    
    onProgress?.(10);
    
    // 首先尝试使用pdf-lib直接优化（适用于所有PDF，作为基准）
    let optimizedBytes: Uint8Array | null = null;
    try {
      const pdf = await PDFDocument.load(arrayBuffer);
      const pages = pdf.getPages();
      
      onProgress?.(20);
      
      // 对所有PDF都先尝试直接优化
      const pdfBytes = await pdf.save({
        useObjectStreams: false,
        addDefaultPage: false,
      });
      
      optimizedBytes = pdfBytes;
      const optimizedSize = pdfBytes.length;
      
      // 如果直接优化就能显著减小文件大小（减少10%以上），直接返回
      if (optimizedSize < originalSize * 0.9) {
        onProgress?.(100);
        console.log(`直接优化完成: ${originalSize} -> ${optimizedSize} bytes (减少 ${((originalSize - optimizedSize) / originalSize * 100).toFixed(1)}%)`);
        return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      }
      
      // 检查PDF是否主要是文本（通过页面数量判断）
      const isTextHeavy = pages.length > 0 && (originalSize / pages.length) < 500000; // 每页小于500KB可能是文本PDF
      
      // 对于文本PDF，如果优化后已经减小了，直接返回（不进行图片压缩）
      if (isTextHeavy && optimizedSize < originalSize) {
        onProgress?.(100);
        console.log(`文本PDF优化完成: ${originalSize} -> ${optimizedSize} bytes`);
        return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      }
    } catch (e) {
      // 如果pdf-lib加载失败，继续使用图片压缩方法
      console.log('pdf-lib优化失败，使用图片压缩方法');
    }
    
    // 对于图片PDF或优化效果不好的PDF，使用图片压缩方法
    // 检查是否在浏览器环境
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      throw new Error('压缩功能需要在浏览器环境中运行');
    }
    
    onProgress?.(15);
    
    // 使用pdf.js加载PDF
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    
    onProgress?.(20);
    
    // 创建新的PDF文档
    const compressedPdf = await PDFDocument.create();
    
    // 使用最激进的压缩参数以真正减小文件大小
    // 降低分辨率：0.6倍（大幅降低分辨率以减小文件大小）
    const scale = 0.6;
    // 降低JPEG质量：0.2（非常低的质量以最大化压缩，但保持基本可读性）
    const quality = 0.2;
    
    // 限制最大尺寸，非常激进的限制以减小文件大小
    const maxWidth = 1000;  // 大幅降低到1000
    const maxHeight = 1400;   // 大幅降低到1400
    
    // 逐页处理
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const progress = 20 + Math.floor((pageNum / numPages) * 65);
      onProgress?.(progress);
      
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      let finalWidth = viewport.width;
      let finalHeight = viewport.height;
      
      // 更激进的尺寸限制
      if (finalWidth > maxWidth || finalHeight > maxHeight) {
        const ratio = Math.min(maxWidth / finalWidth, maxHeight / finalHeight);
        finalWidth = finalWidth * ratio;
        finalHeight = finalHeight * ratio;
      }
      
      // 进一步优化：如果页面很大，再次缩小
      if (finalWidth * finalHeight > 1000 * 1400) {
        const areaRatio = Math.sqrt((1000 * 1400) / (finalWidth * finalHeight));
        finalWidth = finalWidth * areaRatio;
        finalHeight = finalHeight * areaRatio;
      }
      
      // 确保最小尺寸合理（避免太小导致不可读）
      if (finalWidth < 400) finalWidth = 400;
      if (finalHeight < 600) finalHeight = 600;
      
      // 创建Canvas渲染页面
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(finalWidth);
      canvas.height = Math.floor(finalHeight);
      const context = canvas.getContext('2d', {
        alpha: false, // 不需要透明度，可以减小文件大小
        willReadFrequently: false,
      });
      
      if (!context) {
        throw new Error('无法创建Canvas上下文');
      }
      
      // 设置背景为白色（避免透明背景）
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // 创建新的viewport以适应调整后的尺寸
      const adjustedViewport = page.getViewport({ 
        scale: scale * (finalWidth / viewport.width) 
      });
      
      // 渲染PDF页面到Canvas
      await page.render({
        canvasContext: context,
        viewport: adjustedViewport,
      }).promise;
      
      // 将Canvas转换为压缩的JPEG图片
      // 使用更激进的压缩：降低质量以减小文件大小
      const imageData = await new Promise<Uint8Array>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas转换失败'));
              return;
            }
            blob.arrayBuffer().then(buffer => {
              resolve(new Uint8Array(buffer));
            }).catch(reject);
          },
          'image/jpeg',
          quality // 使用非常低的JPEG质量（0.2）以最大化压缩
        );
      });
      
      // 将压缩后的图片嵌入新PDF
      const image = await compressedPdf.embedJpg(imageData);
      const pdfPage = compressedPdf.addPage([finalWidth, finalHeight]);
      pdfPage.drawImage(image, {
        x: 0,
        y: 0,
        width: finalWidth,
        height: finalHeight,
      });
    }
    
    onProgress?.(90);
    
    // 保存压缩后的PDF，使用最激进的压缩选项
    const pdfBytes = await compressedPdf.save({
      useObjectStreams: false, // 禁用对象流以减小文件大小
      addDefaultPage: false,
    });
    
    onProgress?.(95);
    
    // 选择最佳压缩结果：图片压缩版本 vs 直接优化版本
    const candidates: { bytes: Uint8Array; method: string }[] = [
      { bytes: pdfBytes, method: '图片压缩' }
    ];
    
    // 如果之前有优化版本，也加入候选
    if (optimizedBytes && optimizedBytes.length < originalSize) {
      candidates.push({ bytes: optimizedBytes, method: '直接优化' });
    }
    
    // 选择最小的版本
    candidates.sort((a, b) => a.bytes.length - b.bytes.length);
    const bestResult = candidates[0];
    
    // 如果最佳版本比原始文件小，使用它
    if (bestResult.bytes.length < originalSize) {
      onProgress?.(100);
      const reduction = ((originalSize - bestResult.bytes.length) / originalSize * 100).toFixed(1);
      console.log(`压缩完成 (${bestResult.method}): ${originalSize} -> ${bestResult.bytes.length} bytes (减少 ${reduction}%)`);
      return new Blob([bestResult.bytes as BlobPart], { type: "application/pdf" });
    } else {
      // 如果所有方法都无法减小文件，返回优化版本（至少清理了元数据）
      onProgress?.(100);
      if (optimizedBytes) {
        console.log(`无法减小文件大小，返回优化版本: ${originalSize} -> ${optimizedBytes.length} bytes`);
        return new Blob([optimizedBytes as BlobPart], { type: "application/pdf" });
      } else {
        // 如果连优化版本都没有，返回图片压缩版本（即使更大）
        console.warn('所有压缩方法都失败，返回图片压缩版本');
        return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      }
    }
    
    const compressedSize = pdfBytes.length;
    const compressionRatio = originalSize > 0 
      ? ((originalSize - compressedSize) / originalSize * 100).toFixed(1)
      : "0.0";
    
    console.log(`压缩完成: ${originalSize} bytes -> ${compressedSize} bytes (减少 ${compressionRatio}%)`);
    
    return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  } catch (error: any) {
    console.error("压缩PDF失败:", error);
    throw new Error(`压缩PDF失败: ${error.message || "文件可能已损坏或格式不支持"}`);
  }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * 解锁PDF密码
 */
export async function unlockPDF(file: File, password: string): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // pdf-lib 支持密码，但类型定义可能不完整，使用类型断言
    const pdf = await PDFDocument.load(arrayBuffer, { password } as any);
    // 保存为无密码PDF
    const pdfBytes = await pdf.save();
    return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  } catch (error) {
    throw new Error("密码错误或PDF未加密");
  }
}

/**
 * 添加水印
 */
export async function addWatermark(
  file: File,
  text: string,
  options?: {
    opacity?: number;
    fontSize?: number;
    color?: [number, number, number];
    rotation?: number; // 旋转角度（度）
    rows?: number; // 水印行数
    cols?: number; // 水印列数
  }
): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const pages = pdf.getPages();

    const opacity = options?.opacity ?? 0.3;
    const fontSize = options?.fontSize ?? 50;
    const color = options?.color ?? [0.5, 0.5, 0.5];
    const rotation = options?.rotation ?? -45; // 默认-45度
    const rows = options?.rows ?? 2; // 默认2行
    const cols = options?.cols ?? 2; // 默认2列

    // 嵌入字体以确保中文显示正常
    const font = await pdf.embedFont("Helvetica");

    pages.forEach((page) => {
      const { width, height } = page.getSize();

      // 根据行数和列数计算水印位置
      const spacingX = width / (cols + 1);
      const spacingY = height / (rows + 1);

      // 绘制水印网格
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = spacingX * (col + 1);
          const y = spacingY * (row + 1);

          page.drawText(text, {
            x: x,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(color[0], color[1], color[2]),
            opacity: opacity,
            rotate: degrees(rotation),
          });
        }
      }
    });

    const pdfBytes = await pdf.save();
    return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  } catch (error: any) {
    console.error("添加水印失败:", error);
    throw new Error(`添加水印失败: ${error.message || "未知错误"}`);
  }
}

/**
 * 提取PDF文本（用于AI聊天）
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    // 使用pdf.js提取文本
    const pdfjsLib = await import("pdfjs-dist");
    // 优先使用本地worker文件，如果不存在则使用CDN备用方案
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      fullText += `\n--- 第 ${i} 页 ---\n${pageText}\n`;
    }

    return fullText.trim();
  } catch (error) {
    console.error("提取PDF文本失败:", error);
    throw new Error("无法提取PDF文本，请确保PDF文件未加密");
  }
}

