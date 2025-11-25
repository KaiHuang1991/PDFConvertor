import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { HttpsProxyAgent } from "https-proxy-agent";

// 创建 Groq 客户端，支持代理配置
function createGroqClient() {
  const apiKey = process.env.GROQ_API_KEY || "";
  const proxyUrl = process.env.GROQ_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  
  const config: any = {
    apiKey: apiKey,
  };
  
  // 如果配置了代理，设置代理 agent
  if (proxyUrl) {
    try {
      const agent = new HttpsProxyAgent(proxyUrl);
      // Groq SDK 可能不支持直接传入 agent，但我们可以通过环境变量设置
      // 同时设置环境变量以确保其他 HTTP 请求也使用代理
      if (!process.env.HTTPS_PROXY && !process.env.HTTP_PROXY) {
        process.env.HTTPS_PROXY = proxyUrl;
        process.env.HTTP_PROXY = proxyUrl;
      }
      console.log("已配置 Groq API 代理:", proxyUrl.replace(/:[^:@]*@/, ':****@')); // 隐藏密码
    } catch (error) {
      console.warn("代理配置失败:", error);
    }
  }
  
  return new Groq(config);
}

const groq = createGroqClient();

// DeepSeek API 配置（中国用户推荐使用）
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

export async function POST(request: NextRequest) {
  try {
    const { message, pdfText, history } = await request.json();

    // 验证输入
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "消息内容不能为空" },
        { status: 400 }
      );
    }

    if (!pdfText || typeof pdfText !== "string" || !pdfText.trim()) {
      return NextResponse.json(
        { error: "PDF内容未提取，请先上传并提取PDF文件" },
        { status: 400 }
      );
    }

    // 检查是否有可用的 API Key
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (!deepseekApiKey && !groqApiKey) {
      return NextResponse.json(
        { error: "未配置API Key。请选择以下方案之一：\n\n方案1（推荐，中国可用）：\n在.env.local中添加 DEEPSEEK_API_KEY\n访问 https://platform.deepseek.com/ 获取API Key\n\n方案2（需要代理）：\n在.env.local中添加 GROQ_API_KEY\n访问 https://console.groq.com/ 获取API Key" },
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

    // 优先使用 DeepSeek（中国用户推荐），否则使用 Groq
    if (deepseekApiKey) {
      try {
        // 清理 API Key 中的特殊字符（包括中文引号等）
        const cleanedApiKey = deepseekApiKey
          .replace(/["'""''「」『』《》\u200B-\u200D\uFEFF]/g, '')
          .trim();
        
        const response = await fetch(DEEPSEEK_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${cleanedApiKey}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: messages,
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 401) {
            return NextResponse.json(
              { error: "DeepSeek API Key无效或已过期，请检查DEEPSEEK_API_KEY配置。访问 https://platform.deepseek.com/ 查看API Key状态" },
              { status: 401 }
            );
          }
          if (response.status === 402) {
            return NextResponse.json(
              { error: "DeepSeek 账户余额不足，请访问 https://platform.deepseek.com/ 充值。API Key 有效，连接正常。" },
              { status: 402 }
            );
          }
          if (response.status === 403) {
            return NextResponse.json(
              { error: "DeepSeek API Key没有权限，请检查账户状态。访问 https://platform.deepseek.com/ 查看账户信息" },
              { status: 403 }
            );
          }
          throw new Error(errorData.error?.message || `DeepSeek API错误: ${response.statusText}`);
        }

        const data = await response.json();
        const aiResponse = data.choices?.[0]?.message?.content || "抱歉，无法生成回复。";
        return NextResponse.json({ response: aiResponse });
      } catch (deepseekError: any) {
        console.error("DeepSeek API error:", deepseekError);
        // 如果 DeepSeek 失败且有 Groq API Key，尝试使用 Groq
        if (groqApiKey) {
          console.log("DeepSeek API 失败，尝试使用 Groq API...");
        } else {
          return NextResponse.json(
            { error: `DeepSeek API错误: ${deepseekError.message || "服务暂时不可用"}` },
            { status: 500 }
          );
        }
      }
    }

    // 使用 Groq API（如果配置了）
    if (groqApiKey) {
      // 清理 API Key 中的特殊字符
      const cleanedGroqApiKey = groqApiKey
        .replace(/["'""''「」『』《》\u200B-\u200D\uFEFF]/g, '')
        .trim();
      
      // 检查是否配置了代理
      const proxyUrl = process.env.GROQ_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      
      // 如果配置了代理，使用直接 fetch 方式（确保代理生效）
      if (proxyUrl) {
        console.log("使用代理访问 Groq API:", proxyUrl.replace(/:[^:@]*@/, ':****@'));
        
        // 创建代理 agent
        const agent = new HttpsProxyAgent(proxyUrl);
        
        const models = [
          "llama-3.1-70b-versatile",
          "llama-3.1-8b-instant",
          "llama-3.3-70b-versatile",
          "mixtral-8x7b-32768"
        ];

        let lastError: any = null;
        for (const model of models) {
          try {
            // 使用 undici fetch，支持通过 dispatcher 配置代理
            const { fetch: undiciFetch, ProxyAgent } = await import('undici');
            
            // 创建 ProxyAgent 来使用代理
            const proxyAgent = new ProxyAgent(proxyUrl);
            
            console.log(`尝试通过代理 ${proxyUrl} 访问 Groq API (模型: ${model})`);
            
            const response = await undiciFetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${cleanedGroqApiKey}`,
              },
              dispatcher: proxyAgent,
              body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({})) as any;
              const errorMessage = errorData?.error?.message || `Groq API错误: ${response.statusText}`;
              console.error(`Groq API 请求失败 (模型: ${model}):`, {
                status: response.status,
                statusText: response.statusText,
                error: errorMessage,
                proxy: proxyUrl.replace(/:[^:@]*@/, ':****@')
              });
              const error = new Error(errorMessage);
              // @ts-ignore
              error.status = response.status;
              throw error;
            }

            const data = await response.json() as any;
            const aiResponse = data?.choices?.[0]?.message?.content || "抱歉，无法生成回复。";
            return NextResponse.json({ response: aiResponse });
          } catch (fetchError: any) {
            lastError = fetchError;
            
            // 401和403错误通常是API Key或代理问题，不需要尝试其他模型
            if (fetchError.status === 401 || fetchError.statusCode === 401) {
              return NextResponse.json(
                { error: "Groq API Key无效或已过期，请检查GROQ_API_KEY配置。访问 https://console.groq.com/ 查看API Key状态\n\n提示：如果您在中国，建议使用 DeepSeek API（配置 DEEPSEEK_API_KEY）" },
                { status: 401 }
              );
            }
            
            if (fetchError.status === 403 || fetchError.statusCode === 403) {
              return NextResponse.json(
                { error: `Groq API 访问被拒绝（403）。可能的原因：\n1) 代理配置不正确或代理未正常工作\n2) API Key无效或已过期\n3) 账户被限制\n\n请检查：\n- 代理地址是否正确（当前: ${proxyUrl.replace(/:[^:@]*@/, ':****@')}）\n- Clash 是否正常运行\n- 系统代理是否已启用` },
                { status: 403 }
              );
            }
            
            // 其他错误（如模型不存在），尝试下一个模型
            if (model !== models[models.length - 1]) {
              console.warn(`模型 ${model} 失败: ${fetchError.message}，尝试下一个模型...`);
              continue;
            }
            
            // 已经是最后一个模型，跳出循环
            break;
          }
        }

        // 如果所有模型都失败，处理错误
        if (lastError) {
          console.error("Groq API error (with proxy):", lastError);
          const errorStatus = lastError.status || (lastError.message?.includes('403') ? 403 : 500);
          
          return NextResponse.json(
            { error: `Groq API错误: ${lastError.message}\n\n提示：请检查代理配置是否正确，或使用 DeepSeek API（配置 DEEPSEEK_API_KEY）` },
            { status: errorStatus }
          );
        }
      } else {
        // 没有配置代理，使用 SDK（可能在中国无法访问）
        const groqClient = new Groq({
          apiKey: cleanedGroqApiKey,
        });
        
        const models = [
          "llama-3.1-70b-versatile",
          "llama-3.1-8b-instant",
          "llama-3.3-70b-versatile",
          "mixtral-8x7b-32768"
        ];

        let lastError: any = null;
        for (const model of models) {
          try {
            const completion = await groqClient.chat.completions.create({
              messages: messages as any,
              model: model,
              temperature: 0.7,
              max_tokens: 2000,
            });

            const response = completion.choices[0]?.message?.content || "抱歉，无法生成回复。";
            return NextResponse.json({ response });
          } catch (groqError: any) {
            lastError = groqError;
            
            // 401和403错误通常是API Key问题，不需要尝试其他模型
            if (groqError.status === 401 || groqError.statusCode === 401) {
              return NextResponse.json(
                { error: "Groq API Key无效或已过期，请检查GROQ_API_KEY配置。访问 https://console.groq.com/ 查看API Key状态\n\n提示：如果您在中国，建议使用 DeepSeek API（配置 DEEPSEEK_API_KEY）" },
                { status: 401 }
              );
            }
            
            if (groqError.status === 403 || groqError.statusCode === 403) {
              const proxyInfo = proxyUrl ? "\n\n提示：已检测到代理配置，如果仍然失败，请检查代理是否正常工作。" : "\n\n解决方案：\n- 如果您在中国，请使用 DeepSeek API（配置 DEEPSEEK_API_KEY）\n- 或配置代理访问 Groq API（在 .env.local 中添加 GROQ_PROXY_URL）\n- 访问 https://console.groq.com/ 检查账户状态";
              return NextResponse.json(
                { error: `Groq API 访问被拒绝（403）。可能的原因：\n1) 您在中国，Groq API 可能无法直接访问\n2) API Key无效或已过期\n3) 账户被限制${proxyInfo}` },
                { status: 403 }
              );
            }
            
            // 429错误也不需要尝试其他模型
            if (groqError.status === 429 || groqError.statusCode === 429) {
              return NextResponse.json(
                { error: "API请求频率过高，请稍后再试" },
                { status: 429 }
              );
            }
            
            // 其他错误（如模型不存在），尝试下一个模型
            if (model !== models[models.length - 1]) {
              console.warn(`模型 ${model} 失败: ${groqError.message}，尝试下一个模型...`);
              continue;
            }
            
            // 已经是最后一个模型，跳出循环
            break;
          }
        }

        // 如果所有模型都失败，处理错误
        console.error("Groq API error:", lastError);
        
        if (lastError?.message) {
          return NextResponse.json(
            { error: `Groq API错误: ${lastError.message}\n\n提示：如果您在中国，建议使用 DeepSeek API（配置 DEEPSEEK_API_KEY）` },
            { status: lastError.status || 500 }
          );
        } else {
          return NextResponse.json(
            { error: "AI服务暂时不可用，请稍后重试" },
            { status: 500 }
          );
        }
      }
    }

    // 如果都没有配置，返回错误（理论上不会到这里，因为前面已经检查过）
    return NextResponse.json(
      { error: "未配置任何可用的API Key" },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("Chat API error:", error);
    
    // 处理JSON解析错误等
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "请求数据格式错误" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "AI服务暂时不可用，请稍后重试" },
      { status: 500 }
    );
  }
}

