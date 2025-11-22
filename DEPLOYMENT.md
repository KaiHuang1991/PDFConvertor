# 部署指南

## 🚀 快速开始（3步上线）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的Groq API Key：

```env
GROQ_API_KEY=your_groq_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**获取Groq API Key（免费）：**
1. 访问 https://console.groq.com/
2. 注册账号（免费）
3. 创建API Key
4. 复制到 `.env.local`

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 即可使用！

---

## 📦 部署到Vercel（推荐，免费）

### 方法1：通过GitHub部署（推荐）

1. **推送代码到GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin your-github-repo-url
   git push -u origin main
   ```

2. **在Vercel部署**
   - 访问 https://vercel.com
   - 用GitHub账号登录
   - 点击 "New Project"
   - 导入你的GitHub仓库
   - 在环境变量中添加 `GROQ_API_KEY`
   - 点击 "Deploy"

3. **完成！** 几分钟后你的网站就上线了 🎉

### 方法2：通过Vercel CLI

```bash
# 安装Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 添加环境变量
vercel env add GROQ_API_KEY
```

---

## 🌐 配置自定义域名

1. **购买域名**
   - 推荐：Namecheap、阿里云、GoDaddy
   - 建议域名：`aipdf.pro`、`pdf.ai`、`smartpdf.io`

2. **在Vercel添加域名**
   - 进入项目设置 → Domains
   - 添加你的域名
   - 按照提示配置DNS记录

3. **更新环境变量**
   ```env
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```

---

## 🔍 SEO优化（第4周任务）

### Google Analytics

1. 在 `app/layout.tsx` 中添加GA脚本
2. 创建GA账号获取跟踪ID

### Google Search Console

1. 访问 https://search.google.com/search-console
2. 添加你的网站
3. 验证所有权
4. 提交sitemap：`https://your-domain.com/sitemap.xml`

### 百度收录

1. 访问 https://ziyuan.baidu.com/
2. 添加网站
3. 提交sitemap

---

## 💰 成本估算

| 项目 | 成本 | 说明 |
|------|------|------|
| Vercel托管 | **免费** | 免费额度足够用 |
| Groq API | **免费** | 免费额度：30 requests/min |
| 域名 | ~100元/年 | 可选，建议购买 |
| Cloudflare CDN | **免费** | 可选，加速用 |
| **总计** | **~100元/年** | 几乎零成本！ |

---

## 🐛 常见问题

### Q: Groq API调用失败？
A: 检查 `.env.local` 中的 `GROQ_API_KEY` 是否正确，确保没有多余空格。

### Q: PDF处理很慢？
A: 大文件（>10MB）处理会较慢，这是正常的。考虑添加进度提示。

### Q: 部署后无法使用？
A: 确保在Vercel环境变量中添加了 `GROQ_API_KEY`。

### Q: 如何添加OCR功能？
A: OCR功能需要集成PaddleOCR WebAssembly，详见后续更新。

---

## 📈 下一步

- ✅ 阶段1完成：基础功能 + AI聊天
- 🔄 阶段2：自然语言编辑、PPT生成
- 🔄 阶段3：流量推广、付费转化

**祝你的AIPDF Pro早日上线！🚀**

