// 翻译文本定义
export type Locale = 'zh' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ru' | 'ko' | 'zh-TW' | 'ar';

export interface Translations {
  // 通用
  common: {
    loading: string;
    error: string;
    success: string;
    cancel: string;
    confirm: string;
    save: string;
    delete: string;
    edit: string;
    close: string;
    back: string;
    next: string;
    submit: string;
    search: string;
    upload: string;
    download: string;
  };

  // 导航
  nav: {
    home: string;
    pdfViewer: string;
    pdfEditor: string;
    pdfTools: string;
    formatConversion: string;
    aiChat: string;
    ocrRecognition: string;
    pricing: string;
    security: string;
    features: string;
    aboutUs: string;
    help: string;
    language: string;
  };

  // 认证
  auth: {
    login: string;
    logout: string;
    register: string;
    email: string;
    password: string;
    confirmPassword: string;
    name: string;
    forgotPassword: string;
    resetPassword: string;
    emailVerified: string;
    emailNotVerified: string;
    loginSuccess: string;
    registerSuccess: string;
    profile: string;
    personalCenter: string;
  };

  // 首页
  home: {
    title: string;
    subtitle: string;
    privacyNote: string;
    coreFeatures: string;
    getStarted: string;
    ctaDescription: string;
    startUsingTools: string;
    tryAIChat: string;
    features: {
      pdfBasicOps: {
        title: string;
        desc: string;
      };
      pdfEditor: {
        title: string;
        desc: string;
      };
      formatConversion: {
        title: string;
        desc: string;
      };
      aiChat: {
        title: string;
        desc: string;
      };
      ocr: {
        title: string;
        desc: string;
      };
    };
  };

  // 用户面板
  profile: {
    title: string;
    editProfile: string;
    username: string;
    birthDate: string;
    accountType: string;
    emailStatus: string;
    freeUser: string;
    premiumUser: string;
    vipUser: string;
    verified: string;
    notVerified: string;
    notSet: string;
    backToHome: string;
  };

  // 通用页面
  pages: {
    backToHome: string;
    back: string;
  };

  // 工具页面
  tools: {
    title: string;
    subtitle: string;
    privacyNote: string;
    readyToProcess: string;
    uploadFile: string;
  };

  // PDF查看器
  viewer: {
    title: string;
    description: string;
  };

  // PDF编辑器
  editor: {
    title: string;
    description: string;
    uploadPDF: string;
    editingTools: string;
    operationHistory: string;
    noOperations: string;
    previousPage: string;
    nextPage: string;
    pageOf: string;
    zoomIn: string;
    zoomOut: string;
    addPage: string;
    deletePage: string;
    savePDF: string;
    select: string;
    image: string;
    rectangle: string;
    circle: string;
    line: string;
    highlight: string;
    underline: string;
    textBox: string;
    signature: string;
    uploadPDFFile: string;
    clickToPlaceImage: string;
    cancel: string;
    imageProperties: string;
    rotationAngle: string;
    degrees: string;
    opacity: string;
    inputText: string;
    enterTextContent: string;
    confirm: string;
    noEditsToSave: string;
    atLeastOnePage: string;
    imageRotationNote: string;
  };

  // 格式转换
  convert: {
    title: string;
    subtitle: string;
    privacyNote: string;
    description: string;
    browserOnly: string;
    noServerUpload: string;
    readyToConvert: string;
    uploadToStart: string;
    tips: string;
    tipImage: string;
    tipText: string;
    tipHTML: string;
    tipPrivacy: string;
  };

  // AI聊天
  chat: {
    title: string;
    subtitle: string;
    description: string;
  };

  // OCR识别
  ocr: {
    title: string;
    subtitle: string;
    description: string;
    startOCR: string;
    processing: string;
    recognitionResult: string;
    text: string;
    table: string;
    stats: string;
    settings: string;
  };

  // 认证页面
  login: {
    welcomeBack: string;
    continueWith: string;
    noAccount: string;
    registerNow: string;
  };

