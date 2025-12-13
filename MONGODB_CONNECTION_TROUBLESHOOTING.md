# MongoDB 连接问题排查指南

## 错误：`querySrv ENOTFOUND _mongodb._tcp.cluster0.yqfvmo.mongodb.net`

这个错误表示 DNS SRV 查询失败，通常发生在使用 MongoDB Atlas 的 `mongodb+srv://` 连接字符串时。

## 可能的原因

1. **DNS 解析失败**
   - 网络无法解析 MongoDB Atlas 的 SRV 记录
   - DNS 服务器配置问题

2. **网络连接问题**
   - 网络连接不稳定
   - 防火墙阻止了 DNS 查询
   - 代理服务器配置问题

3. **MongoDB Atlas 配置问题**
   - 集群域名不正确
   - 集群已被删除或暂停
   - IP 白名单未配置（虽然这通常会导致连接超时，而不是 DNS 错误）

## 解决方案

### 方案 1：检查并验证连接字符串

1. **登录 MongoDB Atlas**
   - 访问 [MongoDB Atlas](https://cloud.mongodb.com/)
   - 进入您的集群

2. **获取正确的连接字符串**
   - 点击 "Connect" 按钮
   - 选择 "Connect your application"
   - 复制连接字符串

3. **验证连接字符串格式**
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority
   ```
   - 确保用户名和密码正确
   - 确保集群域名正确（`cluster0.xxxxx.mongodb.net`）
   - 确保数据库名称正确

### 方案 2：使用标准连接字符串（推荐）

如果 SRV 连接字符串无法工作，可以使用标准连接字符串：

1. **在 MongoDB Atlas 中获取标准连接字符串**
   - 点击 "Connect" → "Connect your application"
   - 选择 "Driver" 为 "Node.js"
   - 选择 "Version" 为 "4.1 or later"
   - 在连接字符串下方，点击 "Load sample code" 或查看 "Standard connection string"

2. **标准连接字符串格式**
   ```
   mongodb://<username>:<password>@cluster0-shard-00-00.xxxxx.mongodb.net:27017,cluster0-shard-00-01.xxxxx.mongodb.net:27017,cluster0-shard-00-02.xxxxx.mongodb.net:27017/<dbname>?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority
   ```

3. **更新 .env.local**
   ```env
   MONGODB_URI=mongodb://username:password@cluster0-shard-00-00.xxxxx.mongodb.net:27017,cluster0-shard-00-01.xxxxx.mongodb.net:27017,cluster0-shard-00-02.xxxxx.mongodb.net:27017/pdfconvertor?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority
   ```

### 方案 3：检查网络和 DNS

1. **测试 DNS 解析**
   ```bash
   # Windows
   nslookup _mongodb._tcp.cluster0.yqfvmo.mongodb.net
   
   # Mac/Linux
   dig _mongodb._tcp.cluster0.yqfvmo.mongodb.net SRV
   ```

2. **测试网络连接**
   ```bash
   # 测试 MongoDB Atlas 服务器连接
   ping cluster0-shard-00-00.yqfvmo.mongodb.net
   ```

3. **检查防火墙和代理**
   - 确保防火墙允许 MongoDB 连接（端口 27017）
   - 如果使用代理，确保代理配置正确
   - 检查公司网络是否阻止了 MongoDB Atlas 连接

### 方案 4：配置 IP 白名单

1. **在 MongoDB Atlas 中配置 IP 白名单**
   - 进入 "Network Access"
   - 点击 "Add IP Address"
   - 添加您的 IP 地址，或使用 `0.0.0.0/0`（允许所有 IP，仅用于开发）

2. **等待配置生效**
   - IP 白名单更改可能需要几分钟生效

### 方案 5：使用本地 MongoDB（开发环境）

如果 MongoDB Atlas 连接持续失败，可以在开发环境使用本地 MongoDB：

1. **安装本地 MongoDB**
   - Windows: 下载并安装 [MongoDB Community Server](https://www.mongodb.com/try/download/community)
   - Mac: `brew install mongodb-community`
   - Linux: 参考 [MongoDB 官方文档](https://docs.mongodb.com/manual/installation/)

2. **启动 MongoDB**
   ```bash
   # Windows
   net start MongoDB
   
   # Mac/Linux
   mongod
   ```

3. **更新 .env.local**
   ```env
   MONGODB_URI=mongodb://localhost:27017/pdfconvertor
   ```

## 诊断步骤

### 步骤 1：检查环境变量

确保 `.env.local` 文件中正确配置了 `MONGODB_URI`：

```bash
# 检查环境变量是否加载
node -e "require('dotenv').config({ path: '.env.local' }); console.log(process.env.MONGODB_URI ? '已配置' : '未配置');"
```

### 步骤 2：测试连接

创建一个测试脚本：

```javascript
// test-connection.js
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI 未配置');
    return;
  }

  console.log('📦 测试连接字符串:', uri.replace(/:[^:@]+@/, ':****@')); // 隐藏密码

  const client = new MongoClient(uri, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await client.connect();
    console.log('✅ 连接成功！');
    await client.db().admin().ping();
    console.log('✅ 数据库响应正常');
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
    console.error('   错误类型:', error.name);
    console.error('   错误代码:', error.code);
  } finally {
    await client.close();
  }
}

testConnection();
```

运行测试：
```bash
node test-connection.js
```

### 步骤 3：查看详细错误日志

检查应用控制台输出，查看详细的错误信息和建议。

## 常见错误代码

- `ENOTFOUND`: DNS 解析失败
- `ETIMEDOUT`: 连接超时
- `ECONNREFUSED`: 连接被拒绝（可能是 IP 白名单问题）
- `ENETUNREACH`: 网络不可达

## 预防措施

1. **使用环境变量管理敏感信息**
   - 不要在代码中硬编码连接字符串
   - 使用 `.env.local` 文件（已添加到 `.gitignore`）

2. **定期检查连接**
   - 定期测试数据库连接
   - 监控连接错误日志

3. **使用连接池**
   - 代码已实现连接池（开发模式使用全局变量缓存）

4. **配置重试机制**
   - 代码已配置 `retryWrites: true`

## 获取帮助

如果以上方案都无法解决问题：

1. **检查 MongoDB Atlas 状态**
   - 访问 [MongoDB Atlas Status](https://status.mongodb.com/)
   - 检查是否有服务中断

2. **查看 MongoDB Atlas 日志**
   - 在 MongoDB Atlas 控制台查看集群日志

3. **联系支持**
   - MongoDB Atlas 支持（如果使用付费计划）
   - 社区论坛：https://developer.mongodb.com/community/forums/

## 相关文档

- [MongoDB Atlas 连接指南](https://docs.atlas.mongodb.com/getting-started/)
- [MongoDB Node.js 驱动文档](https://docs.mongodb.com/drivers/node/)
- [AUTH_SETUP.md](./AUTH_SETUP.md) - 用户认证系统配置
- [USER_ENV_VARS.md](./USER_ENV_VARS.md) - 环境变量配置



