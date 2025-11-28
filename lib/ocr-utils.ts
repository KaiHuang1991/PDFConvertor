import { createWorker } from "tesseract.js";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from "docx";
import { saveAs } from "file-saver";

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
}

/**
 * 单词信息（用于表格识别）
 */
export interface WordInfo {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

/**
 * 行信息
 */
export interface LineInfo {
  text: string;
  words: WordInfo[];
  bbox: { x0: number; y0: number; x1: number; y1: number };
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
    await worker.setParameters({
      tessedit_pageseg_mode: "1", // 自动页面分割（带OSD），保持布局
      tessedit_char_whitelist: "", // 不限制字符
      preserve_interword_spaces: "1", // 保留单词间空格
      classify_bln_numeric_mode: "0", // 不强制数字模式
      tessedit_ocr_engine_mode: "1", // LSTM OCR引擎（对中文更好）
      // 中文识别优化参数
      language_model_penalty_non_freq_dict_word: "0.1", // 降低非字典词惩罚
      language_model_penalty_non_dict_word: "0.15", // 降低非字典词惩罚
      tessedit_create_hocr: "0", // 不使用hOCR（使用默认输出保持布局）
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

    // 始终提取结构化数据以保持布局
    if (data.words && data.words.length > 0) {
      words = data.words.map((w: any) => ({
        text: w.text,
        bbox: w.bbox,
        confidence: w.confidence || 0,
      }));

      // 按行分组（保持布局）
      const lineMap = new Map<number, WordInfo[]>();
      data.words.forEach((w: any) => {
        // 使用更精确的行分组（5px容差）
        const lineNum = Math.round(w.bbox.y0 / 5) * 5;
        if (!lineMap.has(lineNum)) {
          lineMap.set(lineNum, []);
        }
        lineMap.get(lineNum)!.push({
          text: w.text,
          bbox: w.bbox,
          confidence: w.confidence || 0,
        });
      });

      // 按Y坐标排序，然后按X坐标排序每行的单词
      lines = Array.from(lineMap.values())
        .map((words) => {
          // 按X坐标排序单词
          const sortedWords = [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
          return {
            text: sortedWords.map((w) => w.text).join(" "),
            words: sortedWords,
            bbox: {
              x0: Math.min(...words.map((w) => w.bbox.x0)),
              y0: Math.min(...words.map((w) => w.bbox.y0)),
              x1: Math.max(...words.map((w) => w.bbox.x1)),
              y1: Math.max(...words.map((w) => w.bbox.y1)),
            },
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

    // 使用结构化数据重建文本以保持布局
    let layoutText = data.text;
    if (lines && lines.length > 0) {
      // 使用行信息重建文本，保持换行
      layoutText = lines.map(line => line.text).join("\n");
    }

    await worker.terminate();

    onProgress?.(100);

    return {
      text: layoutText, // 使用保持布局的文本
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
    const worker = await createWorker("chi_sim+eng", 1, {
      logger: () => {
        // 静默模式，减少控制台输出
      },
    });

    // 设置优化参数（保持布局并优化中文识别）
    await worker.setParameters({
      tessedit_pageseg_mode: "1", // 自动页面分割，保持布局
      preserve_interword_spaces: "1", // 保留单词间空格
      tessedit_ocr_engine_mode: "1", // LSTM OCR引擎
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

      // 始终提取结构化数据以保持布局
      if (data.words && data.words.length > 0) {
        words = data.words.map((w: any) => ({
          text: w.text,
          bbox: w.bbox,
          confidence: w.confidence || 0,
        }));

        // 按行分组（保持布局，使用5px容差）
        const lineMap = new Map<number, WordInfo[]>();
        data.words.forEach((w: any) => {
          const lineNum = Math.round(w.bbox.y0 / 5) * 5;
          if (!lineMap.has(lineNum)) {
            lineMap.set(lineNum, []);
          }
          lineMap.get(lineNum)!.push({
            text: w.text,
            bbox: w.bbox,
            confidence: w.confidence || 0,
          });
        });

        // 按Y坐标排序，然后按X坐标排序每行的单词
        lines = Array.from(lineMap.values())
          .map((words) => {
            // 按X坐标排序单词
            const sortedWords = [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
            return {
              text: sortedWords.map((w) => w.text).join(" "),
              words: sortedWords,
              bbox: {
                x0: Math.min(...words.map((w) => w.bbox.x0)),
                y0: Math.min(...words.map((w) => w.bbox.y0)),
                x1: Math.max(...words.map((w) => w.bbox.x1)),
                y1: Math.max(...words.map((w) => w.bbox.y1)),
              },
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

      // 使用结构化数据重建文本以保持布局
      let layoutText = data.text;
      if (lines && lines.length > 0) {
        // 使用行信息重建文本，保持换行
        layoutText = lines.map(line => line.text).join("\n");
      }

      results.push({
        text: layoutText, // 使用保持布局的文本
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
 * 检测并提取表格数据
 */
export function detectTables(result: OCRResult): TableData[] {
  if (!result.lines || result.lines.length === 0) {
    return [];
  }

  const tables: TableData[] = [];
  const tableLines: LineInfo[] = [];
  
  // 简单的表格检测：查找对齐的列
  for (let i = 0; i < result.lines.length; i++) {
    const line = result.lines[i];
    const words = line.words || [];
    
    // 如果一行有多个单词且它们大致对齐，可能是表格行
    if (words.length >= 3) {
      // 检查单词是否大致垂直对齐（X坐标相近）
      const xPositions = words.map(w => w.bbox.x0).sort((a, b) => a - b);
      const hasColumns = xPositions.some((x, idx) => 
        idx > 0 && Math.abs(x - xPositions[idx - 1]) > 50
      );
      
      if (hasColumns) {
        tableLines.push(line);
      } else if (tableLines.length > 0) {
        // 表格结束，处理收集的行
        const table = extractTableFromLines(tableLines);
        if (table.rows.length > 0) {
          tables.push(table);
        }
        tableLines.length = 0;
      }
    }
  }
  
  // 处理最后一个表格
  if (tableLines.length > 0) {
    const table = extractTableFromLines(tableLines);
    if (table.rows.length > 0) {
      tables.push(table);
    }
  }
  
  return tables;
}

/**
 * 从行信息中提取表格
 */
function extractTableFromLines(lines: LineInfo[]): TableData {
  if (lines.length === 0) {
    return { rows: [] };
  }
  
  // 找到所有列的位置
  const allXPositions = new Set<number>();
  lines.forEach(line => {
    line.words?.forEach(word => {
      allXPositions.add(Math.round(word.bbox.x0 / 20) * 20); // 对齐到20px网格
    });
  });
  
  const sortedXPositions = Array.from(allXPositions).sort((a, b) => a - b);
  
  // 为每一行提取单元格
  const rows: string[][] = [];
  lines.forEach(line => {
    const row: string[] = [];
    const words = line.words || [];
    
    // 按列位置分组单词
    sortedXPositions.forEach((colX, colIdx) => {
      const cellWords = words.filter(w => 
        Math.abs(w.bbox.x0 - colX) < 30
      ).sort((a, b) => a.bbox.x0 - b.bbox.x0);
      
      const cellText = cellWords.map(w => w.text).join(" ").trim();
      row.push(cellText);
    });
    
    if (row.some(cell => cell.length > 0)) {
      rows.push(row);
    }
  });
  
  // 第一行可能是表头
  const headers = rows.length > 0 && rows[0].some(cell => cell.length > 0)
    ? rows[0]
    : undefined;
  
  return {
    rows: headers ? rows.slice(1) : rows,
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
    const resultsArray = Array.isArray(results) ? results : [results];

    // 创建Word文档内容
    const children: (Paragraph | Table)[] = [];

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

      // 检测并添加表格
      const tables = detectTables(result);
      if (tables.length > 0) {
        tables.forEach((table, tableIdx) => {
          if (tableIdx > 0) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: "" })],
                spacing: { after: 200 },
              })
            );
          }

          // 创建Word表格
          const tableRows: TableRow[] = [];

          // 添加表头（如果有）
          if (table.headers && table.headers.length > 0) {
            tableRows.push(
              new TableRow({
                children: table.headers.map((header) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: header || "",
                            bold: true,
                            size: 24,
                          }),
                        ],
                      }),
                    ],
                    width: {
                      size: 100 / table.headers.length,
                      type: WidthType.PERCENTAGE,
                    },
                  })
                ),
              })
            );
          }

          // 添加数据行
          table.rows.forEach((row) => {
            tableRows.push(
              new TableRow({
                children: row.map((cell) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: cell || "",
                            size: 24,
                          }),
                        ],
                      }),
                    ],
                    width: {
                      size: 100 / row.length,
                      type: WidthType.PERCENTAGE,
                    },
                  })
                ),
              })
            );
          });

          if (tableRows.length > 0) {
            children.push(
              new Table({
                rows: tableRows,
                width: {
                  size: 100,
                  type: WidthType.PERCENTAGE,
                },
              })
            );
          }
        });

        // 添加表格后的分隔
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "" })],
            spacing: { after: 200 },
          })
        );
      }

      // 添加识别文本（如果表格为空或需要完整文本）
      const textLines = result.text.split("\n").filter((line) => line.trim());
      
      if (textLines.length === 0) {
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
      } else if (tables.length === 0) {
        // 如果没有表格，显示完整文本
        textLines.forEach((line) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  size: 24, // 12pt
                }),
              ],
              spacing: { after: 100 },
            })
          );
        });
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

    // 创建Word文档
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: children,
        },
      ],
    });

    // 生成并下载Word文档
    const blob = await Packer.toBlob(doc);
    saveAs(blob, filename);
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

