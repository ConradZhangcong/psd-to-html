# PSD to HTML 自动化转换工具

## 功能

- 解析 PSD 文件，自动生成静态 HTML 页面
- 导出图层图片资源（PNG 格式）
- 提取字体元数据（fonts_usage.json）

## 安装

```bash
npm install
```

## 使用方法

```bash
# 使用 tsx 直接运行（开发）
npm run dev -- <path-to-psd-file>

# 或先编译再运行（生产）
npm run build
node dist/index.js <path-to-psd-file>
```

示例：
```bash
npm run dev -- ./design.psd
```

## 输出结构

```
/dist
  ├── index.html         # 还原后的静态页面
  ├── fonts_usage.json   # 字体信息统计
  └── images/            # 导出的图层切图
      ├── design_layer_1.png
      └── ...
```

## 技术栈

- Node.js (TypeScript / ESM)
- ag-psd - PSD 文件解析
- sharp - 图像处理
- fs-extra - 文件操作

## 已知问题

- [ ] 字体宽度计算不准确，相同的宽度在html中文本宽度超过标签宽度导致自动换行
- [ ] line-height 计算不准确

## 待办 / 可扩展方向

- [ ] 支持 WebP 格式输出（目前仅 PNG）
- [ ] 支持图层圆角、阴影等 CSS 效果
- [ ] 添加 CLI 参数解析（输出目录、图片格式等）
- [ ] 大型 PSD 的内存优化（流式处理或分块）
- [ ] 字体回退机制（WebFont 自动生成/链接）
