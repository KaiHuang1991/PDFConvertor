const fs = require('fs');
const path = require('path');

// 复制pdfjs-dist的worker文件到public目录
const sourcePath = path.join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const destPath = path.join(__dirname, '../public/pdf.worker.min.mjs');

if (fs.existsSync(sourcePath)) {
  fs.copyFileSync(sourcePath, destPath);
  console.log('✅ PDF worker文件已复制到public目录');
} else {
  console.warn('⚠️ 未找到worker文件，将使用CDN备用方案');
}


