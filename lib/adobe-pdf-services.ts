/**
 * Adobe PDF Services API 集成 (SDK 4.1.0)
 * 提供 OCR 和 PDF 转换功能
 */

import { Readable } from 'stream';

// 动态导入 Adobe SDK，避免在客户端打包
let PDFServicesSdk: any = null;

function getPDFServicesSdk() {
  if (typeof window !== 'undefined') {
    throw new Error('Adobe PDF Services SDK 只能在服务器端使用');
  }
  if (!PDFServicesSdk) {
    PDFServicesSdk = require('@adobe/pdfservices-node-sdk');
  }
  return PDFServicesSdk;
}

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
 * 创建 Adobe PDF Services 客户端
 */
function createPDFServices() {
  const clientId = process.env.ADOBE_CLIENT_ID?.trim();
  const clientSecret = process.env.ADOBE_CLIENT_SECRET?.trim();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔐 [Adobe API] 检查凭证配置");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  - ADOBE_CLIENT_ID 存在:", !!clientId);
  console.log("  - ADOBE_CLIENT_ID 长度:", clientId?.length || 0);
  console.log("  - ADOBE_CLIENT_ID 前10字符:", clientId?.substring(0, 10) || 'N/A');
  console.log("  - ADOBE_CLIENT_ID 后10字符:", clientId?.substring(Math.max(0, (clientId?.length || 0) - 10)) || 'N/A');
  console.log("  - ADOBE_CLIENT_SECRET 存在:", !!clientSecret);
  console.log("  - ADOBE_CLIENT_SECRET 长度:", clientSecret?.length || 0);
  console.log("  - ADOBE_CLIENT_SECRET 前10字符:", clientSecret?.substring(0, 10) || 'N/A');
  console.log("  - ADOBE_CLIENT_SECRET 后10字符:", clientSecret?.substring(Math.max(0, (clientSecret?.length || 0) - 10)) || 'N/A');
  
  // 检查是否有常见问题
  if (clientId && (clientId.includes('"') || clientId.includes("'"))) {
    console.warn("  ⚠️ 警告: ADOBE_CLIENT_ID 包含引号，请移除引号");
  }
  if (clientSecret && (clientSecret.includes('"') || clientSecret.includes("'"))) {
    console.warn("  ⚠️ 警告: ADOBE_CLIENT_SECRET 包含引号，请移除引号");
  }
  if (clientId && clientId.startsWith(' ')) {
    console.warn("  ⚠️ 警告: ADOBE_CLIENT_ID 开头有空格");
  }
  if (clientSecret && clientSecret.startsWith(' ')) {
    console.warn("  ⚠️ 警告: ADOBE_CLIENT_SECRET 开头有空格");
  }
  
  if (!clientId || !clientSecret) {
    const missing = [];
    if (!clientId) missing.push('ADOBE_CLIENT_ID');
    if (!clientSecret) missing.push('ADOBE_CLIENT_SECRET');
    throw new Error(`未配置 Adobe API 凭证，请在 .env.local 中设置: ${missing.join(', ')}`);
  }

  if (clientId.length === 0 || clientSecret.length === 0) {
    throw new Error('Adobe API 凭证不能为空，请检查 .env.local 文件中的配置');
  }

  const SDK = getPDFServicesSdk();
  
  if (!SDK || !SDK.ServicePrincipalCredentials || !SDK.PDFServices) {
    throw new Error('无法加载 Adobe PDF Services SDK，请确保 @adobe/pdfservices-node-sdk 已正确安装');
  }

  try {
    console.log("  - 创建 ServicePrincipalCredentials...");
    console.log("  - 参数检查:");
    console.log("    * clientId 类型:", typeof clientId);
    console.log("    * clientId 值:", clientId?.substring(0, 20) + '...');
    console.log("    * clientSecret 类型:", typeof clientSecret);
    console.log("    * clientSecret 值:", clientSecret?.substring(0, 20) + '...');
    
    // 创建凭证
    const credentials = new SDK.ServicePrincipalCredentials({
      clientId,
      clientSecret,
    });
    console.log("  ✅ 凭证创建成功");

    console.log("  - 创建 PDFServices 实例...");
    // 创建 PDF Services 实例
    const pdfServices = new SDK.PDFServices({ credentials });
    console.log("  ✅ PDFServices 实例创建成功");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return pdfServices;
  } catch (error: any) {
    console.error("  ❌ 创建凭证失败:", error.message);
    console.error("  - 错误详情:", error);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    throw new Error(`Adobe API 凭证创建失败: ${error.message || '未知错误'}`);
  }
}

