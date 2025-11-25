# Groq API 代理配置指南

如果您在中国需要使用 Groq API，可以通过配置代理来访问。

## 方法1：使用环境变量配置代理（推荐）

在 `.env.local` 文件中添加代理配置：

```env
# Groq API Key
GROQ_API_KEY=你的groq_api_key

# 代理配置（选择以下方式之一）
# 方式1：使用 GROQ_PROXY_URL（仅用于 Groq API）
GROQ_PROXY_URL=http://proxy.example.com:8080

# 方式2：使用全局代理（用于所有 HTTP/HTTPS 请求）
HTTPS_PROXY=http://proxy.example.com:8080
HTTP_PROXY=http://proxy.example.com:8080
```

### 代理 URL 格式

- HTTP 代理：`http://proxy.example.com:8080`
- HTTPS 代理：`https://proxy.example.com:8080`
- 需要认证的代理：`http://username:password@proxy.example.com:8080`
- SOCKS5 代理：`socks5://proxy.example.com:1080`

## 方法2：使用系统环境变量

在启动应用前设置系统环境变量：

**Windows (PowerShell):**
```powershell
$env:HTTPS_PROXY="http://proxy.example.com:8080"
$env:HTTP_PROXY="http://proxy.example.com:8080"
npm run dev
```

**Windows (CMD):**
```cmd
set HTTPS_PROXY=http://proxy.example.com:8080
set HTTP_PROXY=http://proxy.example.com:8080
npm run dev
```

**Linux/Mac:**
```bash
export HTTPS_PROXY=http://proxy.example.com:8080
export HTTP_PROXY=http://proxy.example.com:8080
npm run dev
```

## 测试代理配置

运行测试脚本验证代理是否正常工作：

```bash
cd PDFConvertor
node scripts/test-groq.js
```

## 常见代理服务

### 1. 本地代理软件
- **Clash**: 支持 HTTP/HTTPS/SOCKS5 代理
- **V2Ray**: 支持多种代理协议
- **Shadowsocks**: 轻量级代理

### 2. 在线代理服务
- 一些云服务商提供的代理服务
- 企业级代理服务

## 注意事项

1. **安全性**：确保代理服务安全可靠，不要使用不可信的代理服务
2. **性能**：代理可能会影响 API 响应速度
3. **稳定性**：选择稳定的代理服务，避免频繁断线
4. **成本**：某些代理服务可能需要付费

## 推荐方案

如果您在中国，**强烈推荐使用 DeepSeek API**，因为：
- ✅ 无需代理，直接访问
- ✅ 响应速度快
- ✅ 价格合理
- ✅ 支持中文

只需在 `.env.local` 中配置：
```env
DEEPSEEK_API_KEY=你的deepseek_api_key
```

## 故障排查

如果配置代理后仍然无法访问：

1. **检查代理是否正常工作**
   ```bash
   curl -x http://proxy.example.com:8080 https://api.groq.com/v1/models
   ```

2. **检查代理 URL 格式是否正确**
   - 确保包含协议（http:// 或 https://）
   - 确保端口号正确
   - 如果使用认证，确保用户名和密码正确

3. **检查防火墙设置**
   - 确保代理端口未被防火墙阻止

4. **查看日志**
   - 检查控制台输出，查看是否有代理相关错误信息

5. **尝试不同的代理协议**
   - 如果 HTTP 代理不行，尝试 SOCKS5 代理

## 示例配置

### 示例1：使用 Clash 代理
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
GROQ_PROXY_URL=http://127.0.0.1:7890
```

### 示例2：使用认证代理
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
GROQ_PROXY_URL=http://username:password@proxy.example.com:8080
```

### 示例3：使用 SOCKS5 代理
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
GROQ_PROXY_URL=socks5://127.0.0.1:1080
```

