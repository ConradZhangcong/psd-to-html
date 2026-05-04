import { readPsd, decodeLayerPixels } from 'ag-psd';
import fs from 'fs-extra';
import type { LayerInfo, FontInfo } from './types.js';

let layerCounter = 0;

function extractTextStyle(layer: any): LayerInfo['text'] | undefined {
  if (!layer.text) return undefined;

  const textData = layer.text;
  const styles = textData.styles?.[0] || {};

  const fontSize = styles.fontSize || 16;
  const fontName = styles.fontName || 'Arial';

  let color = { r: 0, g: 0, b: 0, a: 1 };
  if (styles.fillColor) {
    color = {
      r: styles.fillColor[0] ?? 0,
      g: styles.fillColor[1] ?? 0,
      b: styles.fillColor[2] ?? 0,
      a: styles.fillColor[3] ?? 1,
    };
  } else if (styles.color) {
    color = {
      r: styles.color[0] ?? 0,
      g: styles.color[1] ?? 0,
      b: styles.color[2] ?? 0,
      a: styles.color[3] ?? 1,
    };
  }

  const content = textData.text || '';

  return {
    content,
    fontName,
    fontSize,
    color,
    alignment: styles.alignment || 'left',
  };
}

function processLayer(layer: any, fonts: FontInfo[]): LayerInfo | null {
  if (!layer) return null;

  const index = layerCounter++;
  const bounds = layer.bounds || { left: 0, top: 0, right: 0, bottom: 0 };
  const left = bounds.left || 0;
  const top = bounds.top || 0;
  const width = (bounds.right || 0) - left;
  const height = (bounds.bottom || 0) - top;

  const opacity = layer.opacity !== undefined ? layer.opacity / 255 : 1;
  const visible = !layer.hidden;

  const isTextLayer = !!layer.text;
  const isGroup = !!layer.children;

  const layerInfo: LayerInfo = {
    id: `layer_${index}`,
    index,
    name: layer.name || `Layer ${index}`,
    type: isTextLayer ? 'text' : isGroup ? 'group' : 'image',
    left,
    top,
    width,
    height,
    opacity,
    visible,
  };

  if (isTextLayer) {
    layerInfo.text = extractTextStyle(layer);
    if (layerInfo.text) {
      fonts.push({
        fontName: layerInfo.text.fontName,
        postScriptName: layerInfo.text.fontName,
        fontSize: layerInfo.text.fontSize,
        fillColor: layerInfo.text.color,
      });
    }
  }

  if (!isTextLayer && !isGroup) {
    try {
      decodeLayerPixels(layer, true);
      if (layer.imageData) {
        layerInfo.imageData = {
          data: layer.imageData.data,
          width: layer.imageData.width,
          height: layer.imageData.height,
        };
      }
    } catch (err) {
      console.warn(`Could not decode pixels for layer ${layerInfo.name}:`, err);
    }
  }

  if (isGroup && layer.children) {
    layerInfo.children = layer.children
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
} {
  const buffer = fs.readFileSync(psdPath);
  const psd = readPsd(buffer, {
    useImageData: true,
    skipCompositeImageData: true,
  });

  const width = psd.width || 1920;
  const height = psd.height || 1080;
  const fonts: FontInfo[] = [];
  layerCounter = 0;

  const layers: LayerInfo[] = (psd.children || [])
    .map((layer: any) => processLayer(layer, fonts))
    .filter((l: any): l is LayerInfo => l !== null);

  return { layers, width, height, fonts };
}
