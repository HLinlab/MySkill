# MySkill - 个人技能工具箱

存放 WorkBuddy AI 助手的自定义技能（Skills），可在不同电脑间同步使用。

---

## PDFtoPNG - PDF 转高清 PNG

将 PDF 文件转换为高质量 PNG 图片，支持四级画质和自定义 DPI。

### 安装

1. 将 PDFtoPNG 文件夹复制到 ~/.workbuddy/skills/ 目录下
2. 确保已安装 Node.js 环境
3. 在 WorkBuddy 工作区安装依赖：

```bash
npm install mupdf sharp canvas
```

### 使用方法

在 WorkBuddy 中直接对话即可触发，例如：
- 把这个 PDF 转成高清图片
- 导出 PDF 为 PNG，用原画质
- 图纸.pdf 转成 600 DPI 的图片

命令行直接调用：
```bash
cd ~/.workbuddy/skills/pdf-to-png
node scripts/pdf_to_png.mjs 文件.pdf --quality high
```

### 画质级别

| 级别 | DPI | 适用场景 |
|------|-----|----------|
| low | 150 | 快速预览 |
| medium | 300 | 标准画质 |
| high | 4K屏幕（默认） | 屏幕展示、专利图纸 |
| original | 300 | PDF原始幅面 |

### 自定义 DPI

```bash
node scripts/pdf_to_png.mjs 文件.pdf --dpi 600
```

### 技术栈

- MuPDF - PDF 渲染引擎
- Sharp (libvips) - Lanczos3 高质量缩放

---

## 技能列表

| 技能 | 说明 | 版本 |
|------|------|------|
| PDFtoPNG | PDF转高清PNG图片（默认high画质） | v1.1 |
