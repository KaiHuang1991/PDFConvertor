import { NextRequest, NextResponse } from "next/server";

/**
 * OCR API 配置检测端点
 * 仅检查环境变量是否配置，不实际调用 OCR API
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.BAIDU_OCR_API_KEY;
    const secretKey = process.env.BAIDU_OCR_SECRET_KEY;

    const isConfigured = !!(apiKey && secretKey);

    return NextResponse.json({
      configured: isConfigured,
      provider: "baidu",
      message: isConfigured
        ? "百度 OCR API 已配置"
        : "百度 OCR API 未配置，请在 .env.local 中添加 BAIDU_OCR_API_KEY 和 BAIDU_OCR_SECRET_KEY",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        configured: false,
        error: error.message || "检测配置时出错",
      },
      { status: 500 }
    );
  }
}

