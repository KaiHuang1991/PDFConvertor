# 百度 OCR API 快速配置

## 🎯 三步配置

### 1️⃣ 获取百度 API 密钥
- 访问：https://cloud.baidu.com/product/ocr
- 登录 → 开通「文字识别」→ 创建应用
- 获取 `API Key` 和 `Secret Key`

### 2️⃣ 创建环境变量文件

在项目根目录 `PDFConvertor/` 下创建 `.env.local`：

```bash
BAIDU_OCR_API_KEY=你的API_Key
BAIDU_OCR_SECRET_KEY=你的Secret_Key
```

### 3️⃣ 重启开发服务器

```bash
# 停止当前服务器（Ctrl+C）
npm run dev
```

---

## ✅ 验证配置

访问 http://localhost:3000/ocr 测试 OCR 功能

---

## 📋 当前状态

- ✅ **本地 OCR**：已集成（PaddleOCR WebAssembly）
- ✅ **云端 OCR API**：已实现，待配置环境变量
- ⚠️ **OCR 页面**：目前默认使用本地 OCR

---

## 💡 详细文档

查看完整配置指南：[OCR_BAIDU_SETUP.md](./OCR_BAIDU_SETUP.md)







