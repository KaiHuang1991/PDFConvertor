// 使用动态导入以避免 Next.js 构建问题
// import { createWorker } from "tesseract.js";
// import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from "docx";
// import { saveAs } from "file-saver";

/**
 * OCR识别结果
 */
export interface OCRResult {
  text: string;
  confidence: number;
  pageNumber?: number;
  words?: WordInfo[];
  lines?: LineInfo[];
  blocks?: BlockInfo[];
  tables?: Array<{
    rows: string[][];
    headers?: string[];
  }>;
}

/**
 * 单词信息（用于表格识别）
 */
export interface WordInfo {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
  fontSize?: number; // 字体大小（从bbox高度推断）
}

/**
 * 行信息
 */
export interface LineInfo {
  text: string;
  words: WordInfo[];
  bbox: { x0: number; y0: number; x1: number; y1: number };
  fontSize?: number; // 字体大小（从bbox高度推断）
  isTitle?: boolean; // 是否为标题（通过字体大小和位置判断）
  isSubtitle?: boolean; // 是否为副标题
  alignment?: "left" | "center" | "right"; // 对齐方式
}

/**
 * 文本块信息
 */
export interface BlockInfo {
  text: string;
  lines: LineInfo[];
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * 表格数据
 */
export interface TableData {
  rows: string[][];
  headers?: string[];
}

/**
 * 图片预处理 - 提高OCR准确度
 */
async function preprocessImage(imageFile: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(imageFile);
  });
}

/**
 * 增强图片质量以提高OCR准确度
 */
async function enhanceImageForOCR(img: HTMLImageElement): Promise<File> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建Canvas上下文");

  // 计算合适的尺寸（提高分辨率以改善中文识别，最大4000px）
  const maxSize = 4000; // 提高最大尺寸以改善中文识别
  let width = img.width;
  let height = img.height;
  
  // 如果图片太小，放大以提高识别准确度（特别是中文）
  const minSize = 1000;
  if (width < minSize && height < minSize) {
    const scale = Math.max(minSize / width, minSize / height);
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
  }
  
  if (width > maxSize || height > maxSize) {
    const ratio = Math.min(maxSize / width, maxSize / height);
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;

  // 使用高质量渲染
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 绘制图片
  ctx.drawImage(img, 0, 0, width, height);

  // 应用图像增强
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 增强对比度和亮度（针对中文优化）
  for (let i = 0; i < data.length; i += 4) {
    // 转换为灰度值用于判断
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    
    // 自适应对比度增强（对中文更友好）
    const contrast = gray < 128 ? 1.3 : 1.15; // 暗部增强更多
    
    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128));
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128));
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128));
    
    // 轻微增强亮度（避免过度）
    const brightness = 1.03;
    data[i] = Math.min(255, data[i] * brightness);
    data[i + 1] = Math.min(255, data[i + 1] * brightness);
    data[i + 2] = Math.min(255, data[i + 2] * brightness);
    
    // 锐化处理（提高中文识别准确度）
    // 这里使用简单的锐化，避免过度处理
  }

  ctx.putImageData(imageData, 0, 0);

  // 转换为Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas转换失败"));
          return;
        }
        const file = new File([blob], "enhanced.png", { type: "image/png" });
        resolve(file);
      },
      "image/png",
      1.0 // 最高质量
    );
  });
}

/**
 * 从图片文件进行OCR识别（优化版）
 */
