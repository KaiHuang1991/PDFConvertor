import { MongoClient, Db } from 'mongodb';

if (!process.env.MONGODB_URI) {
  console.error('❌ [数据库] MONGODB_URI 环境变量未设置');
  throw new Error('请在 .env.local 中添加 MONGODB_URI 环境变量');
}

const uri = process.env.MONGODB_URI;
const options = {};

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
    throw new Error(`数据库连接失败: ${error.message}`);
  }
}

export default clientPromise;

