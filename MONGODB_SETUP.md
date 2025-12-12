# MongoDB 配置指南

## 问题诊断

当前错误：`数据库连接失败`

这通常是因为：
1. `.env.local` 文件中缺少 `MONGODB_URI` 配置
2. MongoDB 服务未运行
3. 连接字符串不正确

## 快速解决方案

### 方案 1：使用 MongoDB Atlas（推荐，免费）

1. **注册 MongoDB Atlas 账户**
   - 访问 https://www.mongodb.com/cloud/atlas
   - 注册免费账户（M0 免费层）

2. **创建集群**
   - 登录后创建免费集群
   - 选择云提供商和区域（建议选择离您最近的）

3. **配置网络访问**
   - 在 "Network Access" 中添加 IP 地址
   - 开发时可以选择 "Allow Access from Anywhere" (0.0.0.0/0)

4. **创建数据库用户**
   - 在 "Database Access" 中创建用户
   - 记住用户名和密码

5. **获取连接字符串**
   - 点击 "Connect" → "Connect your application"
   - 复制连接字符串，格式如下：
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

6. **配置到 .env.local**
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/pdfconvertor?retryWrites=true&w=majority
   MONGODB_DB_NAME=pdfconvertor
   ```
   注意：将 `<username>` 和 `<password>` 替换为实际值，将 `cluster0.xxxxx` 替换为您的集群地址

### 方案 2：本地 MongoDB

1. **安装 MongoDB**
   - Windows: 下载并安装 [MongoDB Community Server](https://www.mongodb.com/try/download/community)
   - Mac: `brew install mongodb-community`
   - Linux: 参考 [MongoDB 官方文档](https://docs.mongodb.com/manual/installation/)

2. **启动 MongoDB 服务**
   ```bash
   # Windows
   net start MongoDB
   
   # Mac/Linux
   mongod
   ```

3. **配置到 .env.local**
   ```env
   MONGODB_URI=mongodb://localhost:27017/pdfconvertor
   MONGODB_DB_NAME=pdfconvertor
   ```

## 完整 .env.local 配置示例

```env
# MongoDB 数据库连接
MONGODB_URI=mongodb://localhost:27017/pdfconvertor
# 或使用 MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pdfconvertor?retryWrites=true&w=majority
MONGODB_DB_NAME=pdfconvertor

# JWT 密钥（请使用强随机字符串）
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# 应用 URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 邮件配置（可选，开发模式会自动使用测试邮箱）
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your-email@example.com
# SMTP_PASS=your-password
# SMTP_FROM=noreply@example.com

# 或使用 Gmail
# GMAIL_USER=your-email@gmail.com
# GMAIL_PASS=your-app-specific-password
```

## 验证配置

配置完成后：

1. **重启开发服务器**
   ```bash
   # 停止当前服务器 (Ctrl+C)
   npm run dev
   ```

2. **检查服务器控制台**
   - 应该看到：`✅ [数据库] MongoDB 连接成功`
   - 如果看到错误，请检查连接字符串是否正确

3. **测试注册功能**
   - 访问 `/auth/register`
   - 尝试注册一个新账户

## 常见问题

### Q: 连接超时
**A:** 检查网络连接，确保 MongoDB Atlas 的网络访问已配置

### Q: 认证失败
**A:** 检查用户名和密码是否正确，确保数据库用户已创建

### Q: 本地 MongoDB 连接失败
**A:** 确保 MongoDB 服务正在运行：
```bash
# Windows
net start MongoDB

# Mac/Linux
sudo systemctl start mongod
# 或
mongod
```

## 需要帮助？

如果仍然遇到问题，请检查：
1. 服务器控制台的详细错误信息
2. `.env.local` 文件是否存在且配置正确
3. MongoDB 服务是否正在运行（本地）或网络访问已配置（Atlas）

