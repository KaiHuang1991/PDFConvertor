/**
 * Groq API 连接测试脚本
 * 使用方法: node scripts/test-groq.js
 */

// 简单的环境变量加载（不依赖 dotenv 包）
const fs = require('fs');
const path = require('path');

// 尝试加载 .env.local 文件
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        let value = trimmedLine.substring(equalIndex + 1).trim();
        // 移除各种引号（包括中文引号 " " ' ' 等）
        value = value.replace(/^["'""''「」『』《》]|["'""''「」『』《》]$/g, '');
        // 移除所有不可见字符和特殊字符
        value = value.replace(/[\u200B-\u200D\uFEFF]/g, '');
        if (key && value) {
          process.env[key] = value;
        }
      }
    }
  });
}

const Groq = require('groq-sdk');

async function testGroq() {
  console.log('🔍 开始测试 Groq API 连接...\n');

  // 检查环境变量
  let apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    console.error('❌ 错误: 未找到 GROQ_API_KEY 环境变量');
    console.log('\n请按以下步骤配置:');
    console.log('1. 在项目根目录创建 .env.local 文件');
    console.log('2. 添加: GROQ_API_KEY=你的api_key');
    console.log('3. 访问 https://console.groq.com/ 获取 API Key');
    console.log('\n⚠️  注意: 如果您在中国，Groq API 可能无法直接访问（需要代理）\n');
    process.exit(1);
  }

  // 清理 API Key 中的所有特殊字符（包括中文引号、不可见字符等）
  const originalKey = apiKey;
  // 只保留 ASCII 字符（0-127）和常见的 API Key 字符
  apiKey = apiKey.split('').filter(char => {
    const code = char.charCodeAt(0);
    // 允许 ASCII 字符（0-127）或常见的可打印字符
    return code < 128 || (code >= 32 && code <= 126);
  }).join('').trim();
  
  // 移除开头和结尾的引号（包括中文引号）
  apiKey = apiKey.replace(/^["'""''「」『』《》]+|["'""''「」『』《》]+$/g, '');

  console.log('✅ 找到 GROQ_API_KEY');
  console.log(`   原始长度: ${originalKey.length} 字符`);
  console.log(`   清理后长度: ${apiKey.length} 字符`);
  console.log(`   API Key 前缀: ${apiKey.substring(0, Math.min(10, apiKey.length))}...${apiKey.substring(Math.max(0, apiKey.length - 4))}`);
  
  if (originalKey.length !== apiKey.length) {
    console.log('   ⚠️  已清理特殊字符');
  }
  
  // 验证 API Key 格式
  if (!apiKey.startsWith('gsk_')) {
    console.warn('   ⚠️  警告: Groq API Key 通常以 "gsk_" 开头');
  }
  // 检查代理配置
  const proxyUrl = process.env.GROQ_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) {
    console.log('✅ 检测到代理配置');
    console.log(`   代理地址: ${proxyUrl.replace(/:[^:@]*@/, ':****@')}\n`);
    // 设置环境变量以确保使用代理
    if (!process.env.HTTPS_PROXY && !process.env.HTTP_PROXY) {
      process.env.HTTPS_PROXY = proxyUrl;
      process.env.HTTP_PROXY = proxyUrl;
    }
  } else {
    console.log('⚠️  未检测到代理配置');
    console.log('   如果您在中国，可能需要配置代理才能访问 Groq API\n');
  }

  // 初始化 Groq 客户端
  const groq = new Groq({
    apiKey: apiKey,
  });

  // 测试多个模型
  const models = [
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "mixtral-8x7b-32768"
  ];

  let lastError = null;
  let successModel = null;

  for (const model of models) {
    try {
      console.log(`📡 正在测试模型: ${model}...`);
      
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: "请回复'连接成功'，证明API正常工作。"
          }
        ],
        model: model,
        temperature: 0.7,
        max_tokens: 100,
      });

      const response = completion.choices[0]?.message?.content || "无响应";
      
      console.log(`✅ 模型 ${model} 连接成功！\n`);
      console.log('📝 AI 回复:');
      console.log(`   ${response}\n`);
      console.log('🎉 测试通过！您可以在应用中使用 Groq API 了。\n');
      successModel = model;
      break;

    } catch (error) {
      lastError = error;
      console.log(`   状态码: ${error.status || error.statusCode || 'N/A'}`);
      
      // 401和403错误通常是API Key问题，不需要尝试其他模型
      if (error.status === 401 || error.statusCode === 401) {
        console.error('\n❌ API Key 无效或已过期');
        console.error(`   错误信息: ${error.message}\n`);
        console.error('💡 提示: 请访问 https://console.groq.com/ 检查 API Key 状态\n');
        process.exit(1);
      }
      
      if (error.status === 403 || error.statusCode === 403) {
        console.error('\n❌ API 访问被拒绝（403）');
        console.error(`   错误信息: ${error.message}\n`);
        console.error('💡 可能的原因:');
        console.error('   1. 您在中国，Groq API 可能无法直接访问（需要代理）');
        console.error('   2. API Key 无效或已过期');
        console.error('   3. 账户被限制或暂停');
        console.error('\n💡 解决方案:');
        console.error('   - 如果您在中国，建议使用 DeepSeek API（配置 DEEPSEEK_API_KEY）');
        console.error('   - 或使用代理/VPN 访问 Groq API');
        console.error('   - 访问 https://console.groq.com/ 检查账户状态\n');
        process.exit(1);
      }
      
      // 429错误也不需要尝试其他模型
      if (error.status === 429 || error.statusCode === 429) {
        console.error('\n❌ 请求频率过高');
        console.error(`   错误信息: ${error.message}\n`);
        console.error('💡 提示: 请稍后再试\n');
        process.exit(1);
      }
      
      // 其他错误（如模型不存在），尝试下一个模型
      if (model !== models[models.length - 1]) {
        console.warn(`   ⚠️  模型 ${model} 失败: ${error.message}`);
        console.log('   尝试下一个模型...\n');
        continue;
      }
      
      // 已经是最后一个模型，跳出循环
      console.error(`\n❌ 模型 ${model} 失败: ${error.message}\n`);
      break;
    }
  }

  // 如果所有模型都失败
  if (!successModel && lastError) {
    console.error('❌ 所有模型测试失败');
    console.error(`   最后错误: ${lastError.message}\n`);
    
    if (lastError.message.includes('fetch') || lastError.message.includes('network')) {
      console.error('💡 提示: 网络连接问题');
      console.error('   如果您在中国，Groq API 可能无法直接访问');
      console.error('   建议使用 DeepSeek API（配置 DEEPSEEK_API_KEY）或使用代理\n');
    } else {
      console.error('💡 提示: 请检查错误信息并重试\n');
    }
    
    process.exit(1);
  }
}

// 运行测试
testGroq().catch(error => {
  console.error('❌ 测试过程中发生错误:');
  console.error(error);
  process.exit(1);
});