  register: {
    createAccount: string;
    registerToUse: string;
    haveAccount: string;
    loginNow: string;
  };

  // PDF工具组件
  pdfTools: {
    merge: string;
    mergeDesc: string;
    split: string;
    splitDesc: string;
    compress: string;
    compressDesc: string;
    unlock: string;
    unlockDesc: string;
    watermark: string;
    watermarkDesc: string;
    atLeast2Files: string;
    invalidRange: string;
    enterPassword: string;
    enterWatermarkText: string;
    watermarkSettings: string;
    watermarkText: string;
    rotationAngle: string;
    rows: string;
    cols: string;
    opacity: string;
    fontSize: string;
    applyAndDownload: string;
    splitSettings: string;
    pageRange: string;
    pageRangeExample: string;
    pageRangeTip: string;
    splitAndDownload: string;
    compressSettings: string;
    originalSize: string;
    compressedSize: string;
    compressionRatio: string;
    downloadCompressed: string;
    unlockSettings: string;
    pdfPassword: string;
    unlockAndDownload: string;
    processing: string;
    mergeFailed: string;
    splitFailed: string;
    compressFailed: string;
    unlockFailed: string;
    watermarkFailed: string;
    startCompress: string;
    compressProgress: string;
    compressComplete: string;
    reduce: string;
    compressTip: string;
  };

  // PDF转换组件
  pdfConverter: {
    toImage: string;
    toImageDesc: string;
    toText: string;
    toTextDesc: string;
    toHTML: string;
    toHTMLDesc: string;
    toWord: string;
    toWordDesc: string;
    imageSettings: string;
    imageFormat: string;
    scale: string;
    lowQuality: string;
    recommended: string;
    highQuality: string;
    jpegQuality: string;
    convertToImages: string;
    converting: string;
    textExtraction: string;
    textExtractionDesc: string;
    convertToText: string;
    htmlSettings: string;
    includeImages: string;
    convertToHTML: string;
    wordSettings: string;
    preserveFormatting: string;
    preserveLayout: string;
    preserveFormattingFull: string;
    preserveLayoutFull: string;
    convertToWord: string;
    convertSuccess: string;
    imagesSuccess: string;
    textSuccess: string;
    htmlSuccess: string;
    wordSuccess: string;
    convertFailed: string;
  };

  // 聊天组件
  chatWithPDF: {
    uploadFirst: string;
    aiAssistant: string;
    extracting: string;
    extractSuccess: string;
    extractFailed: string;
    askAnything: string;
    waitingExtract: string;
    tip: string;
    serviceUnavailable: string;
    requestFailed: string;
    error: string;
  };

  // 文件上传组件
  fileUploader: {
    dragOrClick: string;
    clickToSelect: string;
    formats: string;
    uploadedFiles: string;
    deleteFile: string;
  };
}

