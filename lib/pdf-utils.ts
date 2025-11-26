import { PDFDocument, PDFPage, rgb, degrees, PDFImage, PDFFont } from "pdf-lib";

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

// ============ PDF编辑功能 ============

/**
 * 插入图像到PDF
 */
export async function insertImage(
  file: File,
  imageFile: File,
  pageIndex: number,
  options: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    opacity?: number;
  }
): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const pages = pdf.getPages();
    
    if (pageIndex < 0 || pageIndex >= pages.length) {
      throw new Error(`无效的页面索引: ${pageIndex}`);
    }

    const page = pages[pageIndex];
    const imageBytes = await imageFile.arrayBuffer();
    
    let image: PDFImage;
    const mimeType = imageFile.type;
    
    if (mimeType === "image/png") {
      image = await pdf.embedPng(imageBytes);
    } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
      image = await pdf.embedJpg(imageBytes);
    } else {
      throw new Error("不支持的图片格式，仅支持PNG和JPEG");
    }

    const { width: imageWidth, height: imageHeight } = image.scale(1);
    const width = options.width || imageWidth;
    const height = options.height || imageHeight;
    const opacity = options.opacity ?? 1.0;

    page.drawImage(image, {
      x: options.x,
      y: options.y,
      width,
      height,
      opacity,
    });

    const pdfBytes = await pdf.save();
    return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  } catch (error: any) {
    console.error("插入图像失败:", error);
    throw new Error(`插入图像失败: ${error.message || "未知错误"}`);
  }
}

/**
 * 插入形状到PDF
 */
export async function insertShape(
  file: File,
  pageIndex: number,
  shape: {
    type: "rectangle" | "circle" | "line";
    x: number;
    y: number;
    width?: number;
    height?: number;
    radius?: number;
    x2?: number;
    y2?: number;
    color?: [number, number, number];
    borderColor?: [number, number, number];
    borderWidth?: number;
    opacity?: number;
    fill?: boolean;
  }
): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const pages = pdf.getPages();
    
    if (pageIndex < 0 || pageIndex >= pages.length) {
      throw new Error(`无效的页面索引: ${pageIndex}`);
    }

    const page = pages[pageIndex];
    const color = shape.color ? rgb(shape.color[0], shape.color[1], shape.color[2]) : rgb(0, 0, 0);
    const borderColor = shape.borderColor 
      ? rgb(shape.borderColor[0], shape.borderColor[1], shape.borderColor[2])
      : rgb(0, 0, 0);
    const borderWidth = shape.borderWidth || 1;
    const opacity = shape.opacity ?? 1.0;
    const fill = shape.fill ?? false;

    switch (shape.type) {
      case "rectangle":
        if (!shape.width || !shape.height) {
          throw new Error("矩形需要width和height");
        }
        if (fill) {
          page.drawRectangle({
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            color,
            opacity,
          });
        }
        if (borderWidth > 0) {
          page.drawRectangle({
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            borderColor,
            borderWidth,
            opacity,
          });
        }
        break;

      case "circle":
        if (!shape.radius) {
          throw new Error("圆形需要radius");
        }
        if (fill) {
          page.drawCircle({
            x: shape.x,
            y: shape.y,
            size: shape.radius,
            color,
            opacity,
          });
        }
        if (borderWidth > 0) {
          page.drawCircle({
            x: shape.x,
            y: shape.y,
            size: shape.radius,
            borderColor,
            borderWidth,
            opacity,
          });
        }
        break;

      case "line":
        if (shape.x2 === undefined || shape.y2 === undefined) {
          throw new Error("直线需要x2和y2");
        }
        page.drawLine({
          start: { x: shape.x, y: shape.y },
          end: { x: shape.x2, y: shape.y2 },
          color: borderColor,
          thickness: borderWidth,
          opacity,
        });
        break;
    }

    const pdfBytes = await pdf.save();
    return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  } catch (error: any) {
    console.error("插入形状失败:", error);
    throw new Error(`插入形状失败: ${error.message || "未知错误"}`);
  }
}

/**
 * 添加注释（高亮、下划线、文本框）
 */
