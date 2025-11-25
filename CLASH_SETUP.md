# Clash Verge 代理配置指南

根据您的 Clash Verge 设置，端口是 **7897**（不是默认的 7890）。

## 快速配置步骤

### 1. 在 `.env.local` 文件中添加代理配置

```env
# Groq API Key
GROQ_API_KEY=你的groq_api_key

# Clash Verge 代理配置（根据您的端口 7897）
GROQ_PROXY_URL=http://127.0.0.1:7897
# 或者使用全局代理
HTTPS_PROXY=http://127.0.0.1:7897
HTTP_PROXY=http://127.0.0.1:7897
```

### 2. 确保 Clash Verge 正常运行

- ✅ **系统代理**已启用（蓝色开关）
- ✅ **局域网连接**已启用
- ✅ 端口设置为 **7897**

### 3. 测试连接

运行测试脚本：

```bash
cd PDFConvertor
node scripts/test-groq.js
```

## 常见问题排查

### 问题1：仍然返回 403 错误

**可能原因：**
1. 代理地址不正确
2. Clash 未正常运行
3. 系统代理未生效

**解决方法：**
1. 检查 Clash Verge 是否正在运行
2. 确认端口号是 7897（不是 7890）
3. 确认系统代理已启用（蓝色开关）
4. 尝试在浏览器中访问 https://api.groq.com 测试代理是否工作

### 问题2：连接超时

**可能原因：**
1. Clash 未启动
2. 端口被占用
3. 防火墙阻止

**解决方法：**
1. 重启 Clash Verge
2. 检查端口 7897 是否被其他程序占用
3. 检查 Windows 防火墙设置

### 问题3：代理配置不生效

**解决方法：**
1. 重启 Next.js 开发服务器：
   ```bash
   # 停止当前服务器（Ctrl+C）
   npm run dev
   ```
2. 检查 `.env.local` 文件格式是否正确（没有多余的空格或引号）
3. 确认环境变量已正确加载（查看控制台日志）

## 验证代理是否工作

### 方法1：使用测试脚本

```bash
cd PDFConvertor
node scripts/test-groq.js
```

### 方法2：在浏览器中测试

1. 打开浏览器
2. 访问 https://api.groq.com
3. 如果能够访问（即使返回错误），说明代理工作正常

### 方法3：使用 curl 测试

```powershell
# 在 PowerShell 中测试
curl -x http://127.0.0.1:7897 https://api.groq.com
```

## 其他端口配置

如果您的 Clash 使用其他端口，请相应修改：

- **端口 7890**（默认）: `http://127.0.0.1:7890`
- **端口 7897**（您的配置）: `http://127.0.0.1:7897`
- **其他端口**: `http://127.0.0.1:你的端口号`

## 推荐方案

如果您仍然遇到问题，**强烈建议使用 DeepSeek API**：

1. ✅ 无需代理，直接访问
2. ✅ 已测试连接正常
3. ✅ 只需充值即可使用

在 `.env.local` 中配置：
```env
DEEPSEEK_API_KEY=你的deepseek_api_key
```

## 需要帮助？

如果以上方法都无法解决问题，请检查：
1. Clash Verge 的日志（查看是否有错误）
2. Next.js 控制台的错误信息
3. 网络连接是否正常

