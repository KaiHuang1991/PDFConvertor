/**
 * 云端 OCR API 集成
 * 支持：百度、腾讯、阿里云 OCR
 */

export interface CloudOCRResult {
  text: string;
  confidence: number;
  pageNumber?: number;
  words?: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
    confidence: number;
  }>;
  lines?: Array<{
    text: string;
    words: Array<{
      text: string;
      bbox: { x0: number; y0: number; x1: number; y1: number };
      confidence: number;
    }>;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
  tables?: Array<{
    rows: string[][];
    headers?: string[];
  }>;
}

export type OCRProvider = "baidu" | "tencent" | "aliyun";

/**
 * 百度 OCR 识别
 */
export async function recognizeWithBaiduOCR(
  imageFile: File,
  options: {
    apiKey: string;
    secretKey: string;
    enableTable?: boolean;
  }
): Promise<CloudOCRResult> {
  // 获取 access_token
  const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${options.apiKey}&client_secret=${options.secretKey}`;
  const tokenResponse = await fetch(tokenUrl);
  const tokenData = await tokenResponse.json();
  
  if (!tokenData.access_token) {
    throw new Error("获取百度 OCR access_token 失败");
  }

  // 转换图片为 base64
  const base64 = await fileToBase64(imageFile);

  // 调用 OCR API
  const apiUrl = options.enableTable
    ? "https://aip.baidubce.com/rest/2.0/ocr/v1/table"
    : "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic";
  
  const response = await fetch(`${apiUrl}?access_token=${tokenData.access_token}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      image: base64,
      language_type: "CHN_ENG", // 中英文混合
    }),
  });

  const data = await response.json();
  
  if (data.error_code) {
    throw new Error(`百度 OCR 识别失败: ${data.error_msg}`);
  }

  // 转换百度 OCR 结果格式
  return convertBaiduResult(data);
}

/**
 * 腾讯 OCR 识别
 */
export async function recognizeWithTencentOCR(
  imageFile: File,
  options: {
    secretId: string;
    secretKey: string;
    enableTable?: boolean;
  }
): Promise<CloudOCRResult> {
  // 转换图片为 base64
  const base64 = await fileToBase64(imageFile);

  // 腾讯云需要签名，这里简化处理（实际应该在后端完成）
  // 建议：将 OCR 调用放在 Next.js API Route 中，避免暴露密钥
  
  const apiUrl = options.enableTable
    ? "https://ocr.tencentcloudapi.com/"
    : "https://ocr.tencentcloudapi.com/";

  // 注意：腾讯云 OCR 需要复杂的签名算法，建议使用官方 SDK
  // 这里仅提供接口示例，实际实现需要后端支持
  
  throw new Error("腾讯 OCR 需要后端支持，请使用 Next.js API Route");
}

/**
 * 阿里云 OCR 识别
 */
export async function recognizeWithAliyunOCR(
  imageFile: File,
  options: {
    accessKeyId: string;
    accessKeySecret: string;
    enableTable?: boolean;
  }
): Promise<CloudOCRResult> {
  // 阿里云 OCR 也需要签名，建议在后端完成
  throw new Error("阿里云 OCR 需要后端支持，请使用 Next.js API Route");
}

/**
 * 通用云端 OCR 识别（推荐使用）
 * 通过 Next.js API Route 调用，保护 API 密钥
 */
export async function recognizeWithCloudOCR(
  imageFile: File,
  provider: OCRProvider = "baidu",
  options?: {
    enableTable?: boolean;
  }
): Promise<CloudOCRResult> {
  // 转换图片为 base64
  const base64 = await fileToBase64(imageFile);

  // 调用 Next.js API Route
  const response = await fetch("/api/ocr/recognize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: base64,
      provider,
      enableTable: options?.enableTable || false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "OCR 识别失败");
  }

  return response.json();
}

/**
 * 转换百度 OCR 结果格式
 */
function convertBaiduResult(data: any): CloudOCRResult {
  const words: CloudOCRResult["words"] = [];
  const lines: CloudOCRResult["lines"] = [];
  
  if (data.words_result) {
    data.words_result.forEach((item: any, index: number) => {
      const bbox = item.location || {};
      const word = {
        text: item.words || "",
        bbox: {
          x0: bbox.left || 0,
          y0: bbox.top || 0,
          x1: (bbox.left || 0) + (bbox.width || 0),
          y1: (bbox.top || 0) + (bbox.height || 0),
        },
        confidence: item.probability ? item.probability * 100 : 0,
      };
      
      words.push(word);
      
      // 按行分组（简化处理）
      lines.push({
        text: item.words || "",
        words: [word],
        bbox: word.bbox,
      });
    });
  }

  // 提取表格（如果启用）
  const tables: CloudOCRResult["tables"] = [];
  if (data.tables_result && data.tables_result.length > 0) {
    data.tables_result.forEach((table: any) => {
      if (table.body && table.body.length > 0) {
        const rows: string[][] = [];
        table.body.forEach((row: any) => {
          if (row.words) {
            rows.push(row.words.map((cell: any) => cell.words || ""));
          }
        });
        tables.push({
          rows,
          headers: table.header ? table.header.map((h: any) => h.words || "") : undefined,
        });
      }
    });
  }

  return {
    text: data.words_result?.map((item: any) => item.words).join("\n") || "",
    confidence: data.words_result?.reduce((sum: number, item: any) => 
      sum + (item.probability || 0), 0) / (data.words_result?.length || 1) * 100 || 0,
    words,
    lines,
    tables: tables.length > 0 ? tables : undefined,
  };
}

/**
 * 将文件转换为 base64
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 移除 data:image/...;base64, 前缀
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * PDF 转图片（用于 OCR）
 */
export async function pdfToImages(pdfFile: File): Promise<File[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const images: File[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // 2倍缩放提高清晰度

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("无法创建 Canvas 上下文");
    }

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // 将 canvas 转换为 Blob，再转为 File
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas 转换失败"));
        }
      }, "image/png");
    });

    images.push(new File([blob], `page-${pageNum}.png`, { type: "image/png" }));
  }

  return images;
}

