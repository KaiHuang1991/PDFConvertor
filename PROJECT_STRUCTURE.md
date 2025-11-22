# 项目结构说明

```
PDFConvertor/
├── app/                          # Next.js App Router目录
│   ├── api/                      # API路由
│   │   └── chat/                 # AI聊天API
│   │       └── route.ts          # Groq API集成
│   ├── globals.css               # 全局样式
│   ├── layout.tsx                # 根布局（SEO配置）
│   └── page.tsx                  # 首页组件
│
├── components/                   # React组件
│   ├── FileUploader.tsx         # 文件上传组件（拖拽支持）
│   ├── PDFTools.tsx             # PDF工具面板（合并/拆分/压缩等）
│   └── ChatWithPDF.tsx          # AI聊天界面
│
├── lib/                          # 工具函数库
│   ├── pdf-utils.ts             # PDF处理函数（pdf-lib封装）
│   └── utils.ts                 # 通用工具函数
│
├── .env.example                  # 环境变量模板
├── .gitignore                    # Git忽略文件
├── next.config.js               # Next.js配置
├── package.json                 # 项目依赖
├── postcss.config.js            # PostCSS配置
├── tailwind.config.ts           # Tailwind CSS配置
├── tsconfig.json                # TypeScript配置
│
├── README.md                     # 项目说明
├── QUICKSTART.md                # 快速启动指南
├── DEPLOYMENT.md                # 部署指南
└── PROJECT_STRUCTURE.md         # 本文件

```

## 核心功能模块

### 1. PDF基础操作 (`lib/pdf-utils.ts`)
- ✅ `mergePDFs()` - 合并多个PDF
- ✅ `splitPDF()` - 按页拆分PDF
- ✅ `compressPDF()` - 压缩PDF（简化版）
- ✅ `unlockPDF()` - 解锁PDF密码
- ✅ `addWatermark()` - 添加文字水印
- ✅ `extractTextFromPDF()` - 提取PDF文本（用于AI）

### 2. AI聊天功能 (`app/api/chat/route.ts`)
- ✅ 集成Groq API（Llama 3.1 70B）
- ✅ 支持PDF内容问答
- ✅ 对话历史管理

### 3. UI组件
- ✅ `FileUploader` - 拖拽上传，文件列表管理
- ✅ `PDFTools` - 工具按钮面板，加载状态
- ✅ `ChatWithPDF` - 聊天界面，消息流

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS + Framer Motion
- **PDF处理**: pdf-lib.js + pdf.js
- **AI引擎**: Groq SDK (Llama 3.1)
- **图标**: Lucide React

## 下一步开发

### 阶段1剩余（第3-4周）
- [ ] OCR功能（PaddleOCR WebAssembly）
- [ ] SEO优化（sitemap、meta标签）
- [ ] 错误处理优化

### 阶段2（第5-8周）
- [ ] 自然语言编辑PDF
- [ ] PDF转PPT/Word
- [ ] 批量处理工作流
- [ ] UI美化升级

### 阶段3（第9-12周）
- [ ] 用户系统（可选）
- [ ] 付费功能
- [ ] 数据分析

## 注意事项

1. **API Key安全**: 永远不要将 `.env.local` 提交到Git
2. **文件大小限制**: 大文件（>50MB）可能影响性能
3. **浏览器兼容**: 需要现代浏览器支持（Chrome/Firefox/Edge）
4. **Groq限制**: 免费版有速率限制（30 req/min）

