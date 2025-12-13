# 百度 OCR API 配置指南

## 📋 当前 OCR 功能概述

本项目目前支持两种 OCR 识别方式：

### 1. 本地 OCR（当前默认）
- **引擎**: PaddleOCR WebAssembly
- **优点**: 
  - ✅ 完全免费，无使用限制
  - ✅ 隐私保护，数据不上传
  - ✅ 离线可用
- **缺点**: 
  - ⚠️ 识别准确率相对较低（特别是手写文字）
  - ⚠️ 处理速度较慢（大图片）
  - ⚠️ 需要加载较大的 WebAssembly 文件

### 2. 云端 OCR（需要配置）
- **引擎**: 百度 OCR API
- **优点**: 
  - ✅ 识别准确率高（95%+）
  - ✅ 处理速度快（200-500ms）
  - ✅ 支持表格、手写、公式识别
  - ✅ 中文识别效果最好
- **缺点**: 
  - ⚠️ 需要网络连接
  - ⚠️ 有使用费用（1000次/天免费）
  - ⚠️ 数据需要上传到百度服务器

---

## 🔧 百度 OCR API 配置步骤

### 第一步：获取百度 API 密钥

1. **注册/登录百度智能云**
   - 访问：https://cloud.baidu.com/
   - 使用百度账号登录（如果没有账号，先注册）

2. **开通 OCR 服务**
   - 登录后，进入控制台
   - 搜索并进入「文字识别」服务
   - 点击「立即开通」或「立即使用」
   - 阅读并同意服务协议

3. **创建应用获取密钥**
   - 在「文字识别」控制台，点击「创建应用」
   - 填写应用信息：
     - 应用名称：例如「PDF转换器OCR」
     - 应用类型：选择「文字识别」
     - 接口选择：勾选需要的接口（至少选择「通用文字识别」）
   - 点击「立即创建」

4. **获取 API Key 和 Secret Key**
   - 创建成功后，在应用列表中可以看到你的应用
   - 点击「查看应用详情」
   - 记录下以下信息：
     - **API Key** (Client ID)
     - **Secret Key** (Client Secret)

### 第二步：配置环境变量

1. **创建环境变量文件**

   在项目根目录（`PDFConvertor/`）下创建 `.env.local` 文件：

   ```bash
   # 百度 OCR API 配置
   BAIDU_OCR_API_KEY=你的API_Key
   BAIDU_OCR_SECRET_KEY=你的Secret_Key
   ```

   **示例**：
   ```bash
   BAIDU_OCR_API_KEY=abcd1234efgh5678
   BAIDU_OCR_SECRET_KEY=ijkl9012mnop3456
   ```

2. **环境变量文件位置**
   ```
   PDFConvertor/
   ├── .env.local          ← 在这里创建（本地开发用）
   ├── .env                ← 或者这里（生产环境）
   └── ...
   ```

3. **安全提示**
   - ⚠️ **不要**将 `.env.local` 提交到 Git
   - ⚠️ `.env.local` 已在 `.gitignore` 中，不会被提交
   - ⚠️ 生产环境部署时，需要在服务器环境变量中配置

### 第三步：验证配置

1. **重启开发服务器**
   ```bash
   # 如果开发服务器正在运行，先停止（Ctrl+C）
   # 然后重新启动
   npm run dev
   ```

2. **测试 OCR 功能**
   - 访问：http://localhost:3000/ocr
   - 上传一张图片或PDF
   - 点击「开始OCR识别」
   - 如果配置正确，应该能正常识别

3. **查看错误信息**
   - 如果配置错误，会在浏览器控制台看到错误信息
   - 常见错误：
     - `未配置百度 OCR API 密钥` → 检查环境变量是否设置
     - `获取百度 OCR access_token 失败` → 检查 API Key 和 Secret Key 是否正确

---

## 📝 代码说明

### API 路由
配置文件位置：`app/api/ocr/recognize/route.ts`

这个文件负责：
- 从环境变量读取 API 密钥
- 调用百度 OCR API
- 保护 API 密钥不被前端暴露

### 调用流程
```
前端页面 (app/ocr/page.tsx)
    ↓
OCR 工具函数 (lib/ocr-cloud.ts)
    ↓
Next.js API 路由 (app/api/ocr/recognize/route.ts)
    ↓
百度 OCR API
```

---

## 🔄 切换到云端 OCR

目前 OCR 页面默认使用本地 OCR（PaddleOCR）。要切换到百度云端 OCR，需要修改代码：

### 方案 1：在 OCR 页面添加云端选项（推荐）

修改 `app/ocr/page.tsx`，添加 OCR 引擎选择功能。

### 方案 2：直接替换本地 OCR

如果需要完全使用云端 OCR，可以修改 `app/ocr/page.tsx` 中的 `handleOCR` 函数。

---

## 💰 价格说明

### 免费额度
- **1000次/天** 免费调用
- 适用于个人开发和小规模使用

### 付费价格
- **标准版**: 0.001元/次
- **高精度版**: 0.002元/次
- **表格识别**: 0.003元/次

### 查看使用量
- 登录百度智能云控制台
- 进入「费用中心」→「使用明细」
- 可以查看每日调用次数和费用

---

## 🐛 常见问题

### Q1: 提示「未配置百度 OCR API 密钥」
**A**: 检查 `.env.local` 文件是否存在，环境变量名称是否正确，然后重启开发服务器。

### Q2: 提示「获取 access_token 失败」
**A**: 检查 API Key 和 Secret Key 是否正确，是否开通了 OCR 服务。

### Q3: 如何查看 API 调用日志？
**A**: 
- 在浏览器开发者工具的 Network 标签中查看 API 请求
- 在服务器控制台查看日志输出

### Q4: 支持哪些图片格式？
**A**: 百度 OCR 支持：
- 图片格式：PNG、JPG、JPEG、BMP
- 文件大小：不超过 4MB
- 图片尺寸：最小 15x15 像素，最大 4096x4096 像素

### Q5: 如何切换回本地 OCR？
**A**: 删除或注释掉环境变量配置，OCR 会自动使用本地 PaddleOCR。

---

## 📚 相关文档

- [百度 OCR 官方文档](https://ai.baidu.com/ai-doc/OCR/zk3h7xz52)
- [OCR API 推荐文档](./docs/OCR_API_RECOMMENDATIONS.md)
- [云端 OCR 代码实现](./lib/ocr-cloud.ts)
- [OCR API 路由实现](./app/api/ocr/recognize/route.ts)

---

## 🎯 下一步

配置完成后，你可以：
1. 在 OCR 页面测试识别效果
2. 对比本地 OCR 和云端 OCR 的识别准确率
3. 根据需求选择合适的 OCR 引擎
4. 如果需要，我可以帮你添加 OCR 引擎切换功能








