import PSD from 'psd';
import type { LayerInfo, FontInfo } from './types.js';

let layerCounter = 0;
let psdPpi = 72; // default PPI

function ptToPx(pt: number): number {
  // Convert pt to px based on PSD's actual PPI: 1pt = PPI/72 px
  return Math.round(pt * psdPpi / 72);
}

function extractTextSegments(textData: any): Array<{
  text: string;
  fontName: string;
  fontSize: number;
  color: { r: number; g: number; b: number; a: number };
  alignment: string;
  letterSpacing?: number;
  lineHeight?: number;
}> {
  const value = textData.value || '';
  const font = textData.font || {};

  const names = font.names || [];
  const sizes = font.sizes || [];
  const colors = font.colors || [];
  const lengthArray = font.lengthArray || [];
  const letterSpacings = font.letterSpacing || [];
  const leadings = font.leading || [];

  // Convert PSD leading (pt) to CSS unitless line-height
  // In PSD, leading = 0 or negative means "auto leading" (typically ~120% of font size)
  // For wrapped text, use the ratio of leading to font size as unitless line-height
  const leadingToLineHeight = (leadingPt: number, fontSizePt: number): number | undefined => {
    if (leadingPt == null || fontSizePt == null || fontSizePt <= 0) return undefined;

    // PSD auto-leading: 0 or negative value means "auto" (use default)
    if (leadingPt <= 0) return undefined;

    // Ratio of leading to font size gives the unitless line-height
    // e.g., leading=20pt, fontSize=16pt → line-height = 20/16 = 1.25
    const ratio = leadingPt / fontSizePt;

    // Sanity check: reasonable line-height range is 0.8 to 3.0
    // Values outside this range are likely incorrect PSD data
    if (ratio < 0.8 || ratio > 3.0) return undefined;

    return Math.round(ratio * 100) / 100;
  };

  // If no rich text segments, return single segment
  if (lengthArray.length <= 1) {
    const fontName = names[0] || 'Arial';
    const fontSize = ptToPx(sizes[0] || 16);
    const fontSizePt = sizes[0] || 16;
    let color = { r: 0, g: 0, b: 0, a: 1 };
    if (colors[0]) {
      color = {
        r: (colors[0][0] ?? 0) / 255,
        g: (colors[0][1] ?? 0) / 255,
        b: (colors[0][2] ?? 0) / 255,
        a: (colors[0][3] ?? 255) / 255,
      };
    }

    // letter-spacing: PSD uses em units, convert to px
    let letterSpacing: number | undefined = undefined;
    if (letterSpacings[0] != null && letterSpacings[0] !== 0) {
      letterSpacing = Math.round(letterSpacings[0] * fontSize * 100) / 100;
    }

    // line-height from leading
    let lineHeight: number | undefined = undefined;
    if (leadings[0] != null) {
      lineHeight = leadingToLineHeight(leadings[0], fontSizePt);
    }

    const alignmentMap: Record<string, string> = {
      'left': 'left', 'center': 'center', 'right': 'right', 'justify': 'justify',
    };
    const rawAlign = font.alignment?.[0] || 'left';

    return [{
      text: value,
      fontName,
      fontSize,
      color,
      alignment: alignmentMap[rawAlign] || String(rawAlign || 'left'),
      letterSpacing,
      lineHeight,
    }];
  }

  // Parse rich text segments based on lengthArray
  const segments: Array<{
    text: string;
    fontName: string;
    fontSize: number;
    color: { r: number; g: number; b: number; a: number };
    alignment: string;
    letterSpacing?: number;
    lineHeight?: number;
  }> = [];

  let offset = 0;
  for (let i = 0; i < lengthArray.length; i++) {
    const len = lengthArray[i];
    const segmentText = value.substring(offset, offset + len);
    offset += len;

    const fontName = names[i] || names[0] || 'Arial';
    const fontSize = ptToPx(sizes[i] || sizes[0] || 16);
    const fontSizePt = sizes[i] || sizes[0] || 16;
    let color = { r: 0, g: 0, b: 0, a: 1 };
    if (colors[i]) {
      color = {
        r: (colors[i][0] ?? 0) / 255,
        g: (colors[i][1] ?? 0) / 255,
        b: (colors[i][2] ?? 0) / 255,
        a: (colors[i][3] ?? 255) / 255,
      };
    }

    // letter-spacing
    let letterSpacing: number | undefined = undefined;
    const ls = letterSpacings[i] ?? letterSpacings[0];
    if (ls != null && ls !== 0) {
      letterSpacing = Math.round(ls * fontSize * 100) / 100;
    }

    // line-height
    let lineHeight: number | undefined = undefined;
    const leading = leadings[i] ?? leadings[0];
    if (leading != null) {
      lineHeight = leadingToLineHeight(leading, fontSizePt);
    }

    const alignmentMap: Record<string, string> = {
      'left': 'left', 'center': 'center', 'right': 'right', 'justify': 'justify',
    };
    const rawAlign = font.alignment?.[i] || font.alignment?.[0] || 'left';

    segments.push({
      text: segmentText,
      fontName,
      fontSize,
      color,
      alignment: alignmentMap[rawAlign] || String(rawAlign || 'left'),
      letterSpacing,
      lineHeight,
    });
  }

  return segments;
}

