/**
 * PDF 转换工具库
 * 支持 PDF 转图片、文本、HTML 等格式
 */

// file-saver 只在客户端使用，使用动态导入避免服务器端错误
// import { saveAs } from "file-saver";

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
export async function downloadFile(blob: Blob, filename: string): Promise<void> {
  // 动态导入 file-saver，避免服务器端错误
  if (typeof window === 'undefined') {
    throw new Error('downloadFile 只能在客户端使用');
  }
  const { saveAs } = await import("file-saver");
  saveAs(blob, filename);
}

/**
 * 批量下载图片
 */
export async function downloadImages(images: Blob[], baseName: string, format: string): Promise<void> {
  for (const [index, blob] of images.entries()) {
    const pageNum = String(index + 1).padStart(3, "0");
    const ext = format === "png" ? "png" : "jpg";
    await downloadFile(blob, `${baseName}_page_${pageNum}.${ext}`);
  }
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
 * PDF 转 Word（使用 Adobe API）
 */
export async function pdfToWord(
  file: File,
  options: PDFToWordOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📤 [PDF转Word] 开始转换");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("文件信息:");
  console.log("  - 文件名:", file.name);
  console.log("  - 文件大小:", file.size, "bytes");
  console.log("  - 文件类型:", file.type);
  console.log("选项:", options);
  
  const {
    preserveFormatting = true,
    preserveLayout = true,
    includeImages = true,
    imageScale = 1.5,
  } = options;

  try {
    onProgress?.(10, 100);
    console.log("[1/4] 准备FormData...");
    
    // 使用 Adobe API 进行转换
    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", "docx");

    onProgress?.(30, 100);
    console.log("[2/4] 发送请求到 /api/adobe/convert...");

    const response = await fetch("/api/adobe/convert", {
      method: "POST",
      body: formData,
    });

    console.log("[3/4] 收到响应:");
    console.log("  - 状态码:", response.status);
    console.log("  - 状态文本:", response.statusText);
    console.log("  - Content-Type:", response.headers.get("Content-Type"));
    console.log("  - Content-Length:", response.headers.get("Content-Length"));

    if (!response.ok) {
      let errorMessage = "转换失败";
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        console.error("❌ API返回错误:", errorData);
      } catch (e) {
        console.error("❌ 无法解析错误响应:", e);
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    onProgress?.(70, 100);
    console.log("[4/4] 读取响应Blob...");

    // 下载结果文件
    const blob = await response.blob();
    console.log("✅ Blob创建成功:");
    console.log("  - Blob大小:", blob.size, "bytes");
    console.log("  - Blob类型:", blob.type);
    
    if (blob.size === 0) {
      console.error("❌ Blob大小为0，文件为空！");
      throw new Error("下载的文件为空，可能是转换失败");
    }
    
    // 检查DOCX文件头（ZIP格式）
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

    onProgress?.(90, 100);
    console.log("📥 创建下载链接...");
    
    // 动态导入 file-saver，处理不同的导出方式
    const fileSaver = await import("file-saver");
    const saveAs = fileSaver.default || fileSaver.saveAs || fileSaver;
    
    if (typeof saveAs !== 'function') {
      console.error("❌ saveAs 不是函数:", typeof saveAs, saveAs);
      throw new Error("无法加载文件保存功能，请刷新页面重试");
    }
    
    const filename = file.name.replace(/\.pdf$/i, ".docx");
    saveAs(blob, filename);
    
    console.log("✅ 下载完成，文件名:", filename);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    onProgress?.(100, 100);
  } catch (error: any) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ [PDF转Word] 转换失败");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("错误信息:", error.message);
    console.error("错误堆栈:", error.stack);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    throw error;
  }

  // 旧的本地实现代码已移除，现在使用Adobe API
  // 以下代码已注释，改用Adobe API实现
  /*
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
  // Word页边距：每边720 twips (0.5英寸)
  const wordContentWidth = A4_WIDTH_TWIPS - 1440; // 减去左右页边距
  const wordContentHeight = A4_HEIGHT_TWIPS - 1440; // 减去上下页边距
  const scaleX = wordContentWidth / pdfWidth;
  const scaleY = wordContentHeight / pdfHeight;

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
      }
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

    // 为每一行创建段落（改进版：更准确地还原布局）
    lines.forEach((line, lineIndex) => {
      // 按 x 坐标排序（从左到右）
      line.sort((a, b) => a.x - b.x);

      const textRuns: any[] = [];
      const avgFontSize = line.reduce((sum, i) => sum + (i.fontSize || 12), 0) / line.length;
      
      // 更准确地还原布局：基于实际坐标位置
      line.forEach((item, itemIndex) => {
        // 计算与前一个元素之间的间距
        if (itemIndex > 0) {
          const prevItem = line[itemIndex - 1];
          const gap = item.x - (prevItem.x + prevItem.width);
          
          // 根据间距决定如何处理
          if (gap > avgFontSize * 5) {
            // 大间距：可能是多列布局，使用制表符
            textRuns.push(new TextRun({ text: "\t" }));
          } else if (gap > 2) {
            // 中等间距：使用空格
            const spaces = Math.min(Math.round(gap / avgFontSize), 30);
            if (spaces > 0) {
              textRuns.push(new TextRun({ text: " ".repeat(spaces) }));
            }
          } else if (gap < -avgFontSize * 0.5) {
            // 文本重叠：不添加间距
          } else {
            // 小间距：添加一个空格
            textRuns.push(new TextRun({ text: " " }));
          }
        }
        
        // 创建文本运行
        const runOptions: any = {
          text: item.text,
        };

        if (preserveFormatting) {
          if (item.fontSize) {
            runOptions.size = Math.round(item.fontSize * 2);
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
      });

      // 计算段落对齐方式
      let alignment = AlignmentType.LEFT;
      if (preserveLayout && line.length > 0) {
        const firstItem = line[0];
        const lastItem = line[line.length - 1];
        const leftMargin = firstItem.x;
        const rightMargin = pageViewport.width - (lastItem.x + lastItem.width);
        
        // 如果左右边距相近，认为是居中
        if (Math.abs(leftMargin - rightMargin) < 30) {
          alignment = AlignmentType.CENTER;
        } else if (rightMargin < leftMargin) {
          alignment = AlignmentType.RIGHT;
        }
      }

      // 计算段落间距（精确计算，考虑实际行高和位置）
      let spacingAfter = 0;
      if (preserveLayout && lineIndex < lines.length - 1) {
        const currentY = line[0].y;
        const nextLine = lines[lineIndex + 1];
        const nextY = nextLine[0].y;
        const currentLineHeight = line.reduce((max, i) => Math.max(max, i.height || i.fontSize || 12), 0);
        const nextLineHeight = nextLine.reduce((max, i) => Math.max(max, i.height || i.fontSize || 12), 0);
        
        // 计算两行之间的实际间距
        const actualGap = currentY - nextY - currentLineHeight;
        
        // 转换为 twips
        if (actualGap > 0) {
          // 使用更精确的缩放，但限制最大间距以避免页面过度拉伸
          spacingAfter = Math.max(0, Math.min(Math.round(actualGap * (scaleY / 20) * 0.4), 240));
        } else if (actualGap < -nextLineHeight * 0.5) {
          // 行重叠严重，使用负间距（但这在Word中有限制）
          spacingAfter = 0;
        } else {
          // 行紧贴，使用最小间距
          spacingAfter = 60; // 3 points
        }
      }

      // 计算缩进（基于第一个元素的 x 坐标）
      const firstItem = line[0];
      // 将PDF坐标转换为Word twips，并减去Word的左边距（720 twips）
      const pdfXInTwips = firstItem.x * (scaleX / 20);
      const indent = preserveLayout ? Math.max(0, Math.round(pdfXInTwips)) : 0;

      // 创建段落
      const paragraph = new Paragraph({
        children: textRuns,
        alignment,
        spacing: {
          after: spacingAfter,
          line: preserveLayout ? Math.round(avgFontSize * 2.4) : undefined, // 行高
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
        children: children,
      },
    ],
  });

  // 生成并下载
  const blob = await Packer.toBlob(finalDoc);
  const filename = file.name.replace(/\.pdf$/i, ".docx");
  saveAs(blob, filename);
  */
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

