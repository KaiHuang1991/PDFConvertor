# Adobe PDF Services API 配置指南

## 📋 概述

Adobe PDF Services API 提供专业的 PDF 处理功能，包括：
- **OCR 识别**：将扫描的 PDF 转换为可搜索的 PDF
- **PDF 转 Word/Office**：将 PDF 转换为 Word、PowerPoint、Excel、RTF、图片等格式
- **Word/Office 转 PDF**：将 Word、PowerPoint、Excel、RTF、TXT、HTML 转换为 PDF

## 🔑 获取 API 凭证

### 步骤 1：创建 Adobe 账户

1. 访问 [Adobe Developer Console](https://developer.adobe.com/console)
2. 使用您的 Adobe ID 登录（如果没有账户，请先注册）

### 步骤 2：创建项目

1. 在 Adobe Developer Console 中，点击 **"Create new project"**
2. 选择 **"Add API"**
3. 搜索并选择 **"PDF Services API"**
4. 点击 **"Next"** 继续

### 步骤 3：创建服务凭证（Service Principal）

1. 在项目设置中，选择 **"Service Account (JWT)"** 或 **"OAuth Server-to-Server"**
2. 填写项目信息：
   - **Project Name**: 您的项目名称
   - **Description**: 项目描述（可选）
3. 点击 **"Create credentials"**
4. 下载凭证文件（JSON 格式）或复制以下信息：
   - **Client ID** (API Key)
   - **Client Secret**

### 步骤 4：配置环境变量

1. 在项目根目录创建 `.env.local` 文件（如果不存在）
2. 复制 `.env.local.example` 文件的内容，或直接添加以下内容：

```env
ADOBE_CLIENT_ID=your_client_id_here
ADOBE_CLIENT_SECRET=your_client_secret_here
```

3. 将 `your_client_id_here` 和 `your_client_secret_here` 替换为从 Adobe Developer Console 获取的实际值

**重要提示：**
- 不要将 `.env.local` 文件提交到 Git（已在 `.gitignore` 中）
- 确保 `.env.local` 文件在项目根目录（与 `package.json` 同级）
- 配置后需要**重启开发服务器**（`npm run dev`）才能生效
- 确保 `ADOBE_CLIENT_ID` 和 `ADOBE_CLIENT_SECRET` 的值**没有多余的空格或引号**

## 🚀 使用说明

### 1. PDF 转 Word/Office

1. 访问 `/adobe` 页面
2. 上传 PDF 文件
3. 选择 **"PDF 转 Word"** 或其他格式
4. 等待转换完成并下载

### 2. Word/Office 转 PDF

1. 访问 `/adobe` 页面
2. 上传 Word 文档（.docx）或其他 Office 文档
3. 选择 **"Word 转 PDF"** 或 **"Office 转 PDF"**
4. 等待转换完成并下载

### 3. OCR 识别

1. 访问 `/adobe` 页面
2. 上传扫描的 PDF 文件
3. 选择 **"OCR 识别"**
4. 等待处理完成，将获得可搜索的 PDF 文件

## 📝 支持的文件格式

### PDF 转其他格式
- ✅ Word (.docx)
- ✅ PowerPoint (.pptx)
- ✅ Excel (.xlsx)
- ✅ RTF
- ✅ JPG
- ✅ PNG

### 其他格式转 PDF
- ✅ Word (.docx, .doc)
- ✅ PowerPoint (.pptx, .ppt)
- ✅ Excel (.xlsx, .xls)
- ✅ RTF
- ✅ TXT
- ✅ HTML/HTM

## ⚠️ 注意事项

1. **API 配额**：Adobe PDF Services API 有免费额度限制，超出后需要付费
2. **文件大小**：建议单个文件不超过 100MB
3. **处理时间**：大文件可能需要较长时间处理
4. **网络要求**：需要稳定的网络连接访问 Adobe API

## 🔧 故障排除

### 问题 1：提示 "Adobe API 未配置"

**解决方案：**
- 检查 `.env.local` 文件是否存在
- 确认 `ADOBE_CLIENT_ID` 和 `ADOBE_CLIENT_SECRET` 已正确设置
- 重启开发服务器（`npm run dev`）

### 问题 2：转换失败

**可能原因：**
- API 凭证无效或过期
- 文件格式不支持
- 文件损坏
- 网络连接问题

**解决方案：**
- 检查 API 凭证是否正确
- 确认文件格式在支持列表中
- 尝试使用其他文件测试
- 检查网络连接

### 问题 3：转换速度慢

**解决方案：**
- 检查文件大小，大文件需要更长时间
- 检查网络连接速度
- 如果持续慢，可能是 Adobe API 服务繁忙

## 📚 更多资源

- [Adobe PDF Services API 文档](https://developer.adobe.com/document-services/docs/overview/pdf-services-api/)
- [Adobe Developer Console](https://developer.adobe.com/console)
- [API 参考文档](https://developer.adobe.com/document-services/docs/apis/)

## 💡 提示

- 使用 Adobe API 可以获得更高质量的转换结果
- OCR 功能特别适合处理扫描的文档
- Word 转 PDF 可以完美保留原始格式和布局