// 中文（简体）
const zh: Translations = {
  common: {
    loading: '加载中...',
    error: '错误',
    success: '成功',
    cancel: '取消',
    confirm: '确认',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    close: '关闭',
    back: '返回',
    next: '下一步',
    submit: '提交',
    search: '搜索',
    upload: '上传',
    download: '下载',
  },
  nav: {
    home: '首页',
    pdfViewer: 'PDF查看器',
    pdfEditor: 'PDF编辑器',
    pdfTools: 'PDF工具',
    formatConversion: '格式转换',
    aiChat: 'AI聊天',
    ocrRecognition: 'OCR识别',
    pricing: '定价',
    security: '安全',
    features: '功能',
    aboutUs: '关于我们',
    help: '帮助',
    language: '语言',
  },
  auth: {
    login: '登录',
    logout: '退出登录',
    register: '注册',
    email: '邮箱',
    password: '密码',
    confirmPassword: '确认密码',
    name: '姓名',
    forgotPassword: '忘记密码',
    resetPassword: '重置密码',
    emailVerified: '邮箱已验证',
    emailNotVerified: '邮箱未验证',
    loginSuccess: '登录成功',
    registerSuccess: '注册成功',
    profile: '个人中心',
    personalCenter: '个人中心',
  },
  home: {
    title: '下一代AI PDF工具',
    subtitle: '免费、快速、强大 - 合并、拆分、压缩、转换、解锁、OCR、智能聊天',
    privacyNote: '完全前端运行，保护您的隐私',
    coreFeatures: '核心功能',
    getStarted: '准备好开始了吗？',
    ctaDescription: '选择一个功能开始使用，所有操作都在浏览器中完成，完全保护您的隐私',
    startUsingTools: '开始使用PDF工具',
    tryAIChat: '体验AI聊天',
    features: {
      pdfBasicOps: {
        title: 'PDF基础操作',
        desc: '合并、拆分、压缩、解锁密码、加水印，全部前端运行',
      },
      pdfEditor: {
        title: 'PDF编辑器',
        desc: '图像/形状插入、注释标记、页面管理、表单填写、签名添加',
      },
      formatConversion: {
        title: 'PDF格式转换',
        desc: 'PDF转图片、文本、HTML，支持批量转换，完全本地处理',
      },
      aiChat: {
        title: 'AI智能聊天',
        desc: '与PDF对话，智能问答、总结、提取关键信息',
      },
      ocr: {
        title: 'OCR识别',
        desc: '支持中文、手写、表格识别，识别后直接导出Word',
      },
    },
  },
  profile: {
    title: '个人中心',
    editProfile: '编辑个人信息',
    username: '用户名',
    birthDate: '出生日期',
    accountType: '账户类型',
    emailStatus: '邮箱状态',
    freeUser: '免费用户',
    premiumUser: '会员用户',
    vipUser: 'VIP用户',
    verified: '已验证',
    notVerified: '未验证',
    notSet: '未设置',
    backToHome: '返回首页',
  },
  pages: {
    backToHome: '返回首页',
    back: '返回',
  },
  tools: {
    title: 'PDF基础操作',
    subtitle: 'PDF基础操作工具',
    privacyNote: '完全本地处理，保护隐私',
    readyToProcess: '准备开始处理PDF',
    uploadFile: '请上传PDF文件开始使用',
  },
  viewer: {
    title: 'PDF 查看器',
    description: '支持上传 PDF、放大缩小、旋转、页面跳转、全文搜索、全屏预览',
  },
  editor: {
    title: 'PDF 编辑器',
    description: '支持图像/形状插入、注释标记、页面管理、表单填写、签名添加等功能',
    uploadPDF: '上传PDF',
    editingTools: '编辑工具',
    operationHistory: '操作历史',
    noOperations: '暂无操作',
    previousPage: '上一页',
    nextPage: '下一页',
    pageOf: '第 {current} / {total} 页',
    zoomIn: '放大',
    zoomOut: '缩小',
    addPage: '添加页面',
    deletePage: '删除页面',
    savePDF: '保存PDF',
    select: '选择',
    image: '图像',
    rectangle: '矩形',
    circle: '圆形',
    line: '直线',
    highlight: '高亮',
    underline: '下划线',
    textBox: '文本框',
    signature: '签名',
    uploadPDFFile: '请上传PDF文件开始编辑',
    clickToPlaceImage: '点击PDF放置图像',
    cancel: '取消',
    imageProperties: '图片属性',
    rotationAngle: '旋转角度（度）',
    degrees: '度',
    opacity: '透明度',
    inputText: '输入文本',
    enterTextContent: '输入文本内容...',
    confirm: '确定',
    noEditsToSave: '没有可保存的编辑操作',
    atLeastOnePage: '至少需要保留一页',
    imageRotationNote: '输入0-360度的旋转角度，或点击按钮快速旋转90度',
  },
  convert: {
    title: 'PDF格式转换',
    subtitle: 'PDF 格式转换工具',
    privacyNote: '完全本地处理，保护隐私',
    description: '支持 PDF 转图片、文本、HTML 等多种格式',
    browserOnly: '所有转换在浏览器中完成',
    noServerUpload: '无需上传服务器',
    readyToConvert: '准备转换 PDF',
    uploadToStart: '请先上传 PDF 文件以开始格式转换',
    tips: '💡 使用提示：',
    tipImage: 'PDF 转图片：支持 PNG 和 JPG 格式，可调整缩放比例和质量',
    tipText: 'PDF 转文本：自动提取 PDF 中的所有文本内容',
    tipHTML: 'PDF 转 HTML：生成包含文本和图片的 HTML 文件，可在浏览器中查看',
    tipPrivacy: '所有转换操作在本地浏览器中完成，不会上传文件到服务器，保护您的隐私',
  },
  chat: {
    title: 'AI智能聊天',
    subtitle: 'AI智能聊天助手',
    description: '与PDF对话，智能问答、总结、提取关键信息 - 让AI帮您快速理解文档内容',
  },
  ocr: {
    title: 'OCR识别',
    subtitle: 'OCR文字识别',
    description: '支持中文、手写、表格识别，识别后直接导出Word - 完全前端运行，保护隐私',
    startOCR: '开始OCR识别',
    processing: '正在识别中...',
    recognitionResult: '识别结果',
    text: '文本',
    table: '表格',
    stats: '统计',
    settings: '设置',
  },
  login: {
    welcomeBack: '欢迎回来',
    continueWith: '登录您的账户以继续使用 AIPDF Pro',
    noAccount: '还没有账户？',
    registerNow: '立即注册',
  },
  register: {
    createAccount: '创建账户',
    registerToUse: '注册新账户以开始使用 AIPDF Pro',
    haveAccount: '已有账户？',
    loginNow: '立即登录',
  },
  pdfTools: {
    merge: '合并PDF',
    mergeDesc: '将多个PDF合并为一个',
    split: '拆分PDF',
    splitDesc: '按页码范围拆分PDF',
    compress: '压缩PDF',
    compressDesc: '减小PDF文件大小',
    unlock: '解锁PDF',
    unlockDesc: '移除PDF密码保护',
    watermark: '添加水印',
    watermarkDesc: '为PDF添加文字水印',
    atLeast2Files: '至少需要2个PDF文件才能合并',
    invalidRange: '请输入有效的页码范围',
    enterPassword: '请输入PDF密码',
    enterWatermarkText: '请输入水印文字',
    watermarkSettings: '水印设置',
    watermarkText: '水印文字',
    rotationAngle: '旋转角度',
    rows: '行数',
    cols: '列数',
    opacity: '透明度',
    fontSize: '字体大小',
    applyAndDownload: '应用水印并下载',
    splitSettings: '拆分设置',
    pageRange: '页码范围',
    pageRangeExample: '例如: 1-5,6-10,11-15',
    pageRangeTip: '用逗号分隔多个范围，例如：1-5,6-10',
    splitAndDownload: '拆分并下载',
    compressSettings: '压缩设置',
    originalSize: '原始大小',
    compressedSize: '压缩后',
    compressionRatio: '压缩率',
    downloadCompressed: '下载压缩后的PDF',
    unlockSettings: '解锁设置',
    pdfPassword: 'PDF密码',
    unlockAndDownload: '解锁并下载',
    processing: '处理中...',
    mergeFailed: '合并失败',
    splitFailed: '拆分失败',
    compressFailed: '压缩失败',
    unlockFailed: '解锁失败',
    watermarkFailed: '添加水印失败',
    startCompress: '开始压缩',
    compressProgress: '压缩进度',
    compressComplete: '压缩完成！',
    reduce: '减少',
    compressTip: '💡 提示：PDF压缩效果取决于文件内容。包含大量图片的PDF压缩效果更明显。',
  },
  pdfConverter: {
    toImage: 'PDF 转图片',
    toImageDesc: '将 PDF 转换为 PNG 或 JPG 图片',
    toText: 'PDF 转文本',
    toTextDesc: '提取 PDF 中的文本内容',
    toHTML: 'PDF 转 HTML',
    toHTMLDesc: '将 PDF 转换为 HTML 网页',
    toWord: 'PDF 转 Word',
    toWordDesc: '精准还原 PDF 排版格式',
    imageSettings: '图片转换设置',
    imageFormat: '图片格式',
    scale: '缩放比例',
    lowQuality: '0.5x (低质量)',
    recommended: '2.0x (推荐)',
    highQuality: '3.0x (高质量)',
    jpegQuality: 'JPEG 质量',
    convertToImages: '转换为图片',
    converting: '转换中...',
    textExtraction: '文本提取',
    textExtractionDesc: '将提取 PDF 中的所有文本内容，保存为 TXT 文件。',
    convertToText: '转换为文本',
    htmlSettings: 'HTML 转换设置',
    includeImages: '包含图片',
    convertToHTML: '转换为 HTML',
    wordSettings: 'Word 转换设置',
    preserveFormatting: '保留格式',
    preserveLayout: '保留布局',
    preserveFormattingFull: '保持原始格式（字体、颜色、大小、粗体、斜体）',
    preserveLayoutFull: '保持原始布局（位置、间距、对齐方式）',
    convertToWord: '转换为 Word',
    convertSuccess: '转换成功！',
    imagesSuccess: '成功转换 {count} 张图片！',
    textSuccess: '文本转换成功！',
    htmlSuccess: 'HTML 转换成功！',
    wordSuccess: 'Word 转换成功！',
    convertFailed: '转换失败',
  },
  chatWithPDF: {
    uploadFirst: '请先上传PDF文件以开始AI聊天',
    aiAssistant: 'AI PDF助手',
    extracting: '正在提取PDF内容...',
    extractSuccess: '已成功提取PDF内容（共{pageCount}页）。您可以问我关于这份PDF的任何问题，比如："总结一下这份文档"、"第5页说了什么"、"提取关键信息"等。',
    extractFailed: '提取PDF文本失败：{error}。请确保PDF未加密或尝试其他文件。',
    askAnything: '问关于PDF的任何问题...',
    waitingExtract: '等待PDF内容提取...',
    tip: '💡 提示：可以问"总结这份文档"、"第X页说了什么"、"提取关键信息"等',
    serviceUnavailable: 'AI服务暂时不可用，请稍后重试',
    requestFailed: '请求失败 (状态码: {status})',
    error: '错误：{error}',
  },
  fileUploader: {
    dragOrClick: '拖拽PDF或图片文件到这里，或',
    clickToSelect: '点击选择文件',
    formats: '支持PDF、PNG、JPG等格式 • 完全前端处理 • 保护隐私',
    uploadedFiles: '已上传的文件',
    deleteFile: '删除文件',
  },
};

