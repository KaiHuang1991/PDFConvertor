import { NextRequest, NextResponse } from "next/server";
import { convertToPDFWithAdobe, checkAdobeConfig } from "@/lib/adobe-pdf-services";

/**
 * Word/Office 文档转 PDF API Route
 */
export async function POST(request: NextRequest) {
  try {
    // 检查配置
    const configCheck = checkAdobeConfig();
    if (!configCheck.configured) {
      return NextResponse.json(
        { error: "Adobe API 未配置", message: configCheck.message },
        { status: 400 }
      );
    }

    // 获取请求参数
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const format = formData.get("format") as string;

    if (!file) {
      return NextResponse.json(
        { error: "未提供文件" },
        { status: 400 }
      );
    }

    // 验证文件类型并确定源格式
    const fileName = file.name.toLowerCase();
    let sourceFormat: 'docx' | 'pptx' | 'xlsx' | 'rtf' | 'txt' | 'html' | null = null;

    if (fileName.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      sourceFormat = 'docx';
    } else if (fileName.endsWith('.pptx') || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      sourceFormat = 'pptx';
    } else if (fileName.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      sourceFormat = 'xlsx';
    } else if (fileName.endsWith('.rtf') || file.type === 'application/rtf') {
      sourceFormat = 'rtf';
    } else if (fileName.endsWith('.txt') || file.type === 'text/plain') {
      sourceFormat = 'txt';
    } else if (fileName.endsWith('.html') || fileName.endsWith('.htm') || file.type === 'text/html') {
      sourceFormat = 'html';
    } else if (format) {
      // 如果提供了format参数，使用它
      sourceFormat = format as any;
    }

    if (!sourceFormat) {
      return NextResponse.json(
        { error: "不支持的文件格式。支持格式: DOCX, PPTX, XLSX, RTF, TXT, HTML" },
        { status: 400 }
      );
    }

    // 转换为 Buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    console.log(`开始 Adobe 转 PDF: ${file.name} (${sourceFormat}) -> PDF, 大小: ${fileBuffer.length} bytes`);

    // 执行转换
    const pdfBuffer = await convertToPDFWithAdobe(fileBuffer, sourceFormat);

    console.log(`Adobe 转 PDF 完成，结果大小: ${pdfBuffer.length} bytes`);

    // 确定输出文件名
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const outputFileName = `${baseName}.pdf`;

    // 返回转换后的 PDF 文件
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${outputFileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Adobe 转 PDF 失败:", error);
    return NextResponse.json(
      {
        error: error.message || "转 PDF 失败",
        details: error.stack,
      },
      { status: 500 }
    );
  }
}

/**
 * 获取支持的转换格式
 */
export async function GET() {
  return NextResponse.json({
    supportedFormats: ['docx', 'pptx', 'xlsx', 'rtf', 'txt', 'html'],
    configured: checkAdobeConfig().configured,
  });
}

