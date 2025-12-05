/**
 * PDF 转换工具库
 * 支持 PDF 转图片、文本、HTML 等格式
 */

import { saveAs } from "file-saver";

/**
 * PDF 转图片选项
 */
export interface PDFToImageOptions {
  format?: "png" | "jpg" | "jpeg";
  scale?: number; // 缩放比例，默认 2.0 (高质量)
  quality?: number; // JPEG 质量 (0-1)，默认 0.9
  pages?: number[]; // 要转换的页面索引（从1开始），空数组表示所有页面
}

/**
 * PDF 转图片（单页）
 */
export async function pdfPageToImage(
  pdfLib: any,
  page: any,
  options: PDFToImageOptions = {}
): Promise<Blob> {
  const {
    format = "png",
    scale = 2.0,
    quality = 0.9,
  } = options;

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("无法创建 Canvas 上下文");
  }

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas 转换为 Blob 失败"));
          return;
        }
        resolve(blob);
      },
      format === "png" ? "image/png" : "image/jpeg",
      format === "png" ? undefined : quality
    );
  });
}

/**
 * PDF 转图片（多页）
 */
export async function pdfToImages(
  file: File,
  options: PDFToImageOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<Blob[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const pagesToConvert = options.pages && options.pages.length > 0
    ? options.pages.filter(p => p >= 1 && p <= numPages)
    : Array.from({ length: numPages }, (_, i) => i + 1);

  const images: Blob[] = [];

  for (let i = 0; i < pagesToConvert.length; i++) {
    const pageNum = pagesToConvert[i];
    const page = await pdf.getPage(pageNum);
    const imageBlob = await pdfPageToImage(pdfjsLib, page, options);
    images.push(imageBlob);
    
    onProgress?.(i + 1, pagesToConvert.length);
  }

  return images;
}

/**
 * PDF 转文本
 */
export async function pdfToText(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  let fullText = "";

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // 按行提取文本
    const pageLines: string[] = [];
    let currentLine = "";
    let lastY = -1;

    textContent.items.forEach((item: any) => {
      const y = item.transform[5]; // y 坐标
      
      // 如果 y 坐标变化超过阈值，认为是新的一行
      if (lastY !== -1 && Math.abs(y - lastY) > 3) {
        if (currentLine.trim()) {
          pageLines.push(currentLine.trim());
        }
        currentLine = "";
      }
      
      currentLine += item.str + " ";
      lastY = y;
    });

    // 添加最后一行
    if (currentLine.trim()) {
      pageLines.push(currentLine.trim());
    }

    fullText += `--- 第 ${i} 页 ---\n${pageLines.join("\n")}\n\n`;
    
    onProgress?.(i, numPages);
  }

  return fullText.trim();
}

/**
 * PDF 转 HTML
 */
export interface PDFToHTMLOptions {
  includeImages?: boolean; // 是否包含图片（作为 base64）
  imageFormat?: "png" | "jpg";
  imageScale?: number;
}