// 英文
const en: Translations = {
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    submit: 'Submit',
    search: 'Search',
    upload: 'Upload',
    download: 'Download',
  },
  nav: {
    home: 'Home',
    pdfViewer: 'PDF Viewer',
    pdfEditor: 'PDF Editor',
    pdfTools: 'PDF Tools',
    formatConversion: 'Format Conversion',
    aiChat: 'AI Chat',
    ocrRecognition: 'OCR Recognition',
    pricing: 'Pricing',
    security: 'Security',
    features: 'Features',
    aboutUs: 'About us',
    help: 'Help',
    language: 'Language',
  },
  auth: {
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    name: 'Name',
    forgotPassword: 'Forgot Password',
    resetPassword: 'Reset Password',
    emailVerified: 'Email Verified',
    emailNotVerified: 'Email Not Verified',
    loginSuccess: 'Login Successful',
    registerSuccess: 'Registration Successful',
    profile: 'Profile',
    personalCenter: 'Personal Center',
  },
  home: {
    title: 'Next-generation AI PDF Tools',
    subtitle: 'Free, Fast, Powerful - Merge, Split, Compress, Convert, Unlock, OCR, Smart Chat',
    privacyNote: 'Fully front-end operation, protecting your privacy',
    coreFeatures: 'Core Features',
    getStarted: 'Ready to get started?',
    ctaDescription: 'Choose a feature to get started. All operations are completed in the browser, fully protecting your privacy',
    startUsingTools: 'Start Using PDF Tools',
    tryAIChat: 'Try AI Chat',
    features: {
      pdfBasicOps: {
        title: 'PDF Basic Operations',
        desc: 'Merge, split, compress, unlock passwords, add watermarks - all running in the frontend',
      },
      pdfEditor: {
        title: 'PDF Editor',
        desc: 'Image/shape insertion, annotation marking, page management, form filling, signature adding',
      },
      formatConversion: {
        title: 'PDF Format Conversion',
        desc: 'Convert PDF to images, text, HTML with batch conversion support, fully local processing',
      },
      aiChat: {
        title: 'AI Smart Chat',
        desc: 'Chat with PDF, smart Q&A, summarize, extract key information',
      },
      ocr: {
        title: 'OCR Recognition',
        desc: 'Support Chinese, handwriting, table recognition, directly export to Word after recognition',
      },
    },
  },
  profile: {
    title: 'Profile',
    editProfile: 'Edit Profile',
    username: 'Username',
    birthDate: 'Birth Date',
    accountType: 'Account Type',
    emailStatus: 'Email Status',
    freeUser: 'Free User',
    premiumUser: 'Premium User',
    vipUser: 'VIP User',
    verified: 'Verified',
    notVerified: 'Not Verified',
    notSet: 'Not Set',
    backToHome: 'Back to Home',
  },
  pages: {
    backToHome: 'Back to Home',
    back: 'Back',
  },
  tools: {
    title: 'PDF Basic Operations',
    subtitle: 'PDF Basic Operations Tools',
    privacyNote: 'Fully local processing, protecting privacy',
    readyToProcess: 'Ready to Process PDF',
    uploadFile: 'Please upload PDF files to get started',
  },
  viewer: {
    title: 'PDF Viewer',
    description: 'Support PDF upload, zoom in/out, rotate, page navigation, full-text search, full-screen preview',
  },
  editor: {
    title: 'PDF Editor',
    description: 'Support image/shape insertion, annotation marking, page management, form filling, signature adding and more',
    uploadPDF: 'Upload PDF',
    editingTools: 'Editing Tools',
    operationHistory: 'Operation History',
    noOperations: 'No operations yet',
    previousPage: 'Previous',
    nextPage: 'Next',
    pageOf: 'Page {current} / {total}',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    addPage: 'Add Page',
    deletePage: 'Delete Page',
    savePDF: 'Save PDF',
    select: 'Select',
    image: 'Image',
    rectangle: 'Rectangle',
    circle: 'Circle',
    line: 'Line',
    highlight: 'Highlight',
    underline: 'Underline',
    textBox: 'Text Box',
    signature: 'Signature',
    uploadPDFFile: 'Please upload PDF file to start editing',
    clickToPlaceImage: 'Click PDF to place image',
    cancel: 'Cancel',
    imageProperties: 'Image Properties',
    rotationAngle: 'Rotation Angle (degrees)',
    degrees: 'degrees',
    opacity: 'Opacity',
    inputText: 'Input Text',
    enterTextContent: 'Enter text content...',
    confirm: 'Confirm',
    noEditsToSave: 'No edits to save',
    atLeastOnePage: 'At least one page must remain',
    imageRotationNote: 'Enter rotation angle (0-360 degrees), or click button to rotate 90° quickly',
  },
  convert: {
    title: 'PDF Format Conversion',
    subtitle: 'PDF Format Conversion Tool',
    privacyNote: 'Fully local processing, protecting privacy',
    description: 'Support PDF to image, text, HTML and other formats',
    browserOnly: 'All conversions are completed in the browser',
    noServerUpload: 'No need to upload to server',
    readyToConvert: 'Ready to Convert PDF',
    uploadToStart: 'Please upload PDF files first to start format conversion',
    tips: '💡 Usage Tips:',
    tipImage: '• PDF to Image: Supports PNG and JPG formats, adjustable scale and quality',
    tipText: '• PDF to Text: Automatically extracts all text content from PDF',
    tipHTML: '• PDF to HTML: Generates HTML file containing text and images, viewable in browser',
    tipPrivacy: '• All conversion operations are completed in the local browser, files are not uploaded to the server, protecting your privacy',
  },
  chat: {
    title: 'AI Smart Chat',
    subtitle: 'AI Smart Chat Assistant',
    description: 'Chat with PDF, smart Q&A, summarize, extract key information - Let AI help you quickly understand document content',
  },
  ocr: {
    title: 'OCR Recognition',
    subtitle: 'OCR Text Recognition',
    description: 'Support Chinese, handwriting, table recognition, directly export to Word after recognition - Fully front-end operation, protecting privacy',
    startOCR: 'Start OCR Recognition',
    processing: 'Recognizing...',
    recognitionResult: 'Recognition Result',
    text: 'Text',
    table: 'Table',
    stats: 'Statistics',
    settings: 'Settings',
  },
  login: {
    welcomeBack: 'Welcome Back',
    continueWith: 'Login to your account to continue using AIPDF Pro',
    noAccount: "Don't have an account?",
    registerNow: 'Register Now',
  },
  register: {
    createAccount: 'Create Account',
    registerToUse: 'Register a new account to start using AIPDF Pro',
    haveAccount: 'Already have an account?',
    loginNow: 'Login Now',
  },
  pdfTools: {
    merge: 'Merge PDF',
    mergeDesc: 'Merge multiple PDFs into one',
    split: 'Split PDF',
    splitDesc: 'Split PDF by page ranges',
    compress: 'Compress PDF',
    compressDesc: 'Reduce PDF file size',
    unlock: 'Unlock PDF',
    unlockDesc: 'Remove PDF password protection',
    watermark: 'Add Watermark',
    watermarkDesc: 'Add text watermark to PDF',
    atLeast2Files: 'At least 2 PDF files required for merging',
    invalidRange: 'Please enter valid page ranges',
    enterPassword: 'Please enter PDF password',
    enterWatermarkText: 'Please enter watermark text',
    watermarkSettings: 'Watermark Settings',
    watermarkText: 'Watermark Text',
    rotationAngle: 'Rotation Angle',
    rows: 'Rows',
    cols: 'Columns',
    opacity: 'Opacity',
    fontSize: 'Font Size',
    applyAndDownload: 'Apply Watermark & Download',
    splitSettings: 'Split Settings',
    pageRange: 'Page Range',
    pageRangeExample: 'e.g., 1-5,6-10,11-15',
    pageRangeTip: 'Separate multiple ranges with commas, e.g., 1-5,6-10',
    splitAndDownload: 'Split & Download',
    compressSettings: 'Compress Settings',
    originalSize: 'Original Size',
    compressedSize: 'Compressed',
    compressionRatio: 'Compression Ratio',
    downloadCompressed: 'Download Compressed PDF',
    unlockSettings: 'Unlock Settings',
    pdfPassword: 'PDF Password',
    unlockAndDownload: 'Unlock & Download',
    processing: 'Processing...',
    mergeFailed: 'Merge failed',
    splitFailed: 'Split failed',
    compressFailed: 'Compress failed',
    unlockFailed: 'Unlock failed',
    watermarkFailed: 'Add watermark failed',
    startCompress: 'Start Compress',
    compressProgress: 'Compress Progress',
    compressComplete: 'Compress Complete!',
    reduce: 'Reduced',
    compressTip: '💡 Tip: PDF compression effect depends on file content. PDFs with many images will have more obvious compression effects.',
  },
  pdfConverter: {
    toImage: 'PDF to Image',
    toImageDesc: 'Convert PDF to PNG or JPG images',
    toText: 'PDF to Text',
    toTextDesc: 'Extract text content from PDF',
    toHTML: 'PDF to HTML',
    toHTMLDesc: 'Convert PDF to HTML webpage',
    toWord: 'PDF to Word',
    toWordDesc: 'Accurately restore PDF layout format',
    imageSettings: 'Image Conversion Settings',
    imageFormat: 'Image Format',
    scale: 'Scale',
    lowQuality: '0.5x (Low Quality)',
    recommended: '2.0x (Recommended)',
    highQuality: '3.0x (High Quality)',
    jpegQuality: 'JPEG Quality',
    convertToImages: 'Convert to Images',
    converting: 'Converting...',
    textExtraction: 'Text Extraction',
    textExtractionDesc: 'All text content will be extracted from PDF and saved as TXT file.',
    convertToText: 'Convert to Text',
    htmlSettings: 'HTML Conversion Settings',
    includeImages: 'Include Images',
    convertToHTML: 'Convert to HTML',
    wordSettings: 'Word Conversion Settings',
    preserveFormatting: 'Preserve Formatting',
    preserveLayout: 'Preserve Layout',
    preserveFormattingFull: 'Preserve original formatting (font, color, size, bold, italic)',
    preserveLayoutFull: 'Preserve original layout (position, spacing, alignment)',
    convertToWord: 'Convert to Word',
    convertSuccess: 'Conversion successful!',
    imagesSuccess: 'Successfully converted {count} images!',
    textSuccess: 'Text conversion successful!',
    htmlSuccess: 'HTML conversion successful!',
    wordSuccess: 'Word conversion successful!',
    convertFailed: 'Conversion failed',
  },
  chatWithPDF: {
    uploadFirst: 'Please upload PDF files first to start AI chat',
    aiAssistant: 'AI PDF Assistant',
    extracting: 'Extracting PDF content...',
    extractSuccess: 'Successfully extracted PDF content ({pageCount} pages). You can ask me any questions about this PDF, such as: "Summarize this document", "What does page 5 say", "Extract key information", etc.',
    extractFailed: 'Failed to extract PDF text: {error}. Please ensure the PDF is not encrypted or try another file.',
    askAnything: 'Ask anything about the PDF...',
    waitingExtract: 'Waiting for PDF content extraction...',
    tip: '💡 Tip: You can ask "Summarize this document", "What does page X say", "Extract key information", etc.',
    serviceUnavailable: 'AI service is temporarily unavailable, please try again later',
    requestFailed: 'Request failed (Status: {status})',
    error: 'Error: {error}',
  },
  fileUploader: {
    dragOrClick: 'Drag PDF or image files here, or',
    clickToSelect: 'click to select files',
    formats: 'Supports PDF, PNG, JPG and other formats • Fully client-side processing • Protect privacy',
    uploadedFiles: 'Uploaded Files',
    deleteFile: 'Delete file',
  },
};

// 其他语言（暂时使用英文作为占位符，后续可以补充）
const translations: Record<Locale, Translations> = {
  zh,
  en,
  'zh-TW': zh, // 繁体中文暂时使用简体
  es: en, // 西班牙语暂时使用英文
  fr: en, // 法语暂时使用英文
  de: en, // 德语暂时使用英文
  it: en, // 意大利语暂时使用英文
  pt: en, // 葡萄牙语暂时使用英文
  ja: en, // 日语暂时使用英文
  ru: en, // 俄语暂时使用英文
  ko: en, // 韩语暂时使用英文
  ar: en, // 阿拉伯语暂时使用英文
};

export default translations;

// 语言列表
export const languages: Array<{ code: Locale; name: string; nativeName: string }> = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文 (简体)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '中文 (繁體)' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
];