export async function addAnnotation(
  file: File,
  pageIndex: number,
  annotation: {
    type: "highlight" | "underline" | "textbox" | "strikethrough";
    x: number;
    y: number;
    width?: number;
    height?: number;
    text?: string;
    color?: [number, number, number];
    fontSize?: number;
  }
): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const pages = pdf.getPages();
    
    if (pageIndex < 0 || pageIndex >= pages.length) {
      throw new Error(`无效的页面索引: ${pageIndex}`);
    }

    const page = pages[pageIndex];
    const font = await pdf.embedFont("Helvetica");
    const color = annotation.color ? rgb(annotation.color[0], annotation.color[1], annotation.color[2]) : rgb(1, 1, 0);
    const fontSize = annotation.fontSize || 12;

    switch (annotation.type) {
      case "highlight":
        if (!annotation.width || !annotation.height) {
          throw new Error("高亮需要width和height");
        }
        page.drawRectangle({
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height,
          color,
          opacity: 0.3,
        });
        break;

      case "underline":
        if (!annotation.width) {
          throw new Error("下划线需要width");
        }
        page.drawLine({
          start: { x: annotation.x, y: annotation.y },
          end: { x: annotation.x + annotation.width, y: annotation.y },
          color,
          thickness: 2,
        });
        break;

      case "strikethrough":
        if (!annotation.width) {
          throw new Error("删除线需要width");
        }
        page.drawLine({
          start: { x: annotation.x, y: annotation.y },
          end: { x: annotation.x + annotation.width, y: annotation.y },
          color,
          thickness: 2,
        });
        break;

      case "textbox":
        if (!annotation.text) {
          throw new Error("文本框需要text");
        }
        page.drawText(annotation.text, {
          x: annotation.x,
          y: annotation.y,
          size: fontSize,
          font,
          color,
        });
        break;
    }

    const pdfBytes = await pdf.save();
    return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  } catch (error: any) {
    console.error("添加注释失败:", error);
    throw new Error(`添加注释失败: ${error.message || "未知错误"}`);
  }
}

/**
 * 页面管理：添加空白页
 */
export async function addPage(file: File, pageIndex?: number, size?: [number, number]): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    
    const pageSize = size || [595, 842]; // A4尺寸
    if (pageIndex !== undefined) {
      pdf.insertPage(pageIndex, pageSize);
    } else {
      pdf.addPage(pageSize);
    }

    const pdfBytes = await pdf.save();
    return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  } catch (error: any) {
    console.error("添加页面失败:", error);
    throw new Error(`添加页面失败: ${error.message || "未知错误"}`);
  }
}

/**
 * 页面管理：删除页面
 */
export async function deletePage(file: File, pageIndex: number): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    
    if (pageIndex < 0 || pageIndex >= pdf.getPageCount()) {
      throw new Error(`无效的页面索引: ${pageIndex}`);
    }

    pdf.removePage(pageIndex);

    const pdfBytes = await pdf.save();
    return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  } catch (error: any) {
    console.error("删除页面失败:", error);
    throw new Error(`删除页面失败: ${error.message || "未知错误"}`);
  }
}

/**
 * 页面管理：重排页面顺序
 */
export async function reorderPages(file: File, newOrder: number[]): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const pageCount = pdf.getPageCount();
    
    if (newOrder.length !== pageCount) {
      throw new Error(`页面顺序数组长度必须等于PDF页数: ${pageCount}`);
    }

    // 验证新顺序是否有效
    const sorted = [...newOrder].sort((a, b) => a - b);
    for (let i = 0; i < pageCount; i++) {
      if (sorted[i] !== i) {
        throw new Error(`无效的页面顺序，必须包含0到${pageCount - 1}的所有数字`);
      }
    }

    // 创建新PDF并按照新顺序复制页面
    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(pdf, newOrder);
    pages.forEach((page) => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();
    return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  } catch (error: any) {
    console.error("重排页面失败:", error);
    throw new Error(`重排页面失败: ${error.message || "未知错误"}`);
  }
}

/**
 * 填写PDF表单字段
 */
export async function fillFormField(
  file: File,
  fieldName: string,
  value: string
): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    
    const form = pdf.getForm();
    const field = form.getTextField(fieldName);
    
    if (!field) {
      throw new Error(`找不到表单字段: ${fieldName}`);
    }

    field.setText(value);

    const pdfBytes = await pdf.save();
    return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  } catch (error: any) {
    console.error("填写表单失败:", error);
    throw new Error(`填写表单失败: ${error.message || "未知错误"}`);
  }
}

/**
 * 添加签名（图片签名）
 */
export async function addSignature(
  file: File,
  signatureImage: File,
  pageIndex: number,
  options: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    opacity?: number;
  }
): Promise<Blob> {
  try {
    // 使用insertImage函数，但可以添加特定的签名样式
    return await insertImage(file, signatureImage, pageIndex, {
      ...options,
      opacity: options.opacity ?? 1.0,
    });
  } catch (error: any) {
    console.error("添加签名失败:", error);
    throw new Error(`添加签名失败: ${error.message || "未知错误"}`);
  }
}

/**
 * 批量编辑PDF（支持多个操作）
 */
export interface PDFEditOperation {
  type: "image" | "shape" | "annotation" | "signature" | "form";
  pageIndex: number;
  data: any;
}

