import { NextRequest, NextResponse } from "next/server";
import { convertPDFWithAdobe, checkAdobeConfig, AdobeConvertFormat } from "@/lib/adobe-pdf-services";

/**
 * Adobe PDF 转换 API Route
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

    if (!format) {
      return NextResponse.json(
        { error: "未指定转换格式" },
        { status: 400 }
      );
    }

    // 验证格式
    const supportedFormats: AdobeConvertFormat[] = ['docx', 'pptx', 'xlsx', 'rtf', 'jpg', 'png'];
    if (!supportedFormats.includes(format as AdobeConvertFormat)) {
      return NextResponse.json(
        { error: `不支持的转换格式: ${format}。支持格式: ${supportedFormats.join(', ')}` },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "仅支持 PDF 文件" },
        { status: 400 }
      );
    }

    // 转换为 Buffer
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    console.log(`开始 Adobe PDF 转换: ${file.name} -> ${format}, 大小: ${pdfBuffer.length} bytes`);

    // 执行转换
    const convertedBuffer = await convertPDFWithAdobe(pdfBuffer, format as AdobeConvertFormat);

    console.log(`Adobe PDF 转换完成，结果大小: ${convertedBuffer.length} bytes`);

    // 确定 MIME 类型
    const mimeTypes: Record<AdobeConvertFormat, string> = {
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      rtf: 'application/rtf',
      jpg: 'image/jpeg',
      png: 'image/png',
    };

    // 确定文件扩展名
    const extension = format;
    const baseName = file.name.replace(/\.pdf$/i, '');

    // 返回转换后的文件
    return new NextResponse(convertedBuffer, {
      headers: {
        "Content-Type": mimeTypes[format as AdobeConvertFormat],
        "Content-Disposition": `attachment; filename="${baseName}.${extension}"`,
      },
    });
  } catch (error: any) {
    console.error("Adobe PDF 转换失败:", error);
    return NextResponse.json(
      {
        error: error.message || "PDF 转换失败",
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
    supportedFormats: ['docx', 'pptx', 'xlsx', 'rtf', 'jpg', 'png'],
    configured: checkAdobeConfig().configured,
  });
}

