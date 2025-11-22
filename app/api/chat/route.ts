import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

export async function POST(request: NextRequest) {
  try {
    const { message, pdfText, history } = await request.json();

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "GROQ_API_KEY未配置，请在.env.local中添加GROQ_API_KEY" },
        { status: 500 }
      );
    }

    // 构建对话历史
    const messages: any[] = [
      {
        role: "system",
        content: `你是一个专业的PDF文档助手。用户上传了一份PDF文档，我已经提取了其中的文本内容。请根据PDF内容回答用户的问题。

PDF内容：
${pdfText}

请用中文回答，回答要准确、简洁、有帮助。如果问题涉及PDF中的具体内容，请引用相关部分。`,
      },
    ];

    // 添加历史对话（最近5轮）
    const recentHistory = history.slice(-5);
    recentHistory.forEach((msg: any) => {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    });

    // 添加当前问题
    messages.push({
      role: "user",
      content: message,
    });

    // 调用Groq API
    const completion = await groq.chat.completions.create({
      messages: messages as any,
      model: "llama-3.1-70b-versatile", // 或 "llama-3.1-8b-instant" 更快但质量稍低
      temperature: 0.7,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content || "抱歉，无法生成回复。";

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error.message || "AI服务暂时不可用，请稍后重试" },
      { status: 500 }
    );
  }
}

