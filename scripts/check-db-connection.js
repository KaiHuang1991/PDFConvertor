// 检查 MongoDB 连接
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// 读取 .env.local 文件
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    });
  }
}

loadEnvFile();

async function checkConnection() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'pdfconvertor';

  if (!uri) {
    console.error('❌ MONGODB_URI 环境变量未设置');
    console.log('请在 .env.local 文件中添加:');
    console.log('MONGODB_URI=mongodb://localhost:27017/pdfconvertor');
    process.exit(1);
  }

  console.log('📦 正在连接 MongoDB...');
  console.log('   连接字符串:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // 隐藏密码
  console.log('   数据库名:', dbName);

  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log('✅ MongoDB 连接成功！');

    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    console.log('📋 数据库中的集合:', collections.map(c => c.name).join(', ') || '(无)');

    await client.close();
    console.log('✅ 连接测试完成');
  } catch (error) {
    console.error('❌ MongoDB 连接失败:');
    console.error('   错误:', error.message);
    console.error('\n可能的原因:');
    console.error('   1. MongoDB 服务未运行');
    console.error('   2. 连接字符串不正确');
    console.error('   3. 网络连接问题');
    console.error('\n解决方案:');
    console.error('   - 确保 MongoDB 服务已启动');
    console.error('   - 检查 .env.local 中的 MONGODB_URI 是否正确');
    process.exit(1);
  }
}

checkConnection();

