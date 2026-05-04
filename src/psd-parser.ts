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
}> {
  const value = textData.value || '';
  const font = textData.font || {};

  const names = font.names || [];
  const sizes = font.sizes || [];
  const colors = font.colors || [];
  const lengthArray = font.lengthArray || [];

  // If no rich text segments, return single segment
  if (lengthArray.length <= 1) {
    const fontName = names[0] || 'Arial';
    const fontSize = ptToPx(sizes[0] || 16);
    let color = { r: 0, g: 0, b: 0, a: 1 };
    if (colors[0]) {
      color = {
        r: (colors[0][0] ?? 0) / 255,
        g: (colors[0][1] ?? 0) / 255,
        b: (colors[0][2] ?? 0) / 255,
        a: (colors[0][3] ?? 255) / 255,
      };
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
    }];
  }

  // Parse rich text segments based on lengthArray
  const segments: Array<{
    text: string;
    fontName: string;
    fontSize: number;
    color: { r: number; g: number; b: number; a: number };
    alignment: string;
  }> = [];

  let offset = 0;
  for (let i = 0; i < lengthArray.length; i++) {
    const len = lengthArray[i];
    const segmentText = value.substring(offset, offset + len);
    offset += len;

    const fontName = names[i] || names[0] || 'Arial';
    const fontSize = ptToPx(sizes[i] || sizes[0] || 16);
    let color = { r: 0, g: 0, b: 0, a: 1 };
    if (colors[i]) {
      color = {
        r: (colors[i][0] ?? 0) / 255,
        g: (colors[i][1] ?? 0) / 255,
        b: (colors[i][2] ?? 0) / 255,
        a: (colors[i][3] ?? 255) / 255,
      };
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
  const width = (right - left) || (layer.width || 0);
  const height = (bottom - top) || (layer.height || 0);

  const opacity = layer.opacity !== undefined ? layer.opacity / 255 : 1;
  const visible = layer.visible !== false;

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
      layerInfo.text = {
        content: segments.map(s => s.text).join(''),
        fontName: primary.fontName,
        fontSize: primary.fontSize,
        color: primary.color,
        alignment: primary.alignment,
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
