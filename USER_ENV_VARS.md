# 用户模块环境变量配置

本文档列出了用户模块（认证系统）所需的所有环境变量。

## 必需的环境变量

### 1. 数据库配置

```env
# MongoDB 连接字符串（必需）
MONGODB_URI=mongodb://localhost:27017/pdfconvertor
# 或使用 MongoDB Atlas（云数据库）
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pdfconvertor?retryWrites=true&w=majority

# 数据库名称（可选，默认: pdfconvertor）
MONGODB_DB_NAME=pdfconvertor
```

**说明：**
- `MONGODB_URI` 是必需的，如果未配置会导致应用启动失败
- `MONGODB_DB_NAME` 可选，默认值为 `pdfconvertor`

### 2. JWT 认证配置

```env
# JWT 密钥（必需，生产环境必须更改）
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**说明：**
- 用于签名和验证 JWT Token
- 如果未配置，会使用默认值 `'your-secret-key-change-in-production'`（不安全，仅用于开发）
- **生产环境必须使用强随机字符串**

## 可选的环境变量

### 3. 应用 URL 配置

```env
# 应用基础 URL（用于生成邮件验证链接）
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**说明：**
- 用于生成邮箱验证和密码重置链接
- 默认值：`http://localhost:3000`
- 生产环境应设置为实际域名，如：`https://yourdomain.com`

### 4. 邮件配置（二选一）

#### 方式1：使用 SMTP 服务器

```env
# SMTP 服务器配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false          # true 使用 465 端口，false 使用 587 端口
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM=noreply@example.com  # 发件人邮箱
```

#### 方式2：使用 Gmail

```env
# Gmail 配置（需要应用专用密码）
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-specific-password
```

**说明：**
- 如果配置了 `SMTP_HOST`，优先使用 SMTP 方式
- 否则，如果配置了 `GMAIL_USER` 和 `GMAIL_PASS`，使用 Gmail 方式
- 如果都不配置，开发模式会使用 Ethereal Email（测试邮箱，不会真正发送）

### 5. 环境模式

```env
# 环境模式（development 或 production）
NODE_ENV=development
```

**说明：**
- 影响 Cookie 的 `secure` 属性（生产环境为 `true`，开发环境为 `false`）
- 影响 MongoDB 连接方式（开发模式使用全局变量缓存连接）

## 完整配置示例

### 开发环境配置（.env.local）

```env
# 数据库
MONGODB_URI=mongodb://localhost:27017/pdfconvertor
MONGODB_DB_NAME=pdfconvertor

# JWT
JWT_SECRET=dev-secret-key-change-in-production

# 应用 URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 邮件（使用 Gmail）
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-specific-password

# 环境
NODE_ENV=development
```

### 生产环境配置（.env.production）

```env
# 数据库（使用 MongoDB Atlas）
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pdfconvertor?retryWrites=true&w=majority
MONGODB_DB_NAME=pdfconvertor

# JWT（使用强随机字符串）
JWT_SECRET=your-very-strong-random-secret-key-here

# 应用 URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# 邮件（使用 SMTP）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com

# 环境
NODE_ENV=production
```

## 环境变量优先级

1. **数据库配置**：`MONGODB_URI` > `MONGODB_DB_NAME`（默认值）
2. **JWT 配置**：`JWT_SECRET` > 默认值（不安全）
3. **邮件配置**：`SMTP_HOST` > `GMAIL_USER/GMAIL_PASS` > Ethereal Email（开发模式）

## 验证配置

### 检查必需变量

在应用启动时，如果 `MONGODB_URI` 未配置，会抛出错误：
```
Error: 请在 .env.local 中添加 MONGODB_URI 环境变量
```

### 检查邮件配置

邮件配置是可选的，但如果不配置：
- 开发模式：使用 Ethereal Email（测试邮箱）
- 生产模式：邮件发送功能可能无法正常工作

## 安全建议

1. **JWT_SECRET**：
   - 使用至少 32 个字符的随机字符串
   - 可以使用以下命令生成：
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

2. **MONGODB_URI**：
   - 不要在代码中硬编码
   - 使用环境变量或密钥管理服务
   - 生产环境使用 MongoDB Atlas 时，限制 IP 访问

3. **邮件密码**：
   - Gmail 必须使用应用专用密码，不要使用账户密码
   - SMTP 密码应使用强密码
   - 定期更换密码

4. **生产环境**：
   - 所有敏感信息必须通过环境变量配置
   - 使用 HTTPS
   - 定期审查和更新密钥

## 相关文件

- `lib/db.ts` - 数据库连接配置
- `lib/auth.ts` - JWT 认证配置
- `lib/email.ts` - 邮件服务配置
- `app/api/auth/*` - 认证 API 路由

## 故障排查

### MongoDB 连接失败
- 检查 `MONGODB_URI` 是否正确
- 检查 MongoDB 服务是否运行
- 检查网络连接和防火墙设置

### JWT Token 验证失败
- 检查 `JWT_SECRET` 是否配置
- 确保开发和生产环境使用相同的 `JWT_SECRET`
- 检查 Token 是否过期（默认 7 天）

### 邮件发送失败
- 检查邮件配置是否正确
- Gmail 需要使用应用专用密码
- 检查 SMTP 服务器是否可访问
- 查看控制台错误日志



