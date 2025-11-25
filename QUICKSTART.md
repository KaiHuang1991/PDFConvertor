# 🚀 3分钟快速启动指南

## 第一步：安装依赖（1分钟）

```bash
npm install
```

## 第二步：配置API Key（1分钟）

### 方案1：DeepSeek API（推荐，中国用户可用）⭐

1. 访问 https://platform.deepseek.com/ 注册账号（免费）
2. 创建API Key
3. 创建 `.env.local` 文件：

```env
DEEPSEEK_API_KEY=你的deepseek_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 方案2：Groq API（需要代理，中国用户可能无法直接访问）

1. 访问 https://console.groq.com/ 注册账号（免费）
2. 创建API Key
3. 创建 `.env.local` 文件：

```env
GROQ_API_KEY=你的groq_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 如果在中国，需要配置代理（可选）
GROQ_PROXY_URL=http://proxy.example.com:8080
# 或使用全局代理
HTTPS_PROXY=http://proxy.example.com:8080
```

**注意**：如果您在中国，Groq API 可能无法直接访问（会出现 403 错误）。您需要：
- 配置代理（见 `PROXY_SETUP.md` 详细说明）
- 或使用方案1（DeepSeek API，推荐）

## 第三步：启动（30秒）

```bash
npm run dev
```

打开浏览器访问：**http://localhost:3000**

---

## ✅ 完成！

现在你可以：
- 📄 上传PDF文件
- 🔗 合并、拆分、压缩PDF
- 🔓 解锁PDF密码
- 💬 与PDF智能聊天
- 🎨 添加水印

**所有操作都在浏览器中完成，完全保护隐私！**

---

## 🎯 测试功能

1. **合并PDF**：上传2个PDF → 点击"合并PDF"
2. **AI聊天**：上传1个PDF → 切换到"AI聊天"标签 → 问"总结这份文档"
3. **拆分PDF**：上传1个PDF → 点击"拆分PDF" → 输入"1-5,6-10"

---

## 📝 下一步

- 阅读 `DEPLOYMENT.md` 了解如何部署到Vercel
- 阅读 `README.md` 了解完整功能列表
- 开始推广你的产品！

**祝你成功！🎉**

