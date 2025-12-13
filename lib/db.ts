import { MongoClient, Db, MongoClientOptions } from 'mongodb';

if (!process.env.MONGODB_URI) {
  console.error('❌ [数据库] MONGODB_URI 环境变量未设置');
  throw new Error('请在 .env.local 中添加 MONGODB_URI 环境变量');
}

const uri = process.env.MONGODB_URI;

// MongoDB 连接选项
const options: MongoClientOptions = {
  // 连接超时时间（30秒）
  connectTimeoutMS: 30000,
  // 服务器选择超时时间（30秒）
  serverSelectionTimeoutMS: 30000,
  // 重试连接
  retryWrites: true,
  // 如果使用 SRV 连接字符串，添加这些选项以处理 DNS 问题
  ...(uri.startsWith('mongodb+srv://') && {
    // 使用 directConnection 可能会帮助某些网络环境
    // 但 SRV 连接不支持 directConnection，所以我们需要其他方法
    // 如果 DNS 解析失败，建议使用标准连接字符串
  }),
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // 开发模式下，使用全局变量避免重复连接
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    console.log('📦 [数据库] 正在连接 MongoDB...');
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect().then((client) => {
      console.log('✅ [数据库] MongoDB 连接成功');
      return client;
    }).catch((error) => {
      console.error('❌ [数据库] MongoDB 连接失败:', error.message);
      console.error('   错误类型:', error.name);
      console.error('   错误代码:', error.code);
      
      // 提供更详细的错误信息
      if (error.message?.includes('ENOTFOUND') || error.message?.includes('querySrv')) {
        console.error('\n💡 [诊断] DNS 解析失败，可能的原因：');
        console.error('   1. 网络连接问题（检查网络连接）');
        console.error('   2. DNS 服务器无法解析 MongoDB Atlas 域名');
        console.error('   3. 防火墙或代理阻止了 DNS 查询');
        console.error('   4. MongoDB Atlas 集群配置问题');
        console.error('\n💡 [解决方案]：');
        console.error('   1. 检查 MONGODB_URI 是否正确');
        console.error('   2. 尝试使用标准连接字符串（非 SRV）');
        console.error('   3. 检查网络连接和 DNS 设置');
        console.error('   4. 如果使用代理，确保代理配置正确');
      }
      
      throw error;
    });
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // 生产模式
  console.log('📦 [数据库] 正在连接 MongoDB...');
  client = new MongoClient(uri, options);
  clientPromise = client.connect().then((client) => {
    console.log('✅ [数据库] MongoDB 连接成功');
    return client;
  }).catch((error) => {
    console.error('❌ [数据库] MongoDB 连接失败:', error.message);
    console.error('   错误类型:', error.name);
    console.error('   错误代码:', error.code);
    
    // 提供更详细的错误信息
    if (error.message?.includes('ENOTFOUND') || error.message?.includes('querySrv')) {
      console.error('\n💡 [诊断] DNS 解析失败，可能的原因：');
      console.error('   1. 网络连接问题（检查网络连接）');
      console.error('   2. DNS 服务器无法解析 MongoDB Atlas 域名');
      console.error('   3. 防火墙或代理阻止了 DNS 查询');
      console.error('   4. MongoDB Atlas 集群配置问题');
      console.error('\n💡 [解决方案]：');
      console.error('   1. 检查 MONGODB_URI 是否正确');
      console.error('   2. 尝试使用标准连接字符串（非 SRV）');
      console.error('   3. 检查网络连接和 DNS 设置');
      console.error('   4. 如果使用代理，确保代理配置正确');
    }
    
    throw error;
  });
}

export async function getDb(): Promise<Db> {
  try {
    const client = await clientPromise;
    const dbName = process.env.MONGODB_DB_NAME || 'pdfconvertor';
    const db = client.db(dbName);
    console.log(`📦 [数据库] 使用数据库: ${dbName}`);
    return db;
  } catch (error: any) {
    console.error('❌ [数据库] 获取数据库实例失败:', error.message);
    console.error('   错误类型:', error.name);
    console.error('   错误代码:', error.code);
    
    // 提供更详细的错误信息和解决方案
    if (error.message?.includes('ENOTFOUND') || error.message?.includes('querySrv')) {
      const errorMsg = `数据库连接失败: ${error.message}\n\n` +
        `💡 诊断信息：\n` +
        `   - 这是 DNS SRV 查询失败错误\n` +
        `   - 通常发生在使用 mongodb+srv:// 连接字符串时\n\n` +
        `💡 解决方案：\n` +
        `   1. 检查网络连接是否正常\n` +
        `   2. 验证 MONGODB_URI 中的集群域名是否正确\n` +
        `   3. 尝试使用标准连接字符串（非 SRV）\n` +
        `   4. 检查防火墙和 DNS 设置\n` +
        `   5. 如果使用代理，确保代理配置正确\n\n` +
        `📝 标准连接字符串格式（从 MongoDB Atlas 获取）：\n` +
        `   mongodb://username:password@cluster0-shard-00-00.xxxxx.mongodb.net:27017,` +
        `cluster0-shard-00-01.xxxxx.mongodb.net:27017,` +
        `cluster0-shard-00-02.xxxxx.mongodb.net:27017/pdfconvertor?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority`;
      throw new Error(errorMsg);
    }
    
    throw new Error(`数据库连接失败: ${error.message}`);
  }
}

export default clientPromise;

