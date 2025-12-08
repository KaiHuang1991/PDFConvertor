# Adobe PDF Services API 配置指南

本指南将帮助您配置 Adobe PDF Services API，以使用 OCR 和 PDF 转换功能。

## 1. 获取 Adobe API 凭证

### 步骤 1: 注册 Adobe 账号

1. 访问 [Adobe Developer Console](https://developer.adobe.com/)
2. 使用您的 Adobe 账号登录（如果没有账号，请先注册）

### 步骤 2: 创建新项目

1. 在 Adobe Developer Console 中，点击 **"Create new project"** 或 **"创建新项目"**
2. 选择 **"Add API"** 或 **"添加 API"**

### 步骤 3: 添加 PDF Services API

1. 在 API 列表中找到 **"PDF Services API"**
2. 点击 **"Add to project"** 或 **"添加到项目"**
3. 如果需要，请按照提示订阅服务（可能有免费试用额度）

### 步骤 4: 获取 OAuth Server-to-Server 凭证

1. 在项目页面中，找到左侧导航栏的 **"CREDENTIALS"** 部分
2. 点击 **"OAuth Server-to-Server"**（这应该是您当前看到的页面）
3. **获取 Client ID**：
   - 在页面中找到 **"Client ID"** 字段
   - 复制 Client ID（例如：`8dde7dd5827245edb96dffe91cd7cb88`）
4. **获取 Client Secret**：
   - 找到 **"Client Secret"** 字段
   - 点击旁边的 **"Retrieve client secret"** 按钮
   - **重要**：Client Secret 只会显示一次！请立即复制并保存
   - 如果之前已经获取过，您可能需要创建新的凭证或重置

**注意**：
- Client Secret 出于安全考虑，默认不显示
- 点击 "Retrieve client secret" 后，Secret 会显示在页面上
- 请立即复制并妥善保存，因为刷新页面后可能不再显示

## 2. 配置环境变量

### 在项目根目录创建或编辑 `.env.local` 文件：

```env
# Adobe PDF Services API 凭证
ADOBE_CLIENT_ID=your_client_id_here
ADOBE_CLIENT_SECRET=your_client_secret_here
```

**重要提示：**
- 请将 `your_client_id_here` 替换为您的实际 Client ID（例如：`8dde7dd5827245edb96dffe91cd7cb88`）
- 请将 `your_client_secret_here` 替换为点击 "Retrieve client secret" 后显示的 Client Secret
- **Client Secret 示例**：通常是一串长字符，类似 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- 不要将 `.env.local` 文件提交到 Git 仓库（已在 `.gitignore` 中）

## 3. 验证配置

1. 启动开发服务器：
   ```bash
   npm run dev
   ```

2. 访问 OCR 页面或转换页面

3. 如果配置正确，页面会显示 Adobe API 已配置的状态

## 4. API 功能说明

### OCR 功能

- **功能**：将扫描的 PDF 文档转换为可搜索的 PDF
- **特点**：
  - 保留原始图像
  - 添加不可见的文本层
  - 支持多种语言（英语、德语、法语等）
- **使用方法**：上传扫描的 PDF 文件，点击 "OCR 识别"

### PDF 转换功能

支持的转换格式：

- **DOCX**：转换为 Microsoft Word 文档
- **PPTX**：转换为 Microsoft PowerPoint 演示文稿
- **XLSX**：转换为 Microsoft Excel 电子表格
- **RTF**：转换为 RTF 富文本格式
- **JPG/PNG**：转换为图片格式

## 5. 故障排除

### 问题 1: 找不到 Client Secret

**问题**：在 Adobe Developer Console 中看不到 Client Secret

**解决方案：**
- 找到 **"Client Secret"** 字段（在 Client ID 下方）
- 点击 **"Retrieve client secret"** 按钮
- Client Secret 会显示在按钮下方或弹窗中
- **立即复制**并保存到安全的地方
- 如果按钮点击后没有显示，可能需要刷新页面或检查浏览器控制台是否有错误

### 问题 2: "未配置 Adobe API 凭证" 错误

**解决方案：**
- 检查 `.env.local` 文件是否存在
- 确认 `ADOBE_CLIENT_ID` 和 `ADOBE_CLIENT_SECRET` 已正确设置
- 确保 Client Secret 是完整的（没有遗漏字符）
- 重启开发服务器

### 问题 2: API 调用失败

**可能原因：**
- 凭证无效或已过期
- API 配额已用完
- 网络连接问题

**解决方案：**
- 检查 Adobe Developer Console 中的 API 状态
- 查看控制台错误日志
- 确认服务订阅状态

### 问题 3: 转换结果不理想

**建议：**
- 确保 PDF 文件质量良好
- 对于 OCR，使用清晰的扫描件
- 对于转换，确保原始 PDF 格式正确

## 6. 定价信息

Adobe PDF Services API 提供：
- **免费试用**：通常有免费额度（如每月 1000 次调用）
- **付费计划**：根据使用量计费

详细信息请访问 [Adobe 官方定价页面](https://developer.adobe.com/apis/pdftools/pricing)

## 7. 安全注意事项

1. **保护凭证**：
   - 永远不要将 API 凭证提交到公开的代码仓库
   - 使用环境变量存储凭证
   - 定期轮换凭证

2. **API 限制**：
   - 注意 API 调用频率限制
   - 监控 API 使用量
   - 设置合理的错误处理和重试机制

## 8. 更多资源

- [Adobe PDF Services API 官方文档](https://developer.adobe.com/document-services/docs/overview/pdf-services-api/)
- [Node.js SDK 文档](https://developer.adobe.com/document-services/docs/overview/pdf-services-api/howtos/nodejs/)
- [API 参考](https://developer.adobe.com/document-services/docs/apis/#tag/PDF-Services)

## 支持

如果遇到问题，可以：
1. 查看 Adobe Developer Console 中的日志
2. 参考官方文档
3. 联系 Adobe 技术支持