/**
 * 轮询任务结果
 */
async function pollJobResult(
  pdfServices: any,
  pollingURL: string,
  resultType: any,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<any> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await pdfServices.getJobResult({
        pollingURL,
        resultType,
      });

      if (response.status === 'done') {
        return response;
      }

      if (response.status === 'failed') {
        throw new Error(`任务失败: ${response.message || '未知错误'}`);
      }

      // 任务还在处理中，等待后重试
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    } catch (error: any) {
      // 如果是 404，说明任务还在处理中
      if (error.statusCode === 404 || error.message?.includes('404')) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        continue;
      }
      throw error;
    }
  }

  throw new Error('任务超时，请稍后重试');
}

/**
 * Adobe OCR 识别
 * 将扫描的 PDF 转换为可搜索的 PDF（带 OCR 文本层）
 */
export async function performAdobeOCR(pdfBuffer: Buffer): Promise<Buffer> {
  const pdfServices = createPDFServices();
  const SDK = getPDFServicesSdk();

  try {
    console.log("[步骤1] 上传PDF文件...");
    // 上传文件
    const readStream = Readable.from(pdfBuffer);
    const inputAsset = await pdfServices.upload({
      readStream,
      mimeType: SDK.MimeType.PDF,
    });
    console.log("✅ 文件上传成功");

    console.log("[步骤2] 创建OCR参数...");
    // 创建 OCR 参数
    const ocrParams = new SDK.OCRParams({
      ocrLocale: SDK.OCRSupportedLocale.EN_US,
      ocrType: SDK.OCRSupportedType.SEARCHABLE_IMAGE_EXACT,
    });
    console.log("✅ OCR参数创建成功");

    console.log("[步骤3] 创建OCR任务...");
    // 创建 OCR 任务
    const ocrJob = new SDK.OCRJob({ 
      inputAsset,
      params: ocrParams,
    });
    console.log("✅ OCR任务创建成功");

    console.log("[步骤4] 提交OCR任务...");
    // 提交任务
    const pollingURL = await pdfServices.submit({ job: ocrJob });
    console.log("✅ OCR任务提交成功，pollingURL:", pollingURL);

    console.log("[步骤5] 轮询OCR结果...");
    // 轮询结果
    const response = await pollJobResult(
      pdfServices,
      pollingURL,
      SDK.OCRResult
    );
    console.log("✅ OCR任务完成");

    console.log("[步骤6] 下载OCR结果...");
    // 下载结果
    const resultAsset = response.result.asset;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });
    
    // 将流转换为 Buffer
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      streamAsset.readStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      streamAsset.readStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      streamAsset.readStream.on('error', (error: Error) => {
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
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔧 [Adobe API] 开始PDF转换");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("输入参数:");
  console.log("  - 格式:", format);
  console.log("  - PDF Buffer大小:", pdfBuffer.length, "bytes");
  
  const pdfServices = createPDFServices();
  const SDK = getPDFServicesSdk();
  console.log("✅ Adobe客户端初始化成功");

  try {
    console.log("[步骤1] 上传PDF文件...");
    // 上传文件
    const readStream = Readable.from(pdfBuffer);
    const inputAsset = await pdfServices.upload({
      readStream,
      mimeType: SDK.MimeType.PDF,
    });
    console.log("✅ 文件上传成功");

    console.log("[步骤2] 创建导出参数...");
    // 设置目标格式
    let targetFormat: any;
    switch (format) {
      case 'docx':
        targetFormat = SDK.ExportPDFTargetFormat.DOCX;
        break;
      case 'pptx':
        targetFormat = SDK.ExportPDFTargetFormat.PPTX;
        break;
      case 'xlsx':
        targetFormat = SDK.ExportPDFTargetFormat.XLSX;
        break;
      case 'rtf':
        targetFormat = SDK.ExportPDFTargetFormat.RTF;
        break;
      case 'jpg':
        targetFormat = SDK.ExportPDFTargetFormat.JPEG;
        break;
      case 'png':
        targetFormat = SDK.ExportPDFTargetFormat.PNG;
        break;
      default:
        throw new Error(`不支持的转换格式: ${format}`);
    }

    const params = new SDK.ExportPDFParams({
      targetFormat,
    });
    console.log("✅ 导出参数创建成功");

    console.log("[步骤3] 创建导出任务...");
    // 创建导出任务
    const job = new SDK.ExportPDFJob({
      inputAsset,
      params,
    });
    console.log("✅ 导出任务创建成功");

    console.log("[步骤4] 提交导出任务...");
    // 提交任务
    const pollingURL = await pdfServices.submit({ job });
    console.log("✅ 导出任务提交成功，pollingURL:", pollingURL);

    console.log("[步骤5] 轮询导出结果...");
    // 轮询结果
    const response = await pollJobResult(
      pdfServices,
      pollingURL,
      SDK.ExportPDFResult
    );
    console.log("✅ 导出任务完成");

    console.log("[步骤6] 下载导出结果...");
    // 下载结果
    const resultAsset = response.result.asset;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });
    
    // 将流转换为 Buffer
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    
    return new Promise((resolve, reject) => {
      streamAsset.readStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        totalBytes += chunk.length;
        if (chunks.length % 10 === 0) {
          console.log(`  📥 已接收 ${chunks.length} 个数据块，共 ${totalBytes} bytes`);
        }
      });
      streamAsset.readStream.on('end', () => {
        const finalBuffer = Buffer.concat(chunks);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("✅ [Adobe API] 转换完成");
        console.log("📊 结果统计:");
        console.log("  - 数据块数量:", chunks.length);
        console.log("  - 总字节数:", finalBuffer.length);
        console.log("  - 前16字节(hex):", finalBuffer.slice(0, 16).toString('hex'));
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        resolve(finalBuffer);
      });
      streamAsset.readStream.on('error', (error: Error) => {
        console.error("❌ [Adobe API] 流错误:", error);
        reject(error);
      });
    });
  } catch (error: any) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ [Adobe API] 转换错误");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("错误类型:", error.constructor.name);
    console.error("错误消息:", error.message);
    console.error("错误堆栈:", error.stack);
    if (error.statusCode) {
      console.error("HTTP状态码:", error.statusCode);
    }
    if (error.requestId) {
      console.error("请求ID:", error.requestId);
    }
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    throw new Error(`Adobe PDF 转换失败: ${error.message || '未知错误'}`);
  }
}

