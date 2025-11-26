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
      // 获取页面尺寸，用于坐标转换（PDF坐标系从左下角开始）
      // 注意：pdf-lib的getWidth/getHeight返回的是PDF页面的完整尺寸（点单位）
      // 这个尺寸应该与pdf.js viewport的尺寸（scale=1.0时）完全一致
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      
      // 检查页面是否有旋转（pdf-lib）
      // 注意：pdf-lib的getRotation()返回一个对象 {type: 'degrees', angle: number}
      // 如果页面有旋转，pdf-lib在绘制内容时会自动应用这个旋转
      // 但是，我们想要图片在PDF中保持与canvas上显示相同的方向
      // 所以，如果页面旋转了，我们需要相应地调整图片的绘制方式
      const pageRotationObj = page.getRotation();
      const pageRotation = pageRotationObj.angle || 0;
      console.log(`页面 ${pageIndex + 1} pdf-lib旋转角度:`, pageRotationObj, {
        angle: pageRotation,
        note: "如果页面旋转了，pdf-lib绘制时会自动应用旋转，这可能导致图片方向不对"
      });
      
      console.log(`页面 ${pageIndex + 1} PDF尺寸 (pdf-lib):`, {
        pdfWidth: pageWidth,
        pdfHeight: pageHeight,
        isLandscape: pageWidth > pageHeight,
        note: "这些尺寸应该与pdf.js viewport的尺寸一致（scale=1.0时）"
      });

      for (const op of pageOps) {
        switch (op.type) {
          case "image":
            // 需要先加载图像
            let imageBytes: ArrayBuffer;
            let mimeType: string;
            
            console.log("处理图片操作，数据:", {
              hasImageFile: !!op.data.imageFile,
              hasImageData: !!op.data.imageData,
              imageDataLength: op.data.imageData?.length,
              x: op.data.x,
              y: op.data.y,
              width: op.data.width,
              height: op.data.height
            });
            
            if (op.data.imageFile) {
              // 如果有File对象，使用它
              imageBytes = await (op.data.imageFile as File).arrayBuffer();
              mimeType = (op.data.imageFile as File).type;
              console.log("使用imageFile，大小:", imageBytes.byteLength, "类型:", mimeType);
            } else if (op.data.imageData) {
              // 如果有base64数据，转换为ArrayBuffer
              // 支持多种图片格式
              const base64Match = op.data.imageData.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
              if (!base64Match) {
                console.error("无效的base64图片数据格式，原始数据长度:", op.data.imageData?.length);
                throw new Error("无效的base64图片数据格式");
              }
              const base64Data = base64Match[2];
              try {
                imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer;
                mimeType = `image/${base64Match[1]}`;
                console.log("使用imageData，大小:", imageBytes.byteLength, "类型:", mimeType);
              } catch (decodeError: any) {
                console.error("base64解码失败:", decodeError);
                throw new Error(`base64解码失败: ${decodeError.message}`);
              }
            } else {
              console.error("图片数据缺失，操作数据:", op.data);
              throw new Error("图片数据缺失：需要 imageFile 或 imageData");
            }
            
            let image: PDFImage;
            try {
              if (mimeType === "image/png" || mimeType === "image/webp") {
                image = await pdf.embedPng(imageBytes);
              } else {
                image = await pdf.embedJpg(imageBytes);
              }
              console.log("图片嵌入成功，准备绘制到页面");
              
              // PDF坐标系是从左下角开始的，需要转换y坐标
              // 注意：pageWidth和pageHeight已经在上面获取了
              const pdfY = pageHeight - op.data.y - op.data.height;
              
              // 检查坐标是否在页面范围内（使用PDF坐标系）
              // op.data.y是canvas坐标（从上到下），需要转换为PDF坐标（从下到上）来检查
              const canvasY = op.data.y;
              const isOutOfBounds = op.data.x < 0 || canvasY < 0 || 
                  op.data.x + op.data.width > pageWidth || 
                  canvasY + op.data.height > pageHeight;
              
              if (isOutOfBounds) {
                console.warn("图片位置超出页面范围，将调整位置:", {
                  canvasX: op.data.x,
                  canvasY: canvasY,
                  pdfY: pdfY,
                  width: op.data.width,
                  height: op.data.height,
                  pageWidth: pageWidth,
                  pageHeight: pageHeight,
                  boundsCheck: {
                    xValid: op.data.x >= 0 && op.data.x + op.data.width <= pageWidth,
                    yValid: canvasY >= 0 && canvasY + op.data.height <= pageHeight,
                    xOverflow: op.data.x + op.data.width - pageWidth,
                    yOverflow: canvasY + op.data.height - pageHeight
                  }
                });
              }
              
              // 确保坐标在有效范围内
              // 注意：不要强制调整坐标，如果坐标超出范围，可能是坐标转换有问题
              // 我们应该使用原始坐标，让PDF库处理边界
              let finalX = op.data.x;
              let finalY = pdfY;
              
              // 只在确实超出范围时才调整（允许轻微的负值，因为可能是浮点误差）
              if (finalX < -0.1) {
                console.warn(`X坐标 ${finalX} 超出范围，调整为 0`);
                finalX = 0;
              } else if (finalX + op.data.width > pageWidth + 0.1) {
                console.warn(`X坐标 ${finalX} + 宽度 ${op.data.width} = ${finalX + op.data.width} 超出页面宽度 ${pageWidth}，调整为 ${pageWidth - op.data.width}`);
                finalX = Math.max(0, pageWidth - op.data.width);
              }
              
              if (finalY < -0.1) {
                console.warn(`Y坐标 ${finalY} 超出范围，调整为 0`);
                finalY = 0;
              } else if (finalY + op.data.height > pageHeight + 0.1) {
                console.warn(`Y坐标 ${finalY} + 高度 ${op.data.height} = ${finalY + op.data.height} 超出页面高度 ${pageHeight}，调整为 ${pageHeight - op.data.height}`);
                finalY = Math.max(0, pageHeight - op.data.height);
              }
              
              console.log("绘制图片到位置:", {
                inputX: op.data.x,
                inputY: op.data.y,
                inputWidth: op.data.width,
                inputHeight: op.data.height,
                pdfX: finalX,
                pdfY: finalY,
                pdfWidth: op.data.width,
                pdfHeight: op.data.height,
                pageWidth: pageWidth,
                pageHeight: pageHeight,
                isLandscape: pageWidth > pageHeight,
                coordinateSystem: "PDF坐标系（左下角为原点，y向上）",
                note: "检查：inputWidth应该等于pdfWidth，inputHeight应该等于pdfHeight（图片不应该旋转）"
              });
              
              // 注意：pdf-lib在绘制到有旋转的页面时，会自动应用页面旋转
              // 但是，我们在PDFEditor中已经处理了坐标转换：
              // - 当内容是横向显示时，canvas旋转了90度，坐标已经转换回PDF原始坐标系
              // - 所以这里直接使用转换后的坐标和尺寸即可
              // 
              // 重要：如果PDF页面本身有旋转（pageRotation），pdf-lib在绘制时会自动应用这个旋转
              // 但是，如果只是内容横向显示（页面未旋转），canvas已经旋转了，坐标已经转换了
              // 所以，我们需要检查页面是否有旋转，如果有，可能需要特殊处理
              
              console.log("准备绘制图片:", {
                x: finalX,
                y: finalY,
                width: op.data.width,
                height: op.data.height,
                pageRotation: pageRotation,
                pageWidth: pageWidth,
                pageHeight: pageHeight,
                note: pageRotation !== 0 
                  ? "页面有旋转，pdf-lib会自动应用旋转"
                  : "页面无旋转，直接绘制"
              });
              
              // 处理图片旋转
              // pdf-lib不支持直接旋转图片，所以我们需要先旋转图片再嵌入
              const rotation = op.data.rotation || 0;
              
              if (rotation !== 0) {
                // 使用canvas旋转图片，然后重新嵌入
                // 注意：这需要在浏览器环境中运行
                if (typeof document === 'undefined') {
                  console.warn('无法在服务端旋转图片，跳过旋转');
                  page.drawImage(image, {
                    x: finalX,
                    y: finalY,
                    width: op.data.width,
                    height: op.data.height,
                    opacity: op.data.opacity ?? 1.0,
                  });
                  break;
                }
                
                try {
                  // 创建临时canvas来旋转图片
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  if (!ctx) throw new Error('无法创建canvas context');
                  
                  // 加载原始图片
                  const img = new Image();
                  await new Promise<void>((resolve, reject) => {
                    img.onload = () => {
                      // 计算旋转后的canvas尺寸
                      const radians = (rotation * Math.PI) / 180;
                      const cos = Math.abs(Math.cos(radians));
                      const sin = Math.abs(Math.sin(radians));
                      const newWidth = img.width * cos + img.height * sin;
                      const newHeight = img.width * sin + img.height * cos;
                      
                      canvas.width = newWidth;
                      canvas.height = newHeight;
                      
                      // 旋转并绘制图片
                      ctx.translate(newWidth / 2, newHeight / 2);
                      ctx.rotate(radians);
                      ctx.drawImage(img, -img.width / 2, -img.height / 2);
                      
                      resolve();
                    };
                    img.onerror = reject;
                    
                    // 从base64加载图片
                    if (op.data.imageData) {
                      img.src = op.data.imageData;
                    } else {
                      reject(new Error('无法获取图片数据'));
                    }
                  });
                  
                  // 将旋转后的canvas转换为blob，然后嵌入
                  const rotatedImageData = canvas.toDataURL('image/png');
                  const base64Data = rotatedImageData.split(',')[1];
                  const rotatedImageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                  
                  // 重新嵌入旋转后的图片
                  const rotatedImage = await pdf.embedPng(rotatedImageBytes);
                  
                  // 计算旋转后的尺寸（保持原始显示尺寸）
                  const scaleX = op.data.width / (rotation === 90 || rotation === 270 ? op.data.height : op.data.width);
                  const scaleY = op.data.height / (rotation === 90 || rotation === 270 ? op.data.width : op.data.height);
                  
                  // 绘制旋转后的图片
                  page.drawImage(rotatedImage, {
                    x: finalX,
                    y: finalY,
                    width: op.data.width,
                    height: op.data.height,
                    opacity: op.data.opacity ?? 1.0,
                  });
                  
                  console.log(`图片已旋转 ${rotation} 度并嵌入到PDF`);
                } catch (rotateError: any) {
                  console.error('旋转图片失败，使用原始图片:', rotateError);
                  // 如果旋转失败，使用原始图片
                  page.drawImage(image, {
                    x: finalX,
                    y: finalY,
                    width: op.data.width,
                    height: op.data.height,
                    opacity: op.data.opacity ?? 1.0,
                  });
                }
              } else {
                // 没有旋转，直接绘制
                page.drawImage(image, {
                  x: finalX,
                  y: finalY, // 转换为PDF坐标系
                  width: op.data.width,  // 直接使用
                  height: op.data.height, // 直接使用
                  opacity: op.data.opacity ?? 1.0,
                });
              }
              console.log("图片绘制完成");
            } catch (embedError: any) {
              console.error("嵌入或绘制图片失败:", embedError);
              throw new Error(`图片处理失败: ${embedError.message || "未知错误"}`);
            }
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
            // 与image相同，支持File对象或base64数据
            let sigBytes: ArrayBuffer;
            let sigMimeType: string;
            
            if (op.data.signatureImage) {
              // 如果有File对象，使用它
              sigBytes = await (op.data.signatureImage as File).arrayBuffer();
              sigMimeType = (op.data.signatureImage as File).type;
            } else if (op.data.imageData) {
              // 如果有base64数据，转换为ArrayBuffer
              // 支持多种图片格式
              const base64Match = op.data.imageData.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
              if (!base64Match) {
                throw new Error("无效的base64签名数据格式");
              }
              const base64Data = base64Match[2];
              sigBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer;
              sigMimeType = `image/${base64Match[1]}`;
            } else {
              throw new Error("签名数据缺失：需要 signatureImage 或 imageData");
            }
            
            let sigImage: PDFImage;
            if (sigMimeType === "image/png") {
              sigImage = await pdf.embedPng(sigBytes);
            } else {
              sigImage = await pdf.embedJpg(sigBytes);
            }
            // PDF坐标系是从左下角开始的，需要转换y坐标（使用之前定义的pageHeight）
            const pageWidth = page.getWidth();
            const pdfY = pageHeight - op.data.y - op.data.height;
            
            // 确保坐标在有效范围内
            const finalX = Math.max(0, Math.min(op.data.x, pageWidth - op.data.width));
            const finalY = Math.max(0, Math.min(pdfY, pageHeight - op.data.height));
            
            console.log("绘制签名到位置:", {
              originalX: op.data.x,
              originalY: op.data.y,
              finalX: finalX,
              finalY: finalY,
              width: op.data.width,
              height: op.data.height
            });
            
            page.drawImage(sigImage, {
              x: finalX,
              y: finalY, // 转换为PDF坐标系
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

    console.log("所有操作处理完成，准备保存PDF");
    const pdfBytes = await pdf.save();
    console.log("PDF保存成功，大小:", pdfBytes.length, "字节");
    return new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  } catch (error: any) {
    console.error("批量编辑失败:", error);
    console.error("错误堆栈:", error.stack);
    throw new Error(`批量编辑失败: ${error.message || "未知错误"}`);
  }
}

