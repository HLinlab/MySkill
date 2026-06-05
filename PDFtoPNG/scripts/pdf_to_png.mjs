/**
 * PDF to PNG Converter - 多级画质/DPI支持
 * 
 * 用法:
 *   node pdf_to_png.mjs <pdf路径> [选项]
 * 
 * 选项:
 *   --quality low|medium|high|original    画质级别 (默认: high)
 *   --dpi <数字>                         直接指定DPI（覆盖--quality）
 *   --out <目录>                         输出目录 (默认: PDF所在目录)
 * 
 * 画质映射:
 *   low      -> 150 DPI  (快速预览, 文件小)
 *   medium   -> 300 DPI  (标准画质, 适合多数场景)
 *   high     -> 长边缩放到3840px (匹配4K显示屏)
 *   original -> 300 DPI  (PDF原始幅面尺寸, 最高细节)
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── 参数解析 ───────────────────────────────────────────
const args = process.argv.slice(2);
let pdfPath = '';
let quality = 'high';
let dpiOverride = null;
let outDir = '';

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--quality' && args[i + 1]) {
    quality = args[++i].toLowerCase();
    if (!['low', 'medium', 'high', 'original'].includes(quality)) {
      console.error('错误: --quality 必须是 low|medium|high|original');
      process.exit(1);
    }
  } else if (a === '--dpi' && args[i + 1]) {
    dpiOverride = parseInt(args[++i], 10);
    if (isNaN(dpiOverride) || dpiOverride < 36 || dpiOverride > 2400) {
      console.error('错误: --dpi 必须是 36~2400 之间的数字');
      process.exit(1);
    }
  } else if (a === '--out' && args[i + 1]) {
    outDir = args[++i];
  } else if (!pdfPath && !a.startsWith('--')) {
    pdfPath = a;
  }
}

if (!pdfPath) {
  console.error('用法: node pdf_to_png.mjs <pdf路径> [--quality low|medium|high|original] [--dpi <数字>] [--out <目录>]');
  console.error('');
  console.error('画质级别:');
  console.error('  low      - 150 DPI  (快速预览)');
  console.error('  medium   - 300 DPI  (标准画质)');
  console.error('  high     - 适配4K屏幕 (长边3840px, 默认)');
  console.error('  original - 原画质 (PDF幅面×300 DPI)');
  console.error('');
  console.error('示例:');
  console.error('  node pdf_to_png.mjs 图纸.pdf --quality high');
  console.error('  node pdf_to_png.mjs 报告.pdf --dpi 600');
  console.error('  node pdf_to_png.mjs 文档.pdf --quality low --out ./output');
  process.exit(0);
}

if (!outDir) outDir = path.dirname(pdfPath);

// ─── DPI 计算逻辑 ────────────────────────────────────────
const SCREEN_LONG_EDGE = 3840; // 4K 显示屏长边像素

function computeRenderDpi(pdfPageWidthPt, pdfPageHeightPt) {
  // 如果用户指定了 --dpi，直接使用
  if (dpiOverride !== null) return dpiOverride;

  switch (quality) {
    case 'low':
      return 150;
    case 'medium':
      return 300;
    case 'high': {
      // 将PDF长边缩放到屏幕分辨率
      const pdfLong = Math.max(pdfPageWidthPt, pdfPageHeightPt);
      return Math.round((SCREEN_LONG_EDGE / pdfLong) * 72);
    }
    case 'original':
      return 300; // PDF幅面×300 DPI = 最大细节
    default:
      return 300;
  }
}

// ─── 主流程 ──────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  PDF to PNG Converter (MuPDF + Sharp)');
  console.log('═══════════════════════════════════════════');
  console.log('PDF:     ' + pdfPath);
  console.log('画质:    ' + quality + (dpiOverride ? ' (覆盖DPI: ' + dpiOverride + ')' : ''));
  console.log('输出:    ' + outDir);

  // 动态导入 mupdf (ESM)
  const mupdf = await import('mupdf');
  const baseName = path.basename(pdfPath, '.pdf');

  // 读取并打开PDF
  const data = await fs.readFile(pdfPath);
  const doc = mupdf.Document.openDocument(data, 'application/pdf');
  const numPages = doc.countPages();
  console.log('页数:    ' + numPages);

  for (let pi = 0; pi < numPages; pi++) {
    const page = doc.loadPage(pi);
    const bounds = page.getBounds();
    const pageW = bounds[2] - bounds[0]; // PDF点单位 (1/72 inch)
    const pageH = bounds[3] - bounds[1];

    const targetDpi = computeRenderDpi(pageW, pageH);
    const targetScale = targetDpi / 72;
    const targetW = Math.round(pageW * targetScale);
    const targetH = Math.round(pageH * targetScale);

    console.log('\n── 第' + (pi + 1) + '/' + numPages + '页 ──');
    console.log('  PDF尺寸: ' + pageW.toFixed(0) + '×' + pageH.toFixed(0) + ' pt');
    console.log('  目标DPI: ' + targetDpi + ' → ' + targetW + '×' + targetH + ' px');

    // 策略：renderDpi ≤ 300 直接MuPDF渲染；> 300 则先300再Lanczos3放大
    const RENDER_DPI = Math.min(targetDpi, 300);
    const renderScale = RENDER_DPI / 72;

    console.log('  渲染DPI: ' + RENDER_DPI + ' (MuPDF)');
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(renderScale, renderScale),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true
    );

    let pngBuffer = pixmap.asPNG();
    const baseW = pixmap.getWidth();
    const baseH = pixmap.getHeight();
    console.log('  渲染结果: ' + baseW + '×' + baseH + ' px, ' + (pngBuffer.length / 1024).toFixed(0) + ' KB');

    // 如果需要放大（目标DPI > 渲染DPI）
    if (targetDpi > RENDER_DPI) {
      const upscale = targetDpi / RENDER_DPI;
      const upW = Math.round(baseW * upscale);
      const upH = Math.round(baseH * upscale);
      console.log('  Lanczos3放大: ' + upscale.toFixed(2) + '× → ' + upW + '×' + upH + ' px');

      pngBuffer = await sharp(pngBuffer, { limitInputPixels: false })
        .resize(upW, upH, {
          kernel: 'lanczos3',
          fit: 'fill',
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
    } else if (RENDER_DPI > targetDpi) {
      // 需要缩小（目标DPI < 渲染DPI）
      console.log('  缩小至目标DPI...');
      pngBuffer = await sharp(pngBuffer, { limitInputPixels: false })
        .resize(targetW, targetH, {
          kernel: 'lanczos3',
          fit: 'fill',
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
    }

    // 输出文件
    let outPath;
    if (numPages === 1) {
      outPath = path.join(outDir, baseName + '.png');
    } else {
      const ps = String(pi + 1).padStart(String(numPages).length, '0');
      outPath = path.join(outDir, baseName + '_第' + ps + '页.png');
    }

    await fs.writeFile(outPath, pngBuffer);
    const meta = await sharp(pngBuffer, { limitInputPixels: false }).metadata();
    const sizeKB = (pngBuffer.length / 1024).toFixed(0);
    const sizeMB = (pngBuffer.length / 1024 / 1024);
    const sizeStr = sizeMB >= 1 ? sizeMB.toFixed(1) + ' MB' : sizeKB + ' KB';
    console.log('  ✓ 输出: ' + outPath);
    console.log('    分辨率: ' + meta.width + '×' + meta.height + ' px, ' + sizeStr);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  全部完成！共处理 ' + numPages + ' 页');
  console.log('═══════════════════════════════════════════');
}

main().catch(err => {
  console.error('\n❌ 错误:', err.message || err);
  if (err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
});