export async function pdfToHTML(
  file: File,
  options: PDFToHTMLOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  const {
    includeImages = true,
    imageFormat = "png",
    imageScale = 1.5,
  } = options;

  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDF转换 - ${file.name}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .page {
      background: white;
      margin: 20px 0;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      page-break-after: always;
    }
    .page-header {
      font-size: 12px;
      color: #666;
      margin-bottom: 20px;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }
    .page-content {
      line-height: 1.6;
    }
    .page-image {
      max-width: 100%;
      height: auto;
      margin: 10px 0;
    }
    @media print {
      body { background: white; }
      .page { box-shadow: none; margin: 0; }
    }
  </style>
</head>
<body>
`;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    
    html += `  <div class="page">\n`;
    html += `    <div class="page-header">第 ${i} 页 / 共 ${numPages} 页</div>\n`;
    html += `    <div class="page-content">\n`;

    // 提取文本
    const textContent = await page.getTextContent();
    const pageLines: string[] = [];
    let currentLine = "";
    let lastY = -1;

    textContent.items.forEach((item: any) => {
      const y = item.transform[5];
      if (lastY !== -1 && Math.abs(y - lastY) > 3) {
        if (currentLine.trim()) {
          pageLines.push(currentLine.trim());
        }
        currentLine = "";
      }
      currentLine += item.str + " ";
      lastY = y;
    });

    if (currentLine.trim()) {
      pageLines.push(currentLine.trim());
    }

    // 添加文本内容
    if (pageLines.length > 0) {
      pageLines.forEach(line => {
        html += `      <p>${escapeHtml(line)}</p>\n`;
      });
    }

    // 添加页面图片（可选）
    if (includeImages) {
      try {
        const viewport = page.getViewport({ scale: imageScale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          const imageData = canvas.toDataURL(
            imageFormat === "png" ? "image/png" : "image/jpeg",
            imageFormat === "png" ? undefined : 0.9
          );
          html += `      <img src="${imageData}" alt="第 ${i} 页" class="page-image" />\n`;
        }
      } catch (error) {
        console.warn(`无法生成第 ${i} 页图片:`, error);
      }
    }

    html += `    </div>\n`;
    html += `  </div>\n`;

    onProgress?.(i, numPages);
  }

  html += `</body>\n</html>`;

  return html;
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 下载文件
 */
export function downloadFile(blob: Blob, filename: string): void {
  saveAs(blob, filename);
}

/**
 * 批量下载图片
 */
export function downloadImages(images: Blob[], baseName: string, format: string): void {
  images.forEach((blob, index) => {
    const pageNum = String(index + 1).padStart(3, "0");
    const ext = format === "png" ? "png" : "jpg";
    downloadFile(blob, `${baseName}_page_${pageNum}.${ext}`);
  });
}

/**
 * 将多个图片打包为 ZIP（需要额外的库，这里仅提供接口）
 * 如果需要 ZIP 功能，可以集成 jszip 库
 */
export async function downloadImagesAsZip(
  images: Blob[],
  baseName: string,
  format: string
): Promise<void> {
  // 这里需要安装 jszip: npm install jszip
  // 暂时使用单独下载
  downloadImages(images, baseName, format);
}

/**
 * PDF 转 Word 选项
 */
export interface PDFToWordOptions {
  preserveFormatting?: boolean; // 是否保持原始格式（字体、颜色、大小等）
  preserveLayout?: boolean; // 是否保持原始布局（位置、间距等）
  includeImages?: boolean; // 是否包含图片
  imageScale?: number; // 图片缩放比例
}

/**
 * 文本项信息（带格式和位置）
 */
interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontName?: string;
  color?: [number, number, number]; // RGB 0-1
  bold?: boolean;
  italic?: boolean;
}

/**
 * PDF 转 Word（精准还原排版）
 */
export async function pdfToWord(
  file: File,
  options: PDFToWordOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const {
    preserveFormatting = true,
    preserveLayout = true,
    includeImages = true,
    imageScale = 1.5,
  } = options;

  const { Document, Packer, Paragraph, TextRun, AlignmentType, Media } = await import("docx");

  // Word 页面设置（A4 尺寸）
  const A4_WIDTH_TWIPS = 11906;
  const A4_HEIGHT_TWIPS = 16838;

  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  // 获取 PDF 基本信息
  const firstPage = await pdf.getPage(1);
  const viewport = firstPage.getViewport({ scale: 1.0 });
  const pdfWidth = viewport.width;
  const pdfHeight = viewport.height;
  
  // 计算缩放比例（将 PDF 尺寸映射到 Word 页面）
  const scaleX = (A4_WIDTH_TWIPS - 1440) / pdfWidth; // 减去页边距
  const scaleY = (A4_HEIGHT_TWIPS - 1440) / pdfHeight;

  const children: any[] = [];
  
  // 收集图片信息（用于后续处理）
  const imagesToAdd: Array<{
    pageNum: number;
    data: Uint8Array;
    width: number;
    height: number;
  }> = [];

  // 处理每一页（使用延迟处理避免阻塞）
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    // 更新进度
    onProgress?.(pageNum - 1, numPages);
    
    // 允许浏览器处理其他任务（避免卡死）
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const page = await pdf.getPage(pageNum);
    const pageViewport = page.getViewport({ scale: 1.0 });
    
    // 提取文本内容（带格式信息）
    const textContent = await page.getTextContent();
    const items: TextItem[] = [];

    // 解析文本项（分批处理避免阻塞）
    const BATCH_SIZE = 100;
    for (let i = 0; i < textContent.items.length; i += BATCH_SIZE) {
      const batch = textContent.items.slice(i, i + BATCH_SIZE);
      
      batch.forEach((item: any) => {
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      const fontSize = item.height || transform[0] || 12;
      const x = transform[4] || 0;
      const y = pageViewport.height - (transform[5] || 0); // PDF 坐标系转换
      const width = (item.width || fontSize) * (transform[0] || 1);
      const height = fontSize;

      // 提取字体信息
      const fontName = item.fontName || "Arial";
      const bold = fontName.toLowerCase().includes("bold") || fontName.toLowerCase().includes("black");
      const italic = fontName.toLowerCase().includes("italic") || fontName.toLowerCase().includes("oblique");

      // 提取颜色（如果有）
      let color: [number, number, number] | undefined;
      if (item.color && Array.isArray(item.color) && item.color.length >= 3) {
        color = [item.color[0], item.color[1], item.color[2]];
      }

      if (item.str && item.str.trim()) {
        items.push({
          text: item.str,
          x,
          y,
          width,
          height,
          fontSize,
          fontName,
          color,
          bold,
          italic,
        });
      });
      
      // 每处理一批就让出控制权
      if (i + BATCH_SIZE < textContent.items.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // 按行分组（根据 y 坐标）
    const LINE_TOLERANCE = preserveLayout ? 3 : 10;
    const lines: TextItem[][] = [];
    
    // 分批处理避免阻塞
    const ITEM_BATCH_SIZE = 200;
    for (let i = 0; i < items.length; i += ITEM_BATCH_SIZE) {
      const batch = items.slice(i, i + ITEM_BATCH_SIZE);
      
      batch.forEach((item) => {
      const lineY = Math.round(item.y / LINE_TOLERANCE) * LINE_TOLERANCE;
      
      // 查找是否已有相近的行
      let found = false;
      for (const line of lines) {
        if (line.length > 0) {
          const existingY = Math.round(line[0].y / LINE_TOLERANCE) * LINE_TOLERANCE;
          if (Math.abs(lineY - existingY) <= LINE_TOLERANCE) {
            line.push(item);
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        lines.push([item]);
      }
      });
      
      // 每处理一批就让出控制权
      if (i + ITEM_BATCH_SIZE < items.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // 按 y 坐标排序（从上到下）
    lines.sort((a, b) => b[0].y - a[0].y);

    // 为每一行创建段落
    lines.forEach((line, lineIndex) => {
      // 按 x 坐标排序（从左到右）
      line.sort((a, b) => a.x - b.x);

      const textRuns: any[] = [];
      let lastX = 0;

      line.forEach((item, itemIndex) => {
        // 计算缩进（基于 x 坐标）
        const indent = preserveLayout ? (item.x - lastX) * (scaleX / 20) : 0; // 转换为 twips
        
        // 创建文本运行
        const runOptions: any = {
          text: item.text + (itemIndex < line.length - 1 ? "" : " "),
        };

        if (preserveFormatting) {
          if (item.fontSize) {
            runOptions.size = Math.round(item.fontSize * 2); // 转换为 half-points
          }
          if (item.bold) {
            runOptions.bold = true;
          }
          if (item.italic) {
            runOptions.italic = true;
          }
          if (item.color) {
            runOptions.color = rgbToHex(item.color[0], item.color[1], item.color[2]);
          }
        }

        textRuns.push(new TextRun(runOptions));

        // 如果有间距，添加空格
        if (preserveLayout && itemIndex < line.length - 1) {
          const nextItem = line[itemIndex + 1];
          const gap = nextItem.x - (item.x + item.width);
          if (gap > 5) {
            // 如果有明显间距，添加相应数量的空格
            const spaces = Math.min(Math.round(gap / item.fontSize), 20);
            if (spaces > 0) {
              textRuns.push(new TextRun({ text: " ".repeat(spaces) }));
            }
          }
        }

        lastX = item.x + item.width;
      });

      // 计算段落对齐方式
      let alignment = AlignmentType.LEFT;
      if (preserveLayout && line.length > 0) {
        const firstItem = line[0];
        const lastItem = line[line.length - 1];
        const leftMargin = firstItem.x;
        const rightMargin = pageViewport.width - (lastItem.x + lastItem.width);
        
        // 如果左右边距相近，认为是居中
        if (Math.abs(leftMargin - rightMargin) < 20) {
          alignment = AlignmentType.CENTER;
        } else if (rightMargin < leftMargin) {
          alignment = AlignmentType.RIGHT;
        }
      }

      // 计算段落间距
      let spacingAfter = 0;
      if (preserveLayout && lineIndex < lines.length - 1) {
        const currentY = line[0].y;
        const nextY = lines[lineIndex + 1][0].y;
        const gap = currentY - nextY - line[0].height;
        spacingAfter = Math.max(0, Math.round(gap * (scaleY / 20))); // 转换为 twips
      }

      // 计算缩进（基于第一个元素的 x 坐标）
      const firstItem = line[0];
      const indent = preserveLayout ? Math.round(firstItem.x * (scaleX / 20)) : 0;

      // 创建段落
      const paragraph = new Paragraph({
        children: textRuns,
        alignment,
        spacing: {
          after: spacingAfter,
        },
        indent: indent > 0 ? {
          left: indent,
        } : undefined,
      });

      children.push(paragraph);
    });

    // 添加图片（如果有）- 暂时禁用以避免卡死
    // 图片处理会在后续版本优化
    // if (includeImages) {
    //   // 图片处理会导致卡死，暂时禁用
    // }

    // 如果不是最后一页，添加分页符
    if (pageNum < numPages) {
      children.push(
        new Paragraph({
          text: "",
          pageBreakBefore: true,
        })
      );
    }

    onProgress?.(pageNum, numPages);
  }

  // 暂时不添加图片（避免 Media.addImage 的复杂性导致卡死）
  // 图片添加功能可以后续优化
  if (includeImages && imagesToAdd.length > 0) {
    console.log(`检测到 ${imagesToAdd.length} 张图片，但为优化性能暂时不添加`);
  }

  // 创建最终文档（带所有内容）
  const finalDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: A4_WIDTH_TWIPS,
              height: A4_HEIGHT_TWIPS,
            },
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: finalChildren,
      },
    ],
  });

  // 生成并下载
  const blob = await Packer.toBlob(finalDoc);
  const filename = file.name.replace(/\.pdf$/i, ".docx");
  saveAs(blob, filename);
}

/**
 * RGB 转十六进制颜色
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return toHex(r) + toHex(g) + toHex(b);
}

