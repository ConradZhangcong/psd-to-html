import type { LayerInfo, FontInfo, TextSegment } from './types.js';

function escapeHtmlAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtmlContent(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r\n?|\n/g, '<br>');
}

function colorToCss(color: { r: number; g: number; b: number; a: number }): string {
  const { r, g, b, a } = color;
  if (a < 1) {
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
  }
  return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
}

function renderSegments(segments: TextSegment[], scale: number): string {
  return segments
    .map(seg => {
      const style = [
        `font-family: '${seg.fontName}', sans-serif`,
        `font-size: ${Math.round(seg.fontSize * scale)}px`,
        `color: ${colorToCss(seg.color)}`,
      ].join('; ');
      return `<span style="${style}">${escapeHtmlContent(seg.text)}</span>`;
    })
    .join('');
}

function generateLayerHtml(layer: LayerInfo, indent: string = '  ', scale: number = 1): string {
  if (!layer.visible) return '';

  const style: string[] = [];

  style.push(`position: absolute`);
  style.push(`left: ${Math.round(layer.left * scale)}px`);
  style.push(`top: ${Math.round(layer.top * scale)}px`);

  if (layer.width > 0) style.push(`width: ${Math.round(layer.width * scale)}px`);
  if (layer.height > 0) style.push(`height: ${Math.round(layer.height * scale)}px`);

  if (layer.opacity < 1) {
    style.push(`opacity: ${layer.opacity}`);
  }

  if (layer.type === 'text' && layer.text) {
    const { text } = layer;
    style.push(`font-family: '${text.fontName}', sans-serif`);
    style.push(`font-size: ${Math.round(text.fontSize * scale)}px`);
    style.push(`color: ${colorToCss(text.color)}`);
    style.push(`line-height: 1.2`);

    if (text.alignment) {
      style.push(`text-align: ${text.alignment}`);
    }

    if (text.segments && text.segments.length > 1) {
      const inner = renderSegments(text.segments, scale);
      return `${indent}<div style="${style.join('; ')}">${inner}</div>\n`;
    }
  }

  if (layer.type === 'image' && layer.imagePath) {
    return `${indent}<img src="${layer.imagePath}" alt="${escapeHtmlAttr(layer.name)}" style="${style.join('; ')}" />\n`;
  }

  let inner = '';
  if (layer.type === 'text' && layer.text) {
    inner = escapeHtmlContent(layer.text.content);
  }

  if (layer.children && layer.children.length > 0) {
    const childrenHtml = layer.children
      .map(child => generateLayerHtml(child, indent + '  ', scale))
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
  fontsUsage: FontInfo[],
  psdPpi = 72
): string {
  const scale = 96 / psdPpi;
  const scaledWidth = Math.round(psdWidth * scale);
  const scaledHeight = Math.round(psdHeight * scale);

  const bodyContent = layers
    .map(layer => generateLayerHtml(layer, '  ', scale))
    .filter(Boolean)
    .join('');

  const fontList = [...new Set(fontsUsage.map(f => f.fontName))].join(', ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PSD to HTML Output</title>
  <style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: ${fontList || 'sans-serif'}; }
  .psd-container {
    position: relative;
    width: ${scaledWidth}px;
    height: ${scaledHeight}px;
    margin: 0 auto;
  }
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
  const seen = new Set<string>();
  const unique: FontInfo[] = [];
  for (const f of fonts) {
    if (!seen.has(f.fontName)) {
      seen.add(f.fontName);
      unique.push({ fontName: f.fontName, postScriptName: f.postScriptName });
    }
  }
  return JSON.stringify(unique, null, 2);
}
