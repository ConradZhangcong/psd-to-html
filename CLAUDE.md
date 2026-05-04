# PSD to HTML 自动化转换工具

## 项目概述

解析 PSD 文件，自动生成静态 HTML 页面、导出图层图片资源（PNG）和字体元数据。

## 技术栈

- **语言**: TypeScript (ESM, Node16 moduleResolution)
- **PSD 解析**: `psd.js` (v3.4.0) — 注意：原需求文档使用 ag-psd，实际实现已切换为 psd.js
- **图像处理**: `sharp` (v0.34.5) — 将图层像素数据转换为 PNG
- **文件操作**: `fs-extra`
- **运行器**: `tsx` — 支持直接运行 TypeScript

## 常用命令

```bash
npm install          # 安装依赖
npm run dev -- <psd> # 开发运行（tsx 直接执行）
npm run build        # 编译 TypeScript -> dist/
node dist/index.js <psd> # 生产运行
```

## 项目结构

```
src/
  index.ts           # 入口：解析参数、编排流程
  psd-parser.ts      # PSD 解析：提取图层、文本段落、字体信息
  html-generator.ts   # HTML 生成：绝对定位布局、内联样式
  image-exporter.ts   # 图片导出：sharp 处理图层图像
  types.ts           # 类型定义：LayerInfo, FontInfo, TextSegment
output/
  {psdName}/         # 每个 PSD 独立输出目录
    index.html       # 生成的 HTML
    fonts_usage.json # 字体列表（去重）
    images/          # 图层切图 (*.png)
```

## 核心设计

### PSD 解析 (psd-parser.ts)

- 使用 `psd.js` 的 `PSD.fromFile()` + `psd.parse()`
- 读取 PSD 实际分辨率：`resolutionInfo` 资源中的 `h_res`（如 150 PPI）
- **坐标缩放**: `scale = 96 / psdPpi`（屏幕 96 DPI ÷ PSD 的 PPI）
- **图层顺序**: PSD 树状结构需 `.reverse()` 以匹配视觉顺序
- **文本段落**: `extractTextSegments()` 解析多格式文本（不同字体/大小/颜色）

### HTML 生成 (html-generator.ts)

- **布局**: 绝对定位，`left/top/width/height` 全部应用 scale
- **文本处理**:
  - 单一格式：直接输出 `<span>` 或 `<div>`
  - 多格式：`renderSegments()` 为每个段落生成独立 `<span>`
  - 换行：`.replace(/\r\n?|\n/g, '<br>')`
- **HTML 转义**:
  - 属性值用 `escapeHtmlAttr()`（双引号转 `&quot;`）
  - 内容用 `escapeHtmlContent()`（含换行转换）
  - `font-family` 使用单引号避免与 HTML 属性双引号冲突
- **图片图层**: 直接输出 `<img>` 标签

### 图片导出 (image-exporter.ts)

- 图层原始数据通过 `layer.toPng()` 获取
- 使用 `sharp` 处理并保存为 PNG
- 输出路径: `output/{psdName}/images/`

## 重要约定

1. **输出目录隔离**: 每个 PSD 文件生成独立目录 `output/{psdName}/`，避免覆盖
2. **字体去重**: `fonts_usage.json` 只保留唯一 `fontName`，用于后续 WebFont 补全
3. **图层可见性**: `visible === false` 的图层跳过不输出
4. **透明度**: `opacity < 1` 时输出 CSS `opacity` 属性
5. **PSD 分辨率**: 必须从 PSD 元数据中读取实际 PPI，不能用固定值（如 72 或 96）

## 已知问题与修复记录

| 问题 | 原因 | 修复 |
|------|------|------|
| style 属性中双引号导致 HTML 解析错误 | `font-family: "XXX"` 与属性双引号冲突 | 改用单引号：`font-family: 'XXX'` |
| 图层顺序颠倒 | PSD 树顺序与视觉顺序相反 | 解析时 `.reverse()` |
| 字体大小比例错误 | 使用固定 96/72 转换 | 读取 PSD 实际 PPI，动态计算 scale |
| 文本换行不显示 | `\r\n` 未转换为 `<br>` | `escapeHtmlContent()` 处理换行 |
| 同图层多格式文本 | 只读取第一段格式 | `extractTextSegments()` + `renderSegments()` |
