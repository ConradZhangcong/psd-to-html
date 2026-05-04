import fs from 'fs-extra';
import sharp from 'sharp';
import type { LayerInfo } from './types.js';

const OUTPUT_DIR = 'dist';
const IMAGES_DIR = `${OUTPUT_DIR}/images`;

export async function ensureOutputDirs(): Promise<void> {
  await fs.ensureDir(OUTPUT_DIR);
  await fs.ensureDir(IMAGES_DIR);
}

export async function exportLayerImage(
  layer: LayerInfo,
  psdName: string
): Promise<string | undefined> {
  if (!layer.imageData || layer.type === 'text' || layer.type === 'group') {
    return undefined;
  }

  if (!layer.visible || layer.opacity === 0) {
    return undefined;
  }

  try {
    const { data, width, height } = layer.imageData;
    const buffer = Buffer.from(data);

    const filename = `${psdName}_layer_${layer.index}.png`;
    const outputPath = `${IMAGES_DIR}/${filename}`;

    await sharp(buffer, {
      raw: {
        width,
        height,
        channels: 4,
      },
    })
      .png()
      .toFile(outputPath);

    return `images/${filename}`;
  } catch (err) {
    console.warn(`Failed to export layer ${layer.name}:`, err);
    return undefined;
  }
}

export async function exportAllImages(
  layers: LayerInfo[],
  psdName: string
): Promise<{ images: string[]; layerMap: Map<string, string> }> {
  const images: string[] = [];
  const layerMap = new Map<string, string>();

  for (const layer of layers) {
    const path = await exportLayerImage(layer, psdName);
    if (path) {
      images.push(path);
      layerMap.set(layer.id, path);
      layer.imagePath = path;
    }
  }

  return { images, layerMap };
}
