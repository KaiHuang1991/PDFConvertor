# 用户认证系统配置指南

## 环境变量配置

在 `.env.local` 文件中添加以下配置：

```env
# MongoDB 数据库连接
MONGODB_URI=mongodb://localhost:27017/pdfconvertor
# 或者使用 MongoDB Atlas（云数据库）
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pdfconvertor?retryWrites=true&w=majority
MONGODB_DB_NAME=pdfconvertor

# JWT 密钥（请使用强随机字符串）
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# 应用 URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 邮件配置（选择以下方式之一）

# 方式1：使用 SMTP 服务器
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM=noreply@example.com

# 方式2：使用 Gmail（需要应用专用密码）
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-specific-password

# 如果都不配置，开发模式会使用 Ethereal Email（测试邮箱）
```

## MongoDB 设置

### 本地 MongoDB

1. **安装 MongoDB**
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

3. **连接字符串**
   ```
   MONGODB_URI=mongodb://localhost:27017/pdfconvertor
   ```

### MongoDB Atlas（云数据库，推荐）

1. 访问 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. 创建免费账户和集群
3. 创建数据库用户
4. 配置网络访问（添加 IP 地址或允许所有 IP）
5. 获取连接字符串，格式如下：
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pdfconvertor?retryWrites=true&w=majority
   ```

## 邮件配置

### Gmail 配置（推荐用于开发）

1. 登录 Gmail 账户
2. 启用两步验证
3. 生成应用专用密码：
   - 访问 [Google 账户安全设置](https://myaccount.google.com/security)
   - 启用两步验证
   - 生成应用专用密码
4. 在 `.env.local` 中配置：
   ```env
   GMAIL_USER=your-email@gmail.com
   GMAIL_PASS=your-app-specific-password
   ```

### SMTP 配置

如果您有自己的 SMTP 服务器：

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM=noreply@example.com
```

### 开发模式（测试邮箱）

如果不配置邮件，开发模式会使用 Ethereal Email。邮件不会真正发送，但可以在控制台查看邮件内容。

## 功能说明

### 已实现的功能

1. **用户注册**
   - 邮箱和密码注册
   - 自动发送验证邮件
   - 密码加密存储

2. **用户登录**
   - JWT Token 认证
   - 支持 Cookie 和 Header 两种方式

3. **邮箱验证**
   - 注册后发送验证邮件
   - 验证链接 24 小时有效
   - 验证后更新用户状态

4. **忘记密码**
   - 发送密码重置邮件
   - 重置链接 1 小时有效
   - 安全的重置流程

5. **用户信息**
   - 获取当前用户信息
   - 用户状态管理

### API 端点

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/verify-email?token=xxx` - 验证邮箱
- `POST /api/auth/forgot-password` - 忘记密码
- `POST /api/auth/reset-password` - 重置密码
- `GET /api/auth/me` - 获取当前用户信息

### 前端页面

- `/auth/login` - 登录页面
- `/auth/register` - 注册页面
- `/auth/verify-email` - 邮箱验证页面
- `/auth/forgot-password` - 忘记密码页面
- `/auth/reset-password` - 重置密码页面

## 使用示例

### 在组件中使用认证

```tsx
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function MyPage() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <ProtectedRoute>
      <div>
        <h1>欢迎, {user?.name || user?.email}!</h1>
        <button onClick={logout}>退出登录</button>
      </div>
    </ProtectedRoute>
  );
}
```

### 在 API 路由中验证用户

```tsx
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return new Response('未授权', { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return new Response('令牌无效', { status: 401 });
  }

  // 使用 payload.userId 获取用户信息
  // ...
}
```

## 安全建议

1. **JWT_SECRET**: 使用强随机字符串，生产环境必须更改
2. **密码**: 使用 bcrypt 加密，强度为 10
3. **Token 过期**: JWT Token 7 天过期
4. **验证链接**: 邮箱验证 24 小时过期，密码重置 1 小时过期
5. **HTTPS**: 生产环境必须使用 HTTPS

## 故障排查

### MongoDB 连接失败

1. 检查 MongoDB 是否运行
2. 检查连接字符串是否正确
3. 检查网络访问权限（Atlas）

### 邮件发送失败

1. 检查邮件配置是否正确
2. Gmail 需要使用应用专用密码
3. 检查 SMTP 服务器是否可访问
4. 查看控制台错误日志

### Token 验证失败

1. 检查 JWT_SECRET 是否配置
2. 检查 Token 是否过期
3. 检查请求头是否正确

## 下一步

- [ ] 添加社交登录（Google, GitHub 等）
- [ ] 添加双因素认证（2FA）
- [ ] 添加用户资料管理
- [ ] 添加权限管理（RBAC）
- [ ] 添加登录历史记录