export async function recognizeImage(
  imageFile: File,
  onProgress?: (progress: number) => void,
  options?: {
    enablePreprocessing?: boolean;
    enableTableDetection?: boolean;
  }
): Promise<OCRResult> {
  try {
    console.log("┌─ 本地 OCR 引擎 (Tesseract.js) ─┐");
    console.log("│  引擎: Tesseract.js WebAssembly │");
    console.log("│  语言: chi_sim + eng            │");
    console.log("│  模式: 本地处理                 │");
    console.log("└─────────────────────────────────┘");
    
    onProgress?.(0);

    // 图片预处理（可选，提高准确度但会增加处理时间）
    let processedFile = imageFile;
    if (options?.enablePreprocessing !== false) {
      onProgress?.(5);
      const img = await preprocessImage(imageFile);
      processedFile = await enhanceImageForOCR(img);
      URL.revokeObjectURL(img.src);
      onProgress?.(10);
    }

    // 创建Tesseract worker，使用优化的参数（简体中文+英文）
    // 使用chi_sim（简体中文）和eng（英文）的组合
    // 动态导入 tesseract.js
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("chi_sim+eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          const baseProgress = options?.enablePreprocessing !== false ? 10 : 0;
          const progress = baseProgress + Math.round(m.progress * 85);
          onProgress?.(progress);
        }
      },
    });

    // 设置Tesseract参数以提高中文识别准确度并保持布局
    // 注意：tessedit_ocr_engine_mode 只能在 createWorker 时设置，不能在这里设置
    await worker.setParameters({
      tessedit_pageseg_mode: "1", // 自动页面分割（带OSD），保持布局
      preserve_interword_spaces: "1", // 保留单词间空格
      // 中文识别优化参数
      language_model_penalty_non_freq_dict_word: "0.1", // 降低非字典词惩罚
      language_model_penalty_non_dict_word: "0.15", // 降低非字典词惩罚
      // 保持布局的参数
      preserve_blk_reflow: "1", // 保持块重排
    });

    // 执行OCR识别
    const { data } = await worker.recognize(processedFile, {
      rectangle: undefined, // 识别整个图片
    });

    // 提取结构化数据以保持布局
    let words: WordInfo[] | undefined;
    let lines: LineInfo[] | undefined;
    let blocks: BlockInfo[] | undefined;

    // 始终提取结构化数据以保持布局和格式
    if (data.words && data.words.length > 0) {
      // 计算平均字体大小（用于识别标题等）
      const avgFontSize = data.words.reduce((sum: number, w: any) => {
        return sum + (w.bbox.y1 - w.bbox.y0);
      }, 0) / data.words.length;
      
      words = data.words.map((w: any) => {
        const fontSize = w.bbox.y1 - w.bbox.y0; // 从bbox高度推断字体大小
        return {
          text: w.text,
          bbox: w.bbox,
          confidence: w.confidence || 0,
          fontSize: fontSize,
        };
      });

      // 按行分组（保持布局，使用更精确的容差以保留格式）
      const lineMap = new Map<number, WordInfo[]>();
      data.words.forEach((w: any) => {
        // 使用更小的容差（3px）以保留段落间距和格式
        const lineNum = Math.round(w.bbox.y0 / 3) * 3;
        if (!lineMap.has(lineNum)) {
          lineMap.set(lineNum, []);
        }
        lineMap.get(lineNum)!.push({
          text: w.text,
          bbox: w.bbox,
          confidence: w.confidence || 0,
          fontSize: w.bbox.y1 - w.bbox.y0, // 从bbox高度推断字体大小
        });
      });

      // 按Y坐标排序，然后按X坐标排序每行的单词
      lines = Array.from(lineMap.values())
        .map((words) => {
          // 按X坐标排序单词
          const sortedWords = [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
          // 计算行的字体大小（使用平均高度）
          const lineFontSize = words.reduce((sum, w) => sum + (w.fontSize || (w.bbox.y1 - w.bbox.y0)), 0) / words.length;
          
          return {
            text: sortedWords.map((w) => w.text).join(" "),
            words: sortedWords,
            bbox: {
              x0: Math.min(...words.map((w) => w.bbox.x0)),
              y0: Math.min(...words.map((w) => w.bbox.y0)),
              x1: Math.max(...words.map((w) => w.bbox.x1)),
              y1: Math.max(...words.map((w) => w.bbox.y1)),
            },
            fontSize: lineFontSize,
            // 通过字体大小判断是否为标题（字体大于平均值的1.5倍）
            isTitle: lineFontSize > avgFontSize * 1.5,
            // 通过字体大小判断是否为副标题（字体在平均值1.2-1.5倍之间）
            isSubtitle: lineFontSize > avgFontSize * 1.2 && lineFontSize <= avgFontSize * 1.5,
            // 对齐方式
            alignment: "left" as const,
          };
        })
        .sort((a, b) => a.bbox.y0 - b.bbox.y0);

      // 提取块信息
      if (data.blocks && data.blocks.length > 0) {
        blocks = data.blocks.map((b: any) => ({
          text: b.text || "",
          lines: lines?.filter((l) => 
            l.bbox.y0 >= b.bbox.y0 && l.bbox.y1 <= b.bbox.y1
          ) || [],
          bbox: b.bbox,
        }));
      }
    }

    // 使用结构化数据重建文本以保持布局和格式
    let layoutText = data.text;
    if (lines && lines.length > 0) {
      // 使用行信息重建文本，保持换行和段落间距
      // 检测段落间距：如果两行之间的Y坐标差距较大，添加空行
      const formattedLines: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        formattedLines.push(lines[i].text);
        
        // 检查下一行是否存在，以及行间距
        if (i < lines.length - 1) {
          const currentLine = lines[i];
          const nextLine = lines[i + 1];
          const lineGap = nextLine.bbox.y0 - currentLine.bbox.y1;
          
          // 如果行间距大于平均行高的1.5倍，认为是段落分隔，添加空行
          const avgLineHeight = lines.reduce((sum, l) => sum + (l.bbox.y1 - l.bbox.y0), 0) / lines.length;
          if (lineGap > avgLineHeight * 1.5) {
            formattedLines.push(""); // 添加空行表示段落分隔
          }
        }
      }
      layoutText = formattedLines.join("\n");
    }

    await worker.terminate();

    onProgress?.(100);

    return {
      text: layoutText, // 使用保持布局和格式的文本
      confidence: data.confidence || 0,
      words,
      lines,
      blocks,
    };
  } catch (error: any) {
    console.error("OCR识别失败:", error);
    throw new Error(`OCR识别失败: ${error.message || "未知错误"}`);
  }
}

