import type { LayerInfo, FontInfo, ConversionResult } from './types.js';

function colorToCss(color: { r: number; g: number; b: number; a: number }): string {
  const { r, g, b, a } = color;
  if (a < 1) {
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
  }
  return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
}

function generateLayerHtml(layer: LayerInfo, indent: string = '  '): string {
  if (!layer.visible) return '';

  const style: string[] = [];

  style.push(`position: absolute`);
  style.push(`left: ${layer.left}px`);
  style.push(`top: ${layer.top}px`);

  if (layer.width > 0) style.push(`width: ${layer.width}px`);
  if (layer.height > 0) style.push(`height: ${layer.height}px`);

  if (layer.opacity < 1) {
    style.push(`opacity: ${layer.opacity}`);
  }

  if (layer.type === 'text' && layer.text) {
    const { text } = layer;
    style.push(`font-family: "${text.fontName}", sans-serif`);
    style.push(`font-size: ${text.fontSize}px`);
    style.push(`color: ${colorToCss(text.color)}`);
    style.push(`line-height: 1.2`);

    if (text.alignment) {
      style.push(`text-align: ${text.alignment}`);
    }
  }

  if (layer.type === 'image' && layer.imagePath) {
    return `${indent}<img src="${layer.imagePath}" alt="${layer.name}" style="${style.join('; ')}" />\n`;
  }

  let inner = '';
  if (layer.type === 'text' && layer.text) {
    inner = layer.text.content;
  }

  if (layer.children && layer.children.length > 0) {
    const childrenHtml = layer.children
      .map(child => generateLayerHtml(child, indent + '  '))
      .filter(Boolean)
      .join('');
    inner += `\n${childrenHtml}${indent}`;
  }

  const tag = layer.type === 'text' ? 'span' : 'div';
  return `${indent}<${tag} style="${style.join('; ')}">${inner}</${tag}>\n`;
}

export function generateHtml(
  layers: LayerInfo[],
  psdWidth: number,
  psdHeight: number,
  fontsUsage: FontInfo[]
): string {
  const bodyContent = layers
    .map(layer => generateLayerHtml(layer))
    .filter(Boolean)
    .join('');

  const fontsCss = fontsUsage
    .map(f => `/* Font: ${f.postScriptName} (${f.fontName}) - fontSize: ${f.fontSize}px */`)
    .join('\n  ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PSD to HTML Output</title>
  <style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: sans-serif; }
  .psd-container {
    position: relative;
    width: ${psdWidth}px;
    height: ${psdHeight}px;
    margin: 0 auto;
  }
  ${fontsCss ? `\n  /* Fonts used in this PSD */\n  ${fontsCss}\n  ` : ''}
  </style>
</head>
<body>
  <div class="psd-container">
${bodyContent}
  </div>
</body>
</html>`;
}

export function generateFontsUsage(fonts: FontInfo[]): string {
  const unique = new Map<string, FontInfo>();
  for (const f of fonts) {
    const key = `${f.postScriptName}_${f.fontSize}`;
    if (!unique.has(key)) {
      unique.set(key, { ...f });
    }
  }
  return JSON.stringify(Array.from(unique.values()), null, 2);
}
