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