/**
 * 从PDF文件进行OCR识别（优化版）
 */
export async function recognizePDF(
  pdfFile: File,
  onProgress?: (progress: number) => void,
  options?: {
    enablePreprocessing?: boolean;
    enableTableDetection?: boolean;
  }
): Promise<OCRResult[]> {
  try {
    // 检查是否在浏览器环境
    if (typeof document === "undefined" || typeof window === "undefined") {
      throw new Error("OCR功能需要在浏览器环境中运行");
    }

    console.log("┌─ 本地 OCR 引擎 (Tesseract.js) ─┐");
    console.log("│  引擎: Tesseract.js WebAssembly │");
    console.log("│  语言: chi_sim + eng            │");
    console.log("│  模式: 本地处理                 │");
    console.log("└─────────────────────────────────┘");

    onProgress?.(0);

    // 使用pdf.js加载PDF
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const arrayBuffer = await pdfFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    onProgress?.(3);

    // 创建Tesseract worker（复用同一个worker以提高性能）
    // 使用chi_sim（简体中文）和eng（英文）的组合
    // 动态导入 tesseract.js
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("chi_sim+eng", 1, {
      logger: () => {
        // 静默模式，减少控制台输出
      },
    });

    // 设置优化参数（保持布局并优化中文识别）
    // 注意：tessedit_ocr_engine_mode 只能在 createWorker 时设置，不能在这里设置
    await worker.setParameters({
      tessedit_pageseg_mode: "1", // 自动页面分割，保持布局
      preserve_interword_spaces: "1", // 保留单词间空格
      // 中文识别优化
      language_model_penalty_non_freq_dict_word: "0.1",
      language_model_penalty_non_dict_word: "0.15",
      preserve_blk_reflow: "1", // 保持块重排
    });

    const results: OCRResult[] = [];

    // 逐页处理
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const baseProgress = 3;
      const pageProgress = baseProgress + Math.floor((pageNum / numPages) * 92);
      onProgress?.(pageProgress);

      // 渲染PDF页面到Canvas（使用3.5倍缩放以提高中文识别准确度）
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 3.5 }); // 提高分辨率以改善中文识别

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: false,
      });

      if (!context) {
        throw new Error("无法创建Canvas上下文");
      }

      // 设置白色背景
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, canvas.width, canvas.height);

      // 高质量渲染
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      // 渲染PDF页面
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // 图片预处理（可选）
      let processedCanvas = canvas;
      if (options?.enablePreprocessing !== false) {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 增强对比度（针对中文优化）
        for (let i = 0; i < data.length; i += 4) {
          // 计算灰度值
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          
          // 自适应对比度（对中文更友好）
          const contrast = gray < 128 ? 1.25 : 1.12;
          
          data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128));
          data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128));
          data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128));
        }

        context.putImageData(imageData, 0, 0);
      }

      // 将Canvas转换为Blob
      const imageBlob = await new Promise<Blob>((resolve, reject) => {
        processedCanvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas转换失败"));
              return;
            }
            resolve(blob);
          },
          "image/png",
          1.0
        );
      });

      // 创建File对象用于OCR
      const imageFile = new File([imageBlob], `page-${pageNum}.png`, {
        type: "image/png",
      });

      // 执行OCR识别
      const { data } = await worker.recognize(imageFile);

      // 提取结构化数据以保持布局
      let words: WordInfo[] | undefined;
      let lines: LineInfo[] | undefined;
      let blocks: BlockInfo[] | undefined;

      // 始终提取结构化数据以保持布局和格式
      if (data.words && data.words.length > 0) {
        // 计算平均字体大小（用于识别标题等）
        const avgFontSize = data.words.reduce((sum: number, w: any) => {
          return sum + (w.bbox.y1 - w.bbox.y0);
        }, 0) / data.words.length;
        
        words = data.words.map((w: any) => {
          const fontSize = w.bbox.y1 - w.bbox.y0; // 从bbox高度推断字体大小
          return {
            text: w.text,
            bbox: w.bbox,
            confidence: w.confidence || 0,
            fontSize: fontSize,
          };
        });

        // 按行分组（保持布局，使用更精确的容差以保留格式）
        // 使用较小的容差（3px）以更准确地识别行，保留段落间距
        const lineMap = new Map<number, WordInfo[]>();
        data.words.forEach((w: any) => {
          // 使用更小的容差以保留段落间距和格式
          const lineNum = Math.round(w.bbox.y0 / 3) * 3;
          if (!lineMap.has(lineNum)) {
            lineMap.set(lineNum, []);
          }
          lineMap.get(lineNum)!.push({
            text: w.text,
            bbox: w.bbox,
            confidence: w.confidence || 0,
            fontSize: w.bbox.y1 - w.bbox.y0, // 从bbox高度推断字体大小
          });
        });

        // 按Y坐标排序，然后按X坐标排序每行的单词
        lines = Array.from(lineMap.values())
          .map((words) => {
            // 按X坐标排序单词
            const sortedWords = [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
            // 计算行的字体大小（使用平均高度）
            const lineFontSize = words.reduce((sum, w) => sum + (w.fontSize || (w.bbox.y1 - w.bbox.y0)), 0) / words.length;
            
            return {
              text: sortedWords.map((w) => w.text).join(" "),
              words: sortedWords,
              bbox: {
                x0: Math.min(...words.map((w) => w.bbox.x0)),
                y0: Math.min(...words.map((w) => w.bbox.y0)),
                x1: Math.max(...words.map((w) => w.bbox.x1)),
                y1: Math.max(...words.map((w) => w.bbox.y1)),
              },
              fontSize: lineFontSize,
              // 通过字体大小判断是否为标题（字体大于平均值的1.5倍）
              isTitle: lineFontSize > avgFontSize * 1.5,
              // 通过字体大小判断是否为副标题（字体在平均值1.2-1.5倍之间）
              isSubtitle: lineFontSize > avgFontSize * 1.2 && lineFontSize <= avgFontSize * 1.5,
              // 对齐方式
              alignment: "left" as const,
            };
          })
          .sort((a, b) => a.bbox.y0 - b.bbox.y0);

        // 提取块信息
        if (data.blocks && data.blocks.length > 0) {
          blocks = data.blocks.map((b: any) => ({
            text: b.text || "",
            lines: lines?.filter((l) => 
              l.bbox.y0 >= b.bbox.y0 && l.bbox.y1 <= b.bbox.y1
            ) || [],
            bbox: b.bbox,
          }));
        }
      }

      // 使用结构化数据重建文本以保持布局和格式
      let layoutText = data.text;
      if (lines && lines.length > 0) {
        // 使用行信息重建文本，保持换行和段落间距
        // 检测段落间距：如果两行之间的Y坐标差距较大，添加空行
        const formattedLines: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          formattedLines.push(lines[i].text);
          
          // 检查下一行是否存在，以及行间距
          if (i < lines.length - 1) {
            const currentLine = lines[i];
            const nextLine = lines[i + 1];
            const lineGap = nextLine.bbox.y0 - currentLine.bbox.y1;
            
            // 如果行间距大于平均行高的1.5倍，认为是段落分隔，添加空行
            const avgLineHeight = lines.reduce((sum, l) => sum + (l.bbox.y1 - l.bbox.y0), 0) / lines.length;
            if (lineGap > avgLineHeight * 1.5) {
              formattedLines.push(""); // 添加空行表示段落分隔
            }
          }
        }
        layoutText = formattedLines.join("\n");
      }

      results.push({
        text: layoutText, // 使用保持布局和格式的文本
        confidence: data.confidence || 0,
        pageNumber: pageNum,
        words,
        lines,
        blocks,
      });
    }

    // 清理worker
    await worker.terminate();

    onProgress?.(100);

    return results;
  } catch (error: any) {
    console.error("PDF OCR识别失败:", error);
    throw new Error(`PDF OCR识别失败: ${error.message || "未知错误"}`);
  }
}