function processLayer(layer: any, fonts: FontInfo[]): LayerInfo | null {
  if (!layer) return null;

  const index = layerCounter++;
  const name = layer.name || `Layer ${index}`;
  const exported = layer.export?.();
  const textData = exported?.text;
  const isTextLayer = !!textData;
  const isGroup = layer.type === 'group';

  const top = layer.top || 0;
  const left = layer.left || 0;
  const bottom = layer.bottom || 0;
  const right = layer.right || 0;
  let width = (right - left) || (layer.width || 0);
  let height = (bottom - top) || (layer.height || 0);

  const opacity = layer.opacity !== undefined ? layer.opacity / 255 : 1;
  const visible = layer.visible !== false;

  if (isTextLayer) {
    // For text layers, use the larger value between PSD bbox and rendered pixels
    try {
      const png = layer.toPng();
      if (png?.width && png?.height) {
        width = Math.max(width, png.width);
        height = Math.max(height, png.height);
      }
    } catch {
      // Ignore if toPng fails for text layers
    }
    // Add padding to account for font rendering differences
    width = Math.round(width) + 20;
  }

  const layerInfo: LayerInfo = {
    id: `layer_${index}`,
    index,
    name,
    type: isTextLayer ? 'text' : isGroup ? 'group' : 'image',
    left,
    top,
    width,
    height,
    opacity,
    visible,
  };

  if (isTextLayer && textData) {
    const segments = extractTextSegments(textData);
    if (segments.length > 0) {
      // Use first segment for layer-level text info
      const primary = segments[0];
      let lineHeight = primary.lineHeight;

      // For wrapped text (multi-line), improve line-height calculation
      // If text contains newlines or the layer width suggests wrapping,
      // estimate line-height from actual rendered height when PSD leading is unavailable
      if (lineHeight == null && height > 0 && primary.fontSize > 0) {
        // Estimate line-height from rendered height if we have multiple lines
        const textContent = segments.map(s => s.text).join('');
        const hasNewline = textContent.includes('\n') || textContent.includes('\r');
        // Rough estimate: if text is long enough to likely wrap given the width
        const charsPerLine = width > 0 ? Math.floor(width / (primary.fontSize * 0.6)) : 0;
        const estimatedRows = charsPerLine > 0 ? Math.ceil(textContent.length / charsPerLine) : 1;

        if (hasNewline || estimatedRows > 1) {
          // Use rendered height to estimate line-height
          // lineHeight = totalHeight / rows, then normalize to unitless
          const estimatedLineHeight = height / estimatedRows / primary.fontSize;
          if (estimatedLineHeight > 0.8 && estimatedLineHeight < 3.0) {
            lineHeight = Math.round(estimatedLineHeight * 100) / 100;
          }
        }
      }

      layerInfo.text = {
        content: segments.map(s => s.text).join(''),
        fontName: primary.fontName,
        fontSize: primary.fontSize,
        color: primary.color,
        alignment: primary.alignment,
        letterSpacing: primary.letterSpacing,
        lineHeight,
        segments: segments.length > 1 ? segments : undefined,
      };

      // Collect all unique fonts used in this layer
      for (const seg of segments) {
        fonts.push({
          fontName: seg.fontName,
          postScriptName: seg.fontName,
          fontSize: seg.fontSize,
          fillColor: seg.color,
        });
      }
    }
  }

  if (!isGroup && !isTextLayer) {
    try {
      const png = layer.toPng();
      if (png?.data) {
        layerInfo.imageData = {
          data: new Uint8Array(png.data),
          width: png.width,
          height: png.height,
        };
      }
    } catch (err) {
      console.warn(`Could not export PNG for layer ${name}:`, err);
    }
  }

  if (isGroup && layer.children) {
    const children = layer.children() || [];
    layerInfo.children = children
      .map((child: any) => processLayer(child, fonts))
      .filter((l: any): l is LayerInfo => l !== null);
  }

  return layerInfo;
}

export function parsePsd(psdPath: string): {
  layers: LayerInfo[];
  width: number;
  height: number;
  fonts: FontInfo[];
  psdPpi: number;
} {
  const psd = PSD.fromFile(psdPath);
  psd.parse();

  // Read PSD resolution to calculate pt-to-px conversion
  const resInfo = psd.resources?.resource('resolutionInfo') as any;
  if (resInfo?.h_res != null && resInfo?.h_res_unit === 1) {
    psdPpi = resInfo.h_res; // h_res is in pixels per inch when unit is 1
  } else {
    psdPpi = 72; // default
  }

  const header = psd.header;
  const width = header?.width || 1920;
  const height = header?.height || 1080;

  const root = psd.tree();
  const fonts: FontInfo[] = [];
  layerCounter = 0;

  const children = (root.children() || []).reverse();
  const layers: LayerInfo[] = children
    .map((layer: any) => processLayer(layer, fonts))
    .filter((l: any): l is LayerInfo => l !== null);

  return { layers, width, height, fonts, psdPpi };
}
