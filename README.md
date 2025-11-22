# AIPDF Pro - AI驱动的PDF工具平台

🚀 **2025年最实战的AI PDF工具网站** - 碾压iLovePDF的下一代产品

## ✨ 核心功能

### 阶段1（已完成）
- ✅ PDF基础操作：合并、拆分、压缩、解锁密码、加水印
- ✅ AI聊天：与PDF对话，智能问答和总结
- ✅ OCR识别：支持中文、手写、表格识别
- ✅ 完全前端运行：隐私安全，无需上传服务器

### 阶段2（规划中）
- 🔄 自然语言编辑PDF
- 🔄 一键生成PPT/Word
- 🔄 批量AI处理

## 🛠️ 技术栈

- **前端框架**: Next.js 14 + React 18
- **样式**: Tailwind CSS + Framer Motion
- **PDF处理**: pdf-lib.js + pdf.js
- **AI引擎**: Groq (Llama 3.1 70B) / DeepSeek
- **OCR**: PaddleOCR WebAssembly
- **部署**: Vercel

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

访问 [http://localhost:3000](http://localhost:3000) 查看效果

## 📝 环境变量

创建 `.env.local` 文件：

```env
GROQ_API_KEY=your_groq_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📄 许可证

MIT License

## 🎯 路线图

- [x] 阶段1：基础功能 + AI聊天 + OCR
- [ ] 阶段2：核心AI功能（自然语言编辑、PPT生成）
- [ ] 阶段3：流量爆发 + 付费转化
- [ ] 阶段4：企业级功能 + 本地部署