/**
 * Word/Office 文档转 PDF
 * 支持: DOCX, PPTX, XLSX, RTF 等格式
 */
export async function convertToPDFWithAdobe(
  fileBuffer: Buffer,
  sourceFormat: 'docx' | 'pptx' | 'xlsx' | 'rtf' | 'txt' | 'html'
): Promise<Buffer> {
  const pdfServices = createPDFServices();
  const SDK = getPDFServicesSdk();

  try {
    console.log("[步骤1] 上传源文件...");
    // 确定 MIME 类型
    let mimeType: string;
    switch (sourceFormat) {
      case 'docx':
        mimeType = SDK.MimeType.DOCX;
        break;
      case 'pptx':
        mimeType = SDK.MimeType.PPTX;
        break;
      case 'xlsx':
        mimeType = SDK.MimeType.XLSX;
        break;
      case 'rtf':
        mimeType = SDK.MimeType.RTF;
        break;
      case 'txt':
        mimeType = SDK.MimeType.TXT;
        break;
      case 'html':
        mimeType = SDK.MimeType.HTML;
        break;
      default:
        throw new Error(`不支持的源格式: ${sourceFormat}`);
    }

    // 上传文件
    const readStream = Readable.from(fileBuffer);
    const inputAsset = await pdfServices.upload({
      readStream,
      mimeType,
    });
    console.log("✅ 文件上传成功");

    console.log("[步骤2] 创建PDF任务...");
    // 创建 PDF 任务
    const job = new SDK.CreatePDFJob({ inputAsset });
    console.log("✅ PDF任务创建成功");

    console.log("[步骤3] 提交PDF任务...");
    // 提交任务
    const pollingURL = await pdfServices.submit({ job });
    console.log("✅ PDF任务提交成功，pollingURL:", pollingURL);

    console.log("[步骤4] 轮询PDF结果...");
    // 轮询结果
    const response = await pollJobResult(
      pdfServices,
      pollingURL,
      SDK.CreatePDFResult
    );
    console.log("✅ PDF任务完成");

    console.log("[步骤5] 下载PDF结果...");
    // 下载结果
    const resultAsset = response.result.asset;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });
    
    // 将流转换为 Buffer
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      streamAsset.readStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      streamAsset.readStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      streamAsset.readStream.on('error', (error: Error) => {
        reject(error);
      });
    });
  } catch (error: any) {
    console.error('Adobe 转 PDF 错误:', error);
    throw new Error(`Adobe 转 PDF 失败: ${error.message || '未知错误'}`);
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
