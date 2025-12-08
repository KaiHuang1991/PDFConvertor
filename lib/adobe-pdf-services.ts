/**
 * Adobe PDF Services API 集成
 * 提供 OCR 和 PDF 转换功能
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';

const PDFServicesSdk = require('@adobe/pdfservices-node-sdk');

export interface AdobeOCRResult {
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
}

export type AdobeConvertFormat = 'docx' | 'pptx' | 'xlsx' | 'rtf' | 'jpg' | 'png';

/**
 * 初始化 Adobe PDF Services SDK 客户端
 */
function getClient(): any {
  const clientId = process.env.ADOBE_CLIENT_ID;
  const clientSecret = process.env.ADOBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('未配置 Adobe API 凭证，请设置 ADOBE_CLIENT_ID 和 ADOBE_CLIENT_SECRET');
  }

  // 创建凭证
  const credentials = PDFServicesSdk.Credentials
    .servicePrincipalCredentialsBuilder()
    .withClientId(clientId)
    .withClientSecret(clientSecret)
    .build();

  // 创建执行上下文
  const executionContext = PDFServicesSdk.ExecutionContext.create(credentials);

  return executionContext;
}

/**
 * 将 Buffer 转换为临时文件
 */
function bufferToTempFile(buffer: Buffer, extension: string = 'pdf'): string {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `pdf_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`);
  fs.writeFileSync(tempFilePath, buffer);
  return tempFilePath;
}

/**
 * 清理临时文件
 */
function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`清理临时文件失败: ${filePath}`, error);
  }
}

/**
 * Adobe OCR 识别
 * 将扫描的 PDF 转换为可搜索的 PDF（带 OCR 文本层）
 */
export async function performAdobeOCR(pdfBuffer: Buffer): Promise<Buffer> {
  const executionContext = getClient();

  try {
    // 创建 OCR 操作
    const ocrOperation = PDFServicesSdk.OCR.Operation.createNew();

    // 将 Buffer 转换为 Stream
    const stream = Readable.from(pdfBuffer);

    // 创建输入文件引用
    const inputFileRef = PDFServicesSdk.FileRef.createFromStream(
      stream,
      PDFServicesSdk.OCR.SupportedSourceFormat.pdf
    );

    // 设置输入
    ocrOperation.setInput(inputFileRef);

    // OCR 选项 - 设置语言环境
    // 支持的语言: en_US, de_DE, fr_FR, da_DK 等
    ocrOperation.setOCRLocale(PDFServicesSdk.OCR.SupportedOCRLocale.en_US);

    // OCR 选项 - 设置 OCR 类型（可选）
    // SEARCHABLE_IMAGE: 修改原始图像并添加文本层
    // SEARCHABLE_IMAGE_EXACT: 保留原始图像并添加文本层
    ocrOperation.setOCRType(PDFServicesSdk.OCR.SupportedOCRType.SEARCHABLE_IMAGE_EXACT);

    // 执行 OCR
    const result = await ocrOperation.execute(executionContext);
    const resultAsset = await result.getResult();
    
    // 下载结果
    const resultStream = await executionContext.getAsset(resultAsset);
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      resultStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      resultStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      resultStream.on('error', (error: Error) => {
        reject(error);
      });
    });
  } catch (error: any) {
    console.error('Adobe OCR 错误:', error);
    throw new Error(`Adobe OCR 失败: ${error.message || '未知错误'}`);
  }
}

/**
 * PDF 转换为其他格式
 */
export async function convertPDFWithAdobe(
  pdfBuffer: Buffer,
  format: AdobeConvertFormat
): Promise<Buffer> {
  const executionContext = getClient();

  try {
    // 创建导出操作
    const exportPDF = PDFServicesSdk.ExportPDF.Operation.createNew();

    // 将 Buffer 转换为 Stream
    const stream = Readable.from(pdfBuffer);

    // 创建输入文件引用
    const inputFileRef = PDFServicesSdk.FileRef.createFromStream(
      stream,
      PDFServicesSdk.ExportPDF.SupportedSourceFormat.pdf
    );

    // 设置输入
    exportPDF.setInput(inputFileRef);

    // 设置输出格式
    let targetFormat: any;
    switch (format) {
      case 'docx':
        targetFormat = PDFServicesSdk.ExportPDF.TargetFormat.DOCX;
        break;
      case 'pptx':
        targetFormat = PDFServicesSdk.ExportPDF.TargetFormat.PPTX;
        break;
      case 'xlsx':
        targetFormat = PDFServicesSdk.ExportPDF.TargetFormat.XLSX;
        break;
      case 'rtf':
        targetFormat = PDFServicesSdk.ExportPDF.TargetFormat.RTF;
        break;
      case 'jpg':
        targetFormat = PDFServicesSdk.ExportPDF.TargetFormat.JPEG;
        break;
      case 'png':
        targetFormat = PDFServicesSdk.ExportPDF.TargetFormat.PNG;
        break;
      default:
        throw new Error(`不支持的转换格式: ${format}`);
    }

    exportPDF.setTargetFormat(targetFormat);

    // 执行转换
    const result = await exportPDF.execute(executionContext);
    const resultAsset = await result.getResult();

    // 下载结果
    const resultStream = await executionContext.getAsset(resultAsset);
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      resultStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      resultStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      resultStream.on('error', (error: Error) => {
        reject(error);
      });
    });
  } catch (error: any) {
    console.error('Adobe PDF 转换错误:', error);
    throw new Error(`Adobe PDF 转换失败: ${error.message || '未知错误'}`);
  }
}

/**
 * 检查 Adobe API 配置
 */
export function checkAdobeConfig(): { configured: boolean; message?: string } {
  const clientId = process.env.ADOBE_CLIENT_ID;
  const clientSecret = process.env.ADOBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      configured: false,
      message: '请在 .env.local 中配置 ADOBE_CLIENT_ID 和 ADOBE_CLIENT_SECRET',
    };
  }

  return {
    configured: true,
  };
}