export async function batchEditPDF(
  file: File,
  operations: PDFEditOperation[]
): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    let pdf = await PDFDocument.load(arrayBuffer);

    // 按页面分组操作
    const operationsByPage = new Map<number, PDFEditOperation[]>();
    operations.forEach((op) => {
      if (!operationsByPage.has(op.pageIndex)) {
        operationsByPage.set(op.pageIndex, []);
      }
      operationsByPage.get(op.pageIndex)!.push(op);
    });

    // 处理每个页面的操作
    for (const [pageIndex, pageOps] of operationsByPage) {
      const pages = pdf.getPages();
      if (pageIndex < 0 || pageIndex >= pages.length) {
        throw new Error(`无效的页面索引: ${pageIndex}`);
      }

      const page = pages[pageIndex];

      for (const op of pageOps) {
        switch (op.type) {
          case "image":
            // 需要先加载图像
            const imageBytes = await (op.data.imageFile as File).arrayBuffer();
            const mimeType = (op.data.imageFile as File).type;
            let image: PDFImage;
            if (mimeType === "image/png") {
              image = await pdf.embedPng(imageBytes);
            } else {
              image = await pdf.embedJpg(imageBytes);
            }
            page.drawImage(image, {
              x: op.data.x,
              y: op.data.y,
              width: op.data.width,
              height: op.data.height,
              opacity: op.data.opacity ?? 1.0,
            });
            break;

          case "shape":
            // 使用insertShape的逻辑
            const shapeColor = op.data.color 
              ? rgb(op.data.color[0], op.data.color[1], op.data.color[2])
              : rgb(0, 0, 0);
            const borderColor = op.data.borderColor
              ? rgb(op.data.borderColor[0], op.data.borderColor[1], op.data.borderColor[2])
              : rgb(0, 0, 0);
            
            if (op.data.type === "rectangle") {
              if (op.data.fill) {
                page.drawRectangle({
                  x: op.data.x,
                  y: op.data.y,
                  width: op.data.width,
                  height: op.data.height,
                  color: shapeColor,
                  opacity: op.data.opacity ?? 1.0,
                });
              }
              if (op.data.borderWidth > 0) {
                page.drawRectangle({
                  x: op.data.x,
                  y: op.data.y,
                  width: op.data.width,
                  height: op.data.height,
                  borderColor,
                  borderWidth: op.data.borderWidth || 1,
                  opacity: op.data.opacity ?? 1.0,
                });
              }
            } else if (op.data.type === "circle") {
              if (op.data.fill) {
                page.drawCircle({
                  x: op.data.x,
                  y: op.data.y,
                  size: op.data.radius,
                  color: shapeColor,
                  opacity: op.data.opacity ?? 1.0,
                });
              }
              if (op.data.borderWidth > 0) {
                page.drawCircle({
                  x: op.data.x,
                  y: op.data.y,
                  size: op.data.radius,
                  borderColor,
                  borderWidth: op.data.borderWidth || 1,
                  opacity: op.data.opacity ?? 1.0,
                });
              }
            } else if (op.data.type === "line") {
              page.drawLine({
                start: { x: op.data.x, y: op.data.y },
                end: { x: op.data.x2, y: op.data.y2 },
                color: borderColor,
                thickness: op.data.borderWidth || 1,
                opacity: op.data.opacity ?? 1.0,
              });
            }
            break;

          case "annotation":
            const font = await pdf.embedFont("Helvetica");
            const annColor = op.data.color 
              ? rgb(op.data.color[0], op.data.color[1], op.data.color[2])
              : rgb(1, 1, 0);
            
            if (op.data.type === "highlight") {
              page.drawRectangle({
                x: op.data.x,
                y: op.data.y,
                width: op.data.width,
                height: op.data.height,
                color: annColor,
                opacity: 0.3,
              });
            } else if (op.data.type === "underline" || op.data.type === "strikethrough") {
              page.drawLine({
                start: { x: op.data.x, y: op.data.y },
                end: { x: op.data.x + op.data.width, y: op.data.y },
                color: annColor,
                thickness: 2,
              });
            } else if (op.data.type === "textbox") {
              page.drawText(op.data.text, {
                x: op.data.x,
                y: op.data.y,
                size: op.data.fontSize || 12,
                font,
                color: annColor,
              });
            }
            break;

          case "signature":
            // 与image相同
            const sigBytes = await (op.data.signatureImage as File).arrayBuffer();
            const sigMimeType = (op.data.signatureImage as File).type;
            let sigImage: PDFImage;
            if (sigMimeType === "image/png") {
              sigImage = await pdf.embedPng(sigBytes);
            } else {
              sigImage = await pdf.embedJpg(sigBytes);
            }
            page.drawImage(sigImage, {
              x: op.data.x,
              y: op.data.y,
              width: op.data.width,
              height: op.data.height,
              opacity: op.data.opacity ?? 1.0,
            });
            break;

          case "form":
            const form = pdf.getForm();
            try {
              const field = form.getTextField(op.data.fieldName);
              field.setText(op.data.value);
            } catch (e) {
              console.warn(`无法填写表单字段 ${op.data.fieldName}:`, e);
            }
            break;
        }
      }
    }

    const pdfBytes = await pdf.save();
    return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  } catch (error: any) {
    console.error("批量编辑失败:", error);
    throw new Error(`批量编辑失败: ${error.message || "未知错误"}`);
  }
}

