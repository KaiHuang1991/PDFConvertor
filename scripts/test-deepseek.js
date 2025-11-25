/**
 * DeepSeek API 连接测试脚本
 * 使用方法: node scripts/test-deepseek.js
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
        // 使用更全面的正则表达式匹配所有类型的引号
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

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

async function testDeepSeek() {
  console.log('🔍 开始测试 DeepSeek API 连接...\n');

  // 检查环境变量
  let apiKey = process.env.DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    console.error('❌ 错误: 未找到 DEEPSEEK_API_KEY 环境变量');
    console.log('\n请按以下步骤配置:');
    console.log('1. 在项目根目录创建 .env.local 文件');
    console.log('2. 添加: DEEPSEEK_API_KEY=你的api_key');
    console.log('3. 访问 https://platform.deepseek.com/ 获取 API Key\n');
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
  
  console.log('✅ 找到 DEEPSEEK_API_KEY');
  console.log(`   原始长度: ${originalKey.length} 字符`);
  console.log(`   清理后长度: ${apiKey.length} 字符`);
  console.log(`   API Key 前缀: ${apiKey.substring(0, Math.min(10, apiKey.length))}...${apiKey.substring(Math.max(0, apiKey.length - 4))}`);
  
  if (originalKey.length !== apiKey.length) {
    console.log('   ⚠️  已清理特殊字符\n');
  } else {
    console.log('');
  }
  
  // 验证 API Key 格式
  if (!apiKey.startsWith('sk-')) {
    console.warn('   ⚠️  警告: API Key 通常以 "sk-" 开头\n');
  }

  // 测试 API 连接
  try {
    console.log('📡 正在连接 DeepSeek API...');
    
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: "请回复'连接成功'，证明API正常工作。"
          }
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    console.log(`   状态码: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        console.error('❌ API Key 无效或已过期');
        console.error(`   错误信息: ${errorData.error?.message || 'Unauthorized'}\n`);
        console.error('💡 提示: 请访问 https://platform.deepseek.com/ 检查 API Key 状态\n');
        process.exit(1);
      } else if (response.status === 402) {
        console.warn('⚠️  账户余额不足');
        console.warn(`   错误信息: ${errorData.error?.message || 'Payment Required'}\n`);
        console.log('✅ 但是 API 连接是成功的！API Key 有效。\n');
        console.log('💡 提示: 请访问 https://platform.deepseek.com/ 充值账户余额\n');
        console.log('🎉 测试结果: DeepSeek API 连接正常，但需要充值后才能使用\n');
        process.exit(0); // 连接成功，只是余额不足
      } else if (response.status === 403) {
        console.error('❌ API Key 没有权限');
        console.error(`   错误信息: ${errorData.error?.message || 'Forbidden'}\n`);
        console.error('💡 提示: 请检查账户状态和 API Key 权限\n');
        process.exit(1);
      } else if (response.status === 429) {
        console.error('❌ 请求频率过高');
        console.error(`   错误信息: ${errorData.error?.message || 'Too Many Requests'}\n`);
        console.error('💡 提示: 请稍后再试\n');
        process.exit(1);
      } else {
        console.error('❌ API 请求失败');
        console.error(`   错误信息: ${JSON.stringify(errorData, null, 2)}\n`);
        process.exit(1);
      }
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "无响应";

    console.log('✅ DeepSeek API 连接成功！\n');
    console.log('📝 AI 回复:');
    console.log(`   ${aiResponse}\n`);
    console.log('🎉 测试通过！您可以在应用中使用 DeepSeek API 了。\n');

  } catch (error) {
    console.error('❌ 连接失败');
    console.error(`   错误: ${error.message}\n`);
    
    if (error.message.includes('fetch')) {
      console.error('💡 提示: 网络连接问题');
      console.error('   请检查网络连接或防火墙设置\n');
    } else {
      console.error('💡 提示: 请检查错误信息并重试\n');
    }
    
    process.exit(1);
  }
}

// 运行测试
testDeepSeek();

