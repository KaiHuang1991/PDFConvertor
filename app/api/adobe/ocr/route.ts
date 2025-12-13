import { NextRequest, NextResponse } from "next/server";
import { performAdobeOCR, checkAdobeConfig } from "@/lib/adobe-pdf-services";

/**
 * Adobe OCR API Route
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

    // 获取 PDF 文件
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "未提供文件" },
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

    console.log(`开始 Adobe OCR 处理: ${file.name}, 大小: ${pdfBuffer.length} bytes`);

    // 执行 OCR
    const ocrResult = await performAdobeOCR(pdfBuffer);

    console.log(`Adobe OCR 处理完成，结果大小: ${ocrResult.length} bytes`);

    // 返回 OCR 后的 PDF（带文本层）
    return new NextResponse(ocrResult, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ocr_${file.name}"`,
      },
    });
  } catch (error: any) {
    console.error("Adobe OCR 失败:", error);
    return NextResponse.json(
      {
        error: error.message || "OCR 处理失败",
        details: error.stack,
      },
      { status: 500 }
    );
  }
}

/**
 * 检查配置状态
 */
export async function GET() {
  const configCheck = checkAdobeConfig();
  return NextResponse.json(configCheck);
}




