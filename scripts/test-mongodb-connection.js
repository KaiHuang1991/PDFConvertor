/**
 * MongoDB 连接测试脚本
 * 用于诊断 MongoDB 连接问题
 * 
 * 使用方法：
 * node scripts/test-mongodb-connection.js
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
} else {
  console.warn('⚠️  未找到 .env.local 文件，将仅使用系统环境变量');
}

const { MongoClient } = require('mongodb');

async function testConnection() {
  console.log('🔍 MongoDB 连接诊断工具\n');
  console.log('='.repeat(50));

  // 步骤 1: 检查环境变量
  console.log('\n📋 步骤 1: 检查环境变量');
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ MONGODB_URI 未配置');
    console.log('\n💡 解决方案：');
    console.log('   在 .env.local 文件中添加：');
    console.log('   MONGODB_URI=mongodb://localhost:27017/pdfconvertor');
    console.log('   或');
    console.log('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pdfconvertor');
    return;
  }

  // 隐藏密码显示连接字符串
  const safeUri = uri.replace(/:([^:@]+)@/, ':****@');
  console.log(`✅ MONGODB_URI 已配置`);
  console.log(`   连接字符串: ${safeUri}`);
  
  // 检查连接字符串类型
  if (uri.startsWith('mongodb+srv://')) {
    console.log(`   类型: SRV 连接字符串 (DNS 查询)`);
  } else if (uri.startsWith('mongodb://')) {
    console.log(`   类型: 标准连接字符串`);
  }

  // 步骤 2: 解析连接字符串信息
  console.log('\n📋 步骤 2: 解析连接信息');
  try {
    const url = new URL(uri);
    console.log(`   主机: ${url.hostname}`);
    console.log(`   端口: ${url.port || (uri.startsWith('mongodb+srv://') ? '27017 (SRV)' : '27017')}`);
    console.log(`   数据库: ${url.pathname.substring(1) || '默认'}`);
  } catch (error) {
    console.error(`   ⚠️  无法解析连接字符串: ${error.message}`);
  }

  // 步骤 3: 测试 DNS 解析（仅 SRV）
  if (uri.startsWith('mongodb+srv://')) {
    console.log('\n📋 步骤 3: 测试 DNS SRV 解析');
    try {
      const url = new URL(uri);
      const hostname = url.hostname;
      const srvRecord = `_mongodb._tcp.${hostname}`;
      console.log(`   尝试解析: ${srvRecord}`);
      console.log(`   ⚠️  注意: Node.js 无法直接测试 SRV 记录，将尝试连接`);
    } catch (error) {
      console.error(`   ❌ DNS 解析失败: ${error.message}`);
    }
  }

  // 步骤 4: 测试连接
  console.log('\n📋 步骤 4: 测试 MongoDB 连接');
  console.log('   正在连接...');

  const client = new MongoClient(uri, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
    retryWrites: true,
  });

  try {
    const startTime = Date.now();
    await client.connect();
    const connectTime = Date.now() - startTime;
    
    console.log(`   ✅ 连接成功！(耗时: ${connectTime}ms)`);

    // 步骤 5: 测试数据库操作
    console.log('\n📋 步骤 5: 测试数据库操作');
    
    // Ping 数据库
    try {
      const pingResult = await client.db().admin().ping();
      console.log(`   ✅ 数据库 Ping 成功:`, pingResult);
    } catch (error) {
      console.error(`   ❌ 数据库 Ping 失败: ${error.message}`);
    }

    // 列出数据库
    try {
      const adminDb = client.db().admin();
      const dbList = await adminDb.listDatabases();
      console.log(`   ✅ 可用数据库数量: ${dbList.databases.length}`);
      if (dbList.databases.length > 0) {
        console.log(`   数据库列表:`);
        dbList.databases.forEach(db => {
          console.log(`     - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
        });
      }
    } catch (error) {
      console.error(`   ⚠️  无法列出数据库: ${error.message}`);
    }

    // 测试目标数据库
    const dbName = process.env.MONGODB_DB_NAME || 'pdfconvertor';
    console.log(`\n📋 步骤 6: 测试目标数据库 "${dbName}"`);
    const db = client.db(dbName);
    
    try {
      const collections = await db.listCollections().toArray();
      console.log(`   ✅ 数据库 "${dbName}" 可访问`);
      console.log(`   集合数量: ${collections.length}`);
      if (collections.length > 0) {
        console.log(`   集合列表:`);
        collections.forEach(col => {
          console.log(`     - ${col.name}`);
        });
      }
    } catch (error) {
      console.error(`   ❌ 无法访问数据库 "${dbName}": ${error.message}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ 所有测试通过！MongoDB 连接正常。\n');

  } catch (error) {
    console.error(`   ❌ 连接失败！\n`);
    console.error('   错误信息:');
    console.error(`   名称: ${error.name}`);
    console.error(`   消息: ${error.message}`);
    if (error.code) {
      console.error(`   代码: ${error.code}`);
    }

    console.log('\n💡 诊断信息:');
    
    if (error.message?.includes('ENOTFOUND') || error.message?.includes('querySrv')) {
      console.log('   ❌ DNS SRV 查询失败');
      console.log('\n   可能的原因:');
      console.log('   1. 网络无法解析 MongoDB Atlas 域名');
      console.log('   2. DNS 服务器配置问题');
      console.log('   3. 防火墙或代理阻止了 DNS 查询');
      console.log('   4. MongoDB Atlas 集群配置问题');
      console.log('\n   解决方案:');
      console.log('   1. 检查网络连接');
      console.log('   2. 验证 MONGODB_URI 中的集群域名是否正确');
      console.log('   3. 尝试使用标准连接字符串（非 SRV）');
      console.log('   4. 检查防火墙和 DNS 设置');
      console.log('   5. 如果使用代理，确保代理配置正确');
      console.log('\n   标准连接字符串格式:');
      console.log('   mongodb://username:password@cluster0-shard-00-00.xxxxx.mongodb.net:27017,');
      console.log('   cluster0-shard-00-01.xxxxx.mongodb.net:27017,');
      console.log('   cluster0-shard-00-02.xxxxx.mongodb.net:27017/');
      console.log('   pdfconvertor?ssl=true&replicaSet=atlas-xxxxx-shard-0&');
      console.log('   authSource=admin&retryWrites=true&w=majority');
    } else if (error.message?.includes('ETIMEDOUT') || error.message?.includes('timeout')) {
      console.log('   ❌ 连接超时');
      console.log('\n   可能的原因:');
      console.log('   1. 网络连接不稳定');
      console.log('   2. MongoDB Atlas IP 白名单未配置');
      console.log('   3. 防火墙阻止了连接');
      console.log('\n   解决方案:');
      console.log('   1. 检查网络连接');
      console.log('   2. 在 MongoDB Atlas 中配置 IP 白名单');
      console.log('   3. 检查防火墙设置');
    } else if (error.message?.includes('ECONNREFUSED')) {
      console.log('   ❌ 连接被拒绝');
      console.log('\n   可能的原因:');
      console.log('   1. MongoDB 服务未运行（本地 MongoDB）');
      console.log('   2. IP 白名单未包含您的 IP');
      console.log('   3. 端口被阻止');
      console.log('\n   解决方案:');
      console.log('   1. 确保 MongoDB 服务正在运行');
      console.log('   2. 在 MongoDB Atlas 中添加您的 IP 到白名单');
      console.log('   3. 检查端口 27017 是否开放');
    } else if (error.message?.includes('authentication failed') || error.message?.includes('auth')) {
      console.log('   ❌ 认证失败');
      console.log('\n   可能的原因:');
      console.log('   1. 用户名或密码错误');
      console.log('   2. 数据库用户未创建或权限不足');
      console.log('\n   解决方案:');
      console.log('   1. 检查 MONGODB_URI 中的用户名和密码');
      console.log('   2. 在 MongoDB Atlas 中创建数据库用户');
      console.log('   3. 确保用户有正确的权限');
    } else {
      console.log('   ⚠️  未知错误，请查看错误信息');
    }

    console.log('\n📚 更多帮助:');
    console.log('   查看 MONGODB_CONNECTION_TROUBLESHOOTING.md 获取详细排查指南');
    
    console.log('\n' + '='.repeat(50));
    process.exit(1);
  } finally {
    await client.close();
  }
}

// 运行测试
testConnection().catch(error => {
  console.error('❌ 测试脚本执行失败:', error);
  process.exit(1);
});