/**
 * 检测并提取表格数据（严格模式）
 */
export function detectTables(result: OCRResult): TableData[] {
  if (!result.lines || result.lines.length === 0) {
    return [];
  }

  const tables: TableData[] = [];
  const tableLines: LineInfo[] = [];
  
  // 【严格表格检测】要求：
  // 1. 至少2行具有相同的列对齐模式
  // 2. 每行至少有2个明显的列（间距足够大）
  // 3. 列对齐必须一致（容差更小）
  // 4. 表格至少需要2行
  
  for (let i = 0; i < result.lines.length; i++) {
    const line = result.lines[i];
    const words = line.words || [];
    
    // 要求：至少2个单词，且单词之间有明显的列分隔
    if (words.length >= 2) {
      // 计算单词之间的间距
      const sortedWords = [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
      const gaps: number[] = [];
      for (let j = 1; j < sortedWords.length; j++) {
        const gap = sortedWords[j].bbox.x0 - sortedWords[j - 1].bbox.x1;
        gaps.push(gap);
      }
      
      // 检查是否有明显的列分隔（间距大于平均字符宽度的2倍）
      const avgWordWidth = words.reduce((sum, w) => sum + (w.bbox.x1 - w.bbox.x0), 0) / words.length;
      const hasClearColumns = gaps.some(gap => gap > avgWordWidth * 1.5);
      
      if (hasClearColumns && words.length >= 2) {
        // 检查是否与之前的行有相同的列对齐模式
        if (tableLines.length === 0 || isColumnAligned(line, tableLines[tableLines.length - 1])) {
          tableLines.push(line);
        } else {
          // 列对齐模式改变，可能是表格结束
          if (tableLines.length >= 2) {
            // 至少2行才认为是表格
            const table = extractTableFromLines(tableLines);
            if (table.rows.length >= 2) {
              tables.push(table);
            }
          }
          tableLines.length = 0;
          // 重新开始检测
          if (hasClearColumns) {
            tableLines.push(line);
          }
        }
      } else if (tableLines.length > 0) {
        // 当前行不符合表格特征，检查之前收集的行
        if (tableLines.length >= 2) {
          const table = extractTableFromLines(tableLines);
          if (table.rows.length >= 2) {
            tables.push(table);
          }
        }
        tableLines.length = 0;
      }
    } else if (tableLines.length > 0) {
      // 当前行单词太少，可能是表格结束
      if (tableLines.length >= 2) {
        const table = extractTableFromLines(tableLines);
        if (table.rows.length >= 2) {
          tables.push(table);
        }
      }
      tableLines.length = 0;
    }
  }
  
  // 处理最后一个表格
  if (tableLines.length >= 2) {
    const table = extractTableFromLines(tableLines);
    if (table.rows.length >= 2) {
      tables.push(table);
    }
  }
  
  return tables;
}

/**
 * 检查两行是否具有相同的列对齐模式
 */
function isColumnAligned(line1: LineInfo, line2: LineInfo): boolean {
  const words1 = (line1.words || []).sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const words2 = (line2.words || []).sort((a, b) => a.bbox.x0 - b.bbox.x0);
  
  if (words1.length < 2 || words2.length < 2) {
    return false;
  }
  
  // 提取列位置（每行的第一个单词的X坐标）
  const cols1 = words1.map(w => Math.round(w.bbox.x0 / 15) * 15); // 15px容差
  const cols2 = words2.map(w => Math.round(w.bbox.x0 / 15) * 15);
  
  // 检查是否有至少2个列位置相近（容差15px）
  let alignedCount = 0;
  for (const col1 of cols1) {
    if (cols2.some(col2 => Math.abs(col1 - col2) < 15)) {
      alignedCount++;
    }
  }
  
  // 至少2个列对齐才认为是同一表格
  return alignedCount >= 2;
}

/**
 * 从行信息中提取表格（改进版：更严格的列对齐）
 */
function extractTableFromLines(lines: LineInfo[]): TableData {
  if (lines.length === 0) {
    return { rows: [] };
  }
  
  // 【改进】找到所有行共有的列位置（至少2行都有单词在该位置附近）
  const columnCandidates = new Map<number, number>(); // X位置 -> 出现次数
  
  lines.forEach(line => {
    const words = (line.words || []).sort((a, b) => a.bbox.x0 - b.bbox.x0);
    words.forEach(word => {
      const colX = Math.round(word.bbox.x0 / 15) * 15; // 15px网格对齐
      columnCandidates.set(colX, (columnCandidates.get(colX) || 0) + 1);
    });
  });
  
  // 只保留至少出现在2行中的列位置
  const validColumns = Array.from(columnCandidates.entries())
    .filter(([_, count]) => count >= 2)
    .map(([x, _]) => x)
    .sort((a, b) => a - b);
  
  // 如果有效列少于2列，认为不是表格
  if (validColumns.length < 2) {
    return { rows: [] };
  }
  
  // 为每一行提取单元格
  const rows: string[][] = [];
  lines.forEach(line => {
    const row: string[] = [];
    const words = (line.words || []).sort((a, b) => a.bbox.x0 - b.bbox.x0);
    
    // 为每个有效列位置查找对应的单词
    validColumns.forEach((colX) => {
      // 找到最接近该列位置的单词（容差15px）
      const cellWords = words.filter(w => 
        Math.abs(w.bbox.x0 - colX) < 15
      ).sort((a, b) => a.bbox.x0 - b.bbox.x0);
      
      const cellText = cellWords.map(w => w.text).join(" ").trim();
      row.push(cellText);
    });
    
    // 只添加有内容的行
    if (row.some(cell => cell.length > 0)) {
      rows.push(row);
    }
  });
  
  // 过滤空行
  const validRows = rows.filter(row => row.some(cell => cell.trim().length > 0));
  
  // 如果有效行少于2行，认为不是表格
  if (validRows.length < 2) {
    return { rows: [] };
  }
  
  // 第一行可能是表头（如果它与其他行的格式明显不同，比如更短或更少列）
  const headers = validRows.length > 0 && 
    (validRows[0].length !== validRows[1]?.length || 
     validRows[0].every(cell => cell.length < 20)) // 表头通常较短
    ? validRows[0]
    : undefined;
  
  return {
    rows: headers ? validRows.slice(1) : validRows,
    headers,
  };
}

/**
 * 将OCR结果导出为Word文档（支持表格）
 */
export async function exportToWord(
  results: OCRResult | OCRResult[],
  filename: string = "ocr_result.docx"
): Promise<void> {
  try {
    // 动态导入 docx（必须在函数开始处）
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, PageSize, PageOrientation } = await import("docx");
    
    const resultsArray = Array.isArray(results) ? results : [results];

    // 创建Word文档内容
    const children: (typeof Paragraph | typeof Table)[] = [];

    resultsArray.forEach((result, index) => {
      // 如果是多页PDF，添加页面标题
      if (resultsArray.length > 1 && result.pageNumber) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `第 ${result.pageNumber} 页`,
                bold: true,
                size: 28, // 14pt
              }),
            ],
            spacing: { after: 200 },
          })
        );
      }

      // 当前阶段按你的要求：先不在 Word 中绘制表格，只专注于文本排版
      const tables: Array<{ rows: string[][]; headers?: string[] }> = [];

      // 添加识别文本（仅根据位置重建原始排版，不渲染表格）
      // 【关键改进】使用OCR位置坐标信息重建PDF原始布局
      if (result.lines && result.lines.length > 0) {
        // 【关键改进】根据位置坐标精确重建PDF布局
        // 第一步：将同一行的文本块合并（根据y坐标相近判断）
        interface MergedLine {
          text: string;
          bbox: { x0: number; y0: number; x1: number; y1: number };
          words: any[];
        }
        
        const allLines = result.lines.filter(line => line.text && line.text.trim() && line.bbox);
        if (allLines.length === 0) {
          // 如果没有有效的lines，尝试使用words重建
          if (result.words && result.words.length > 0) {
            // 使用words重建lines
            const wordsByLine = new Map<number, any[]>();
            const LINE_TOLERANCE = 3; // y坐标容差
            
            result.words.forEach((word: any) => {
              if (!word.bbox) return;
              const y = Math.round(word.bbox.y0 / LINE_TOLERANCE) * LINE_TOLERANCE;
              if (!wordsByLine.has(y)) {
                wordsByLine.set(y, []);
              }
              wordsByLine.get(y)!.push(word);
            });
            
            // 按y坐标排序，然后合并每行的words
            const sortedYs = Array.from(wordsByLine.keys()).sort((a, b) => a - b);
            allLines.push(...sortedYs.map(y => {
              const words = wordsByLine.get(y)!;
              words.sort((a, b) => (a.bbox.x0 || 0) - (b.bbox.x0 || 0));
              
              const x0 = Math.min(...words.map(w => w.bbox.x0 || 0));
              const y0 = Math.min(...words.map(w => w.bbox.y0 || 0));
              const x1 = Math.max(...words.map(w => w.bbox.x1 || 0));
              const y1 = Math.max(...words.map(w => w.bbox.y1 || 0));
              
              return {
                text: words.map(w => w.text).join(" "),
                bbox: { x0, y0, x1, y1 },
                words,
              };
            }));
          }
        }
        
        // lines已经在convertBaiduResult中合并过了，这里直接使用，但为了安全再做一次合并
        // 再次合并同一行的文本块（防止有些lines没有被正确合并）
        const finalLines: MergedLine[] = [];
        const LINE_TOLERANCE = 5; // y坐标容差（像素）
        
        allLines.forEach((line) => {
          const lineY = Math.round(line.bbox.y0 / LINE_TOLERANCE) * LINE_TOLERANCE;
          
          // 查找是否已有相近的行
          let found = false;
          for (let i = 0; i < finalLines.length; i++) {
            const existingY = Math.round(finalLines[i].bbox.y0 / LINE_TOLERANCE) * LINE_TOLERANCE;
            if (Math.abs(lineY - existingY) <= LINE_TOLERANCE) {
              // 同一行，合并文本和bbox
              finalLines[i].text += " " + line.text;
              finalLines[i].bbox.x0 = Math.min(finalLines[i].bbox.x0, line.bbox.x0 || 0);
              finalLines[i].bbox.y0 = Math.min(finalLines[i].bbox.y0, line.bbox.y0 || 0);
              finalLines[i].bbox.x1 = Math.max(finalLines[i].bbox.x1, line.bbox.x1 || 0);
              finalLines[i].bbox.y1 = Math.max(finalLines[i].bbox.y1, line.bbox.y1 || 0);
              if (line.words && Array.isArray(line.words)) {
                finalLines[i].words.push(...line.words);
              }
              found = true;
              break;
            }
          }
          
          if (!found) {
            finalLines.push({
              text: line.text || "",
              bbox: { 
                x0: line.bbox.x0 || 0,
                y0: line.bbox.y0 || 0,
                x1: line.bbox.x1 || 0,
                y1: line.bbox.y1 || 0,
              },
              words: line.words || [],
            });
          }
        });
        
        // 按y坐标排序
        finalLines.sort((a, b) => a.bbox.y0 - b.bbox.y0);
        
        if (finalLines.length > 0) {
          // 计算页面的实际宽度（PDF坐标，通常是points单位）
          const maxX = Math.max(...finalLines.map(line => line.bbox.x1 || 0));
          const minX = Math.min(...finalLines.map(line => line.bbox.x0 || 0));
          // A4页面宽度通常是595 points，但实际内容区域可能更窄
          // 使用实际内容的宽度，或者假设是A4标准宽度
          // 计算页面尺寸（PDF坐标通常以points为单位）
          // A4标准尺寸：595 x 842 points (210 x 297 mm)
          // 假设PDF页面宽度为595 points（标准A4），或者使用实际内容宽度
          const contentWidth = maxX - minX;
          const estimatedPageWidth = Math.max(contentWidth + 144, 595); // 至少595 points，加上可能的边距
          
          // 计算平均行高
          const avgLineHeight = finalLines.reduce((sum, line) => {
            return sum + ((line.bbox.y1 || 0) - (line.bbox.y0 || 0));
          }, 0) / finalLines.length || 20;
          
          console.log("PDF布局信息:", {
            estimatedPageWidth,
            minX,
            maxX,
            contentWidth: maxX - minX,
            linesCount: finalLines.length,
            avgLineHeight,
          });
          
          // 处理每一行，根据位置信息设置格式
          finalLines.forEach((line, lineIndex) => {
            if (!line.text || !line.text.trim()) {
              // 空行，可能是段落分隔
              // 【优化】减小空行间距，避免内容分散到多页
              if (lineIndex < finalLines.length - 1) {
                const nextLine = finalLines[lineIndex + 1];
                const gap = nextLine.bbox.y0 - (line.bbox.y1 || line.bbox.y0);
                // 使用较小的缩放因子，避免空行间距过大
                const spacing = Math.max(60, Math.min(180, Math.round(gap * 0.5))); // 3-9pt
                children.push(
                  new Paragraph({
                    children: [new TextRun({ text: "" })],
                    spacing: { after: spacing },
                  })
                );
              }
              return;
            }
            
            // 计算字体大小（基于行高）
            // OCR坐标通常是像素单位，需要合理转换为Word字体大小
            const lineHeight = (line.bbox.y1 || 0) - (line.bbox.y0 || 0) || avgLineHeight;
            // 假设OCR坐标是像素，转换为字体大小（像素到点的比例约为0.75）
            // 行高通常是字体大小的1.2-1.5倍，字体大小 = 行高 / 1.3 * 0.75
            // Word使用half-points（1 point = 2 half-points）
            const fontSizePoints = (lineHeight / 1.3) * 0.75; // 缩小字体大小
            const fontSize = Math.max(18, Math.min(48, Math.round(fontSizePoints * 2))); // 减小最大字体
            
            // 计算缩进：基于行的左边界相对于内容区域左边界的位置
            // OCR坐标通常是像素单位，需要转换为Word twips
            // 减小转换比例，避免缩进过大
            const INDENT_SCALE_FACTOR = 1.5; // 减小缩放因子
            const lineLeft = line.bbox.x0 || 0;
            const indentFromContent = lineLeft - minX;
            // 将OCR像素坐标转换为Word twips（使用较小的缩放因子）
            const indent = Math.max(0, Math.round(indentFromContent * INDENT_SCALE_FACTOR));
            
            // 计算对齐方式（基于行的位置和宽度）
            const lineWidth = (line.bbox.x1 || 0) - (line.bbox.x0 || 0);
            const lineRight = line.bbox.x1 || 0;
            const lineCenter = lineLeft + lineWidth / 2;
            const contentCenter = minX + contentWidth / 2;
            
            let alignment: "left" | "center" | "right" = "left";
            
            // 判断对齐方式：计算行中心与内容中心的偏差
            const centerOffset = Math.abs(lineCenter - contentCenter);
            
            // 如果行的中心接近内容中心（误差小于15%），视为居中
            if (centerOffset < contentWidth * 0.15 && contentWidth > 0) {
              alignment = "center";
            } 
            // 如果行的右边界接近内容右边界（误差小于15%），视为右对齐
            else if (Math.abs(lineRight - maxX) < contentWidth * 0.15 && contentWidth > 0) {
              alignment = "right";
            }
            
            // 计算行间距（基于与下一行的距离）
            // 【优化】减少间距，确保单页PDF导出为单页Word
            let spacingAfter = 60; // 默认行间距（3pt = 60 twips）- 减小默认值
            if (lineIndex < finalLines.length - 1) {
              const nextLine = finalLines[lineIndex + 1];
              const currentBottom = line.bbox.y1 || line.bbox.y0 + lineHeight;
              const gap = nextLine.bbox.y0 - currentBottom;
              
              // OCR坐标通常是像素单位，需要合理转换为Word twips
              // 关键是不要转换得太大，否则会分散到多页
              // 使用较小的缩放因子，并根据实际间距动态调整
              const SCALE_FACTOR = 0.5; // 进一步减小缩放因子
              
              // 计算相对间距（相对于平均行高）
              const relativeGap = gap / avgLineHeight;
              
              if (relativeGap > 2.5) {
                // 大段落间距：较大的间隙（如标题后）
                spacingAfter = Math.max(120, Math.min(240, Math.round(gap * SCALE_FACTOR))); // 6-12pt
              } else if (relativeGap > 1.5) {
                // 段落间距：中等间隙
                spacingAfter = Math.max(60, Math.min(180, Math.round(gap * SCALE_FACTOR))); // 3-9pt
              } else if (relativeGap > 1.1) {
                // 稍大的行间距
                spacingAfter = Math.max(30, Math.min(120, Math.round(gap * SCALE_FACTOR))); // 1.5-6pt
              } else {
                // 正常行间距：很小或为0
                spacingAfter = Math.max(0, Math.min(60, Math.round(gap * SCALE_FACTOR))); // 0-3pt
              }
            } else {
              // 最后一行，不需要间距
              spacingAfter = 0;
            }
            
            // 判断是否为标题（基于字体大小和位置）
            const isTitle = fontSize > 32 || line.isTitle;
            const isBold = isTitle || line.isTitle;
            
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line.text.trim(),
                    size: fontSize,
                    bold: isBold,
                    italics: line.isSubtitle || false,
                  }),
                ],
                spacing: { 
                  after: spacingAfter,
                },
                indent: {
                  left: indent,
                  firstLine: 0, // 首行缩进单独处理
                },
                alignment: alignment,
              })
            );
          });
        }
      } else {
        // 如果没有行信息，回退到简单的文本处理
        const textLines = result.text.split("\n");
        
        if (textLines.length === 0 || textLines.every(line => !line.trim())) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "[此页面未识别到文字]",
                  italics: true,
                  color: "999999",
                }),
              ],
              spacing: { after: 200 },
            })
          );
        } else {
          textLines.forEach((line, lineIndex) => {
            const isParagraphBreak = line.trim() === "";
            const indentMatch = line.match(/^(\s+)/);
            const indentLevel = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
            
            if (isParagraphBreak) {
              children.push(
                new Paragraph({
                  children: [new TextRun({ text: "" })],
                  spacing: { after: 400 },
                })
              );
            } else {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: line.trim(),
                      size: 24,
                    }),
                  ],
                  spacing: { after: 100 },
                  indent: {
                    left: indentLevel * 720,
                  },
                })
              );
            }
          });
        }
      }

      // 添加页面分隔（如果不是最后一页）
      if (index < resultsArray.length - 1) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "",
              }),
            ],
            spacing: { after: 400 },
          })
        );
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "────────────────────────────────────",
                color: "CCCCCC",
              }),
            ],
            spacing: { after: 400 },
          })
        );
      }
    });

    // 创建Word文档，优化页面设置以确保单页PDF导出为单页Word
    // 简化：直接设置页面大小和边距，不依赖PageSize常量
    // A4尺寸：210mm x 297mm = 11906 twips x 16838 twips（1 inch = 1440 twips, 1mm = 56.693 twips）
    const A4_WIDTH = 11906;  // A4宽度（twips）
    const A4_HEIGHT = 16838; // A4高度（twips）
    
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                width: A4_WIDTH,
                height: A4_HEIGHT,
              },
              margin: {
                top: 720,      // 0.5英寸 = 720 twips（减小页边距）
                right: 720,    // 0.5英寸
                bottom: 720,   // 0.5英寸
                left: 720,     // 0.5英寸
              },
            },
          },
          children: children,
        },
      ],
    });

    // 生成并下载Word文档
    const blob = await Packer.toBlob(doc);
    // 动态导入 file-saver（处理不同的导出方式）
    const fileSaver = await import("file-saver");
    // file-saver 可能使用 default 导出或命名导出
    const saveAs = fileSaver.default || fileSaver.saveAs || (fileSaver as any).default;
    if (typeof saveAs === "function") {
      saveAs(blob, filename);
    } else {
      // 如果导入失败，使用备选方案：创建下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error: any) {
    console.error("导出Word失败:", error);
    throw new Error(`导出Word失败: ${error.message || "未知错误"}`);
  }
}

/**
 * 判断文件是否为图片
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * 判断文件是否为PDF
 */
export function isPDFFile(file: File): boolean {
  return file.type === "application/pdf";
}

