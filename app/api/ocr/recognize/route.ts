import { NextRequest, NextResponse } from "next/server";

/**
 * OCR 识别 API Route
 * 在后端调用云端 OCR API，保护 API 密钥
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, provider = "baidu", enableTable = false } = body;

    if (!image) {
      return NextResponse.json(
        { error: "缺少图片数据" },
        { status: 400 }
      );
    }

    // 根据 provider 调用不同的 OCR 服务
    let result;
    
    switch (provider) {
      case "baidu":
        result = await recognizeWithBaiduOCR(image, enableTable);
        break;
      case "tencent":
        result = await recognizeWithTencentOCR(image, enableTable);
        break;
      case "aliyun":
        result = await recognizeWithAliyunOCR(image, enableTable);
        break;
      default:
        return NextResponse.json(
          { error: "不支持的 OCR 服务商" },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("OCR 识别失败:", error);
    return NextResponse.json(
      { error: error.message || "OCR 识别失败" },
      { status: 500 }
    );
  }
}

/**
 * 百度 OCR 识别
 */
async function recognizeWithBaiduOCR(
  base64Image: string,
  enableTable: boolean
): Promise<any> {
  const apiKey = process.env.BAIDU_OCR_API_KEY;
  const secretKey = process.env.BAIDU_OCR_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error("未配置百度 OCR API 密钥");
  }

  // 获取 access_token
  const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
  const tokenResponse = await fetch(tokenUrl);
  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    throw new Error("获取百度 OCR access_token 失败");
  }

  // 调用 OCR API
  const apiUrl = enableTable
    ? "https://aip.baidubce.com/rest/2.0/ocr/v1/table"
    : "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic";

  const response = await fetch(`${apiUrl}?access_token=${tokenData.access_token}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      image: base64Image,
      language_type: "CHN_ENG",
    }),
  });

  const data = await response.json();

  if (data.error_code) {
    throw new Error(`百度 OCR 识别失败: ${data.error_msg}`);
  }

  return data;
}

/**
 * 腾讯 OCR 识别（需要实现签名算法）
 */
async function recognizeWithTencentOCR(
  base64Image: string,
  enableTable: boolean
): Promise<any> {
  // TODO: 实现腾讯云 OCR
  throw new Error("腾讯 OCR 暂未实现");
}

/**
 * 阿里云 OCR 识别（需要实现签名算法）
 */
async function recognizeWithAliyunOCR(
  base64Image: string,
  enableTable: boolean
): Promise<any> {
  // TODO: 实现阿里云 OCR
  throw new Error("阿里云 OCR 暂未实现");
}

