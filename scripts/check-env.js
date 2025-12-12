// 检查环境变量配置
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');

console.log('🔍 检查环境变量配置...\n');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local 文件不存在！');
  console.log('\n请创建 .env.local 文件并添加以下配置：');
  console.log(`
MONGODB_URI=mongodb://localhost:27017/pdfconvertor
MONGODB_DB_NAME=pdfconvertor
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NEXT_PUBLIC_APP_URL=http://localhost:3000
  `);
  process.exit(1);
}

console.log('✅ .env.local 文件存在\n');

// 读取文件内容
const content = fs.readFileSync(envPath, 'utf-8');
const lines = content.split('\n');

const envVars = {};
lines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      envVars[key] = value;
    }
  }
});

// 检查必需的变量
const required = ['MONGODB_URI', 'JWT_SECRET'];
let allPresent = true;

required.forEach(key => {
  if (envVars[key]) {
    let displayValue = envVars[key];
    if (key === 'MONGODB_URI' && displayValue.length > 50) {
      displayValue = displayValue.substring(0, 30) + '...' + displayValue.substring(displayValue.length - 20);
    } else if (key === 'JWT_SECRET' && displayValue.length > 20) {
      displayValue = displayValue.substring(0, 10) + '...' + displayValue.substring(displayValue.length - 5);
    }
    console.log(`✅ ${key}=${displayValue}`);
  } else {
    console.log(`❌ ${key} 未设置`);
    allPresent = false;
  }
});

if (envVars.MONGODB_DB_NAME) {
  console.log(`✅ MONGODB_DB_NAME=${envVars.MONGODB_DB_NAME}`);
} else {
  console.log(`⚠️  MONGODB_DB_NAME 未设置（将使用默认值: pdfconvertor）`);
}

if (envVars.NEXT_PUBLIC_APP_URL) {
  console.log(`✅ NEXT_PUBLIC_APP_URL=${envVars.NEXT_PUBLIC_APP_URL}`);
} else {
  console.log(`⚠️  NEXT_PUBLIC_APP_URL 未设置（将使用默认值: http://localhost:3000）`);
}

if (!allPresent) {
  console.log('\n❌ 缺少必需的环境变量！');
  console.log('\n请在 .env.local 文件中添加缺失的配置。');
  process.exit(1);
}

console.log('\n✅ 所有必需的环境变量都已配置！');

