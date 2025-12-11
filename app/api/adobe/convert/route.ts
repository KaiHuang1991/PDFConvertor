import { NextRequest, NextResponse } from "next/server";
import { convertPDFWithAdobe, checkAdobeConfig, AdobeConvertFormat } from "@/lib/adobe-pdf-services";

/**
 * Adobe PDF 转换 API Route
 */
export async function POST(request: NextRequest) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📥 [PDF转Word调试] 收到转换请求");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  try {
    // 检查配置
    console.log("[1/8] 检查Adobe API配置...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔍 [环境变量检查]");
    console.log("  - process.env.ADOBE_CLIENT_ID 存在:", !!process.env.ADOBE_CLIENT_ID);
    console.log("  - process.env.ADOBE_CLIENT_ID 长度:", process.env.ADOBE_CLIENT_ID?.length || 0);
    console.log("  - process.env.ADOBE_CLIENT_SECRET 存在:", !!process.env.ADOBE_CLIENT_SECRET);
    console.log("  - process.env.ADOBE_CLIENT_SECRET 长度:", process.env.ADOBE_CLIENT_SECRET?.length || 0);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const configCheck = checkAdobeConfig();
    if (!configCheck.configured) {
      console.error("❌ Adobe API未配置:", configCheck.message);
      return NextResponse.json(
        { error: "Adobe API 未配置", message: configCheck.message },
        { status: 400 }
      );
    }
    console.log("✅ Adobe API配置检查通过");

    // 获取请求参数
    console.log("[2/8] 解析FormData...");
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const format = formData.get("format") as string;

    console.log("📋 请求参数:");
    console.log("  - format:", format);
    console.log("  - file存在:", !!file);
    if (file) {
      console.log("  - 文件名:", file.name);
      console.log("  - 文件类型:", file.type);
      console.log("  - 文件大小:", file.size, "bytes");
    }

    if (!file) {
      console.error("❌ 未提供文件");
      return NextResponse.json(
        { error: "未提供文件" },
        { status: 400 }
      );
    }

    if (!format) {
      console.error("❌ 未指定转换格式");
      return NextResponse.json(
        { error: "未指定转换格式" },
        { status: 400 }
      );
    }

    // 验证格式
    console.log("[3/8] 验证转换格式...");
    const supportedFormats: AdobeConvertFormat[] = ['docx', 'pptx', 'xlsx', 'rtf', 'jpg', 'png'];
    if (!supportedFormats.includes(format as AdobeConvertFormat)) {
      console.error("❌ 不支持的格式:", format);
      return NextResponse.json(
        { error: `不支持的转换格式: ${format}。支持格式: ${supportedFormats.join(', ')}` },
        { status: 400 }
      );
    }
    console.log("✅ 格式验证通过:", format);

    // 验证文件类型
    console.log("[4/8] 验证文件类型...");
    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    console.log("  - 文件类型检查:", {
      mimeType: file.type,
      fileName: file.name,
      isPDF: isPDF
    });
    
    if (!isPDF) {
      console.error("❌ 文件不是PDF格式");
      return NextResponse.json(
        { error: "仅支持 PDF 文件" },
        { status: 400 }
      );
    }
    console.log("✅ 文件类型验证通过");

    // 转换为 Buffer
    console.log("[5/8] 转换文件为Buffer...");
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    console.log("📊 PDF Buffer信息:");
    console.log("  - Buffer长度:", pdfBuffer.length, "bytes");
    console.log("  - Buffer前16字节(hex):", pdfBuffer.slice(0, 16).toString('hex'));
    console.log("  - Buffer前16字节(ascii):", pdfBuffer.slice(0, 16).toString('ascii').replace(/[^\x20-\x7E]/g, '.'));
    
    // 验证PDF文件头
    const pdfHeader = pdfBuffer.slice(0, 4).toString('ascii');
    if (pdfHeader !== '%PDF') {
      console.warn("⚠️ 警告: PDF文件头不正确，可能不是有效的PDF文件");
      console.warn("  实际文件头:", pdfHeader);
    } else {
      console.log("✅ PDF文件头验证通过");
    }

    console.log(`[6/8] 开始调用Adobe API转换: ${file.name} -> ${format}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // 执行转换
    const convertedBuffer = await convertPDFWithAdobe(pdfBuffer, format as AdobeConvertFormat);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[7/8] Adobe API转换完成");
    console.log("📊 转换结果信息:");
    console.log("  - 结果Buffer长度:", convertedBuffer.length, "bytes");
    console.log("  - 结果Buffer前16字节(hex):", convertedBuffer.slice(0, 16).toString('hex'));
    console.log("  - 结果Buffer前16字节(ascii):", convertedBuffer.slice(0, 16).toString('ascii').replace(/[^\x20-\x7E]/g, '.'));
    
    // 检查结果是否为空
    if (convertedBuffer.length === 0) {
      console.error("❌ 转换结果为空！");
      return NextResponse.json(
        { error: "转换结果为空，可能是Adobe API返回了空文件" },
        { status: 500 }
      );
    }
    
    // 对于docx文件，检查ZIP文件头（docx是ZIP格式）
    if (format === 'docx') {
      const zipHeader = convertedBuffer.slice(0, 2).toString('hex');
      if (zipHeader === '504b') {
        console.log("✅ DOCX文件头验证通过 (ZIP格式)");
      } else {
        console.warn("⚠️ 警告: DOCX文件头不正确，可能转换失败");
        console.warn("  期望: 504b (PK, ZIP格式)");
        console.warn("  实际:", zipHeader);
      }
    }

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

    console.log("[8/8] 准备返回响应");
    console.log("📤 响应信息:");
    console.log("  - Content-Type:", mimeTypes[format as AdobeConvertFormat]);
    console.log("  - 文件名:", `${baseName}.${extension}`);
    console.log("  - 文件大小:", convertedBuffer.length, "bytes");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // 返回转换后的文件
    return new NextResponse(convertedBuffer, {
      headers: {
        "Content-Type": mimeTypes[format as AdobeConvertFormat],
        "Content-Disposition": `attachment; filename="${baseName}.${extension}"`,
        "Content-Length": convertedBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ [PDF转Word调试] 转换失败");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("错误信息:", error.message);
    console.error("错误堆栈:", error.stack);
    if (error.cause) {
      console.error("错误原因:", error.cause);
    }
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
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

