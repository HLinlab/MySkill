---
name: pdf-to-png
description: "将 PDF 文件转换为高质量 PNG 图片。支持四级画质（低/中/高/原画质）和自定义 DPI。使用 MuPDF 渲染引擎确保字体和矢量内容完整呈现，配合 Sharp 的 Lanczos3 算法进行高质量缩放。适用于专利图纸、工程图纸、技术文档等需要高保真转换的场景。This skill should be used when converting PDF to PNG images, especially for engineering drawings, patent figures, or technical documents where rendering fidelity is critical."
agent_created: true
---

# PDFtoPNG - PDF 转高清 PNG

## 概述

将 PDF 文件转换为 PNG 图片格式。使用 **MuPDF** 专业渲染引擎确保字体和矢量内容不丢失（避免 pdfjs-dist 在 Node.js 下渲染工程图纸时内容空白的已知缺陷），结合 **Sharp (libvips)** 的 Lanczos3 算法处理超采样缩放。

## 何时使用

- 用户要求将 PDF 转换为图片（PNG/JPG）
- 用户提到"PDF转图片"、"导出图片"、"PDF截图"
- 专利图纸、CAD 工程图、技术文档的高保真转换
- 需要控制输出分辨率（DPI）或图片尺寸的场景

## 画质级别

| 级别 | 命令 | DPI | 说明 | 适用场景 |
|------|------|-----|------|----------|
| **低画质** | `--quality low` | 150 DPI | 快速预览，文件小 | 快速查看、缩略图 |
| **中画质** | `--quality medium` | 300 DPI | 标准画质 | 一般文档、报告 |
| **高画质** | `--quality high` | 长边3840px | 适配4K屏幕（默认） | 屏幕展示、专利图纸 |
| **原画质** | `--quality original` | 300 DPI | PDF原始幅面 | 图纸打印、存档 |
| **自定义** | `--dpi N` | 任意值 | 直接指定DPI | 精确控制分辨率 |

## 快速开始

### 环境要求

脚本依赖以下 npm 包（须提前安装）：

```bash
npm install mupdf sharp canvas
```

- **mupdf**: MuPDF WASM 版本，PDF 渲染引擎
- **sharp**: libvips 绑定，高质量图像缩放（Lanczos3）
- **canvas**: Node.js Canvas 实现（mupdf 内部依赖）

### 基本用法

```bash
# 默认高画质（长边3840px）
node scripts/pdf_to_png.mjs 图纸.pdf

# 指定画质级别
node scripts/pdf_to_png.mjs 图纸.pdf --quality low
node scripts/pdf_to_png.mjs 图纸.pdf --quality medium
node scripts/pdf_to_png.mjs 图纸.pdf --quality high
node scripts/pdf_to_png.mjs 图纸.pdf --quality original

# 自定义 DPI（覆盖画质设置）
node scripts/pdf_to_png.mjs 图纸.pdf --dpi 600
node scripts/pdf_to_png.mjs 图纸.pdf --dpi 150

# 指定输出目录
node scripts/pdf_to_png.mjs 图纸.pdf --quality original --out ./output

# 完整参数
node scripts/pdf_to_png.mjs PDF文件路径 [--quality low|medium|high|original] [--dpi 数字] [--out 目录]
```

### 输出规则

- 单页 PDF → `原文件名.png`
- 多页 PDF → `原文件名_第01页.png`、`原文件名_第02页.png`...
- 默认输出到 PDF 所在目录

## 技术实现

### 渲染管线

```
PDF 文件
  ↓ MuPDF (渲染引擎, 字体/矢量完整)
基础位图 (≤300 DPI)
  ↓ Sharp + Lanczos3 (高质量缩放)
目标分辨率 PNG
```

### 关键技术决策

1. **渲染引擎选型: MuPDF (优于 pdfjs-dist)**
   - pdfjs-dist 在 Node.js 环境下渲染工程图纸时，字体和矢量内容可能不完整，导致输出空白
   - MuPDF 是工业级 PDF 渲染器，完整支持所有字体、矢量路径和透明度

2. **高 DPI 策略: 分步渲染 + Lanczos3 放大**
   - MuPDF WASM 版本存在约 1.67GB 内存分配上限
   - 对于超过 300 DPI 的输出，先以 300 DPI 精准渲染，再用 Lanczos3 算法放大
   - Lanczos3 对工程图纸的线条和文字几乎无损

3. **输出格式: PNG 无损压缩**
   - compressionLevel: 9（最大无损压缩）
   - 保证像素级还原，同时控制文件大小

### 内存注意事项

- 300 DPI 及以下：直接 MuPDF 渲染，内存占用稳定
- 超过300 DPI：采用分步放大策略，避免 WASM 内存溢出
- 超大幅面 PDF（如 A0 工程图）：原画质模式输出可能达数万像素，需要足够内存

## 常见问题

**Q: 为什么原画质不用 600 DPI？**
A: MuPDF WASM 的内存限制导致 600 DPI 直接渲染会失败。如需 600 DPI，使用 `--dpi 600`，脚本会自动使用 300→600 Lanczos3 放大策略，质量与原生几乎无差异。

**Q: 输出 PNG 文件很大怎么办？**
A: PNG 无损压缩已启用最高级别。如需更小体积，可通过 sharp 转 JPG（有损）或降低 DPI。

**Q: 支持多页 PDF 吗？**
A: 支持，自动为每页生成独立的 PNG 文件，按页码命名。
