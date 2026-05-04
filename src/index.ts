import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { parsePsd } from './psd-parser.js';
import { generateHtml, generateFontsUsage } from './html-generator.js';
import { ensureOutputDirs, exportAllImages } from './image-exporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function main() {
  const args = process.argv.slice(2);
  const psdPath = args[0];

  if (!psdPath) {
    console.error('Usage: tsx src/index.ts <path-to-psd-file>');
    console.error('Example: tsx src/index.ts ./design.psd');
    process.exit(1);
  }

  if (!fs.existsSync(psdPath)) {
    console.error(`Error: PSD file not found: ${psdPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(psdPath);
  console.log(`PSD file size: ${formatBytes(stats.size)}`);
  if (stats.size > 100 * 1024 * 1024) {
    console.warn('Warning: Large PSD file detected. This may require significant memory.');
    console.warn('Consider increasing Node.js memory limit: node --max-old-space-size=4096 ...');
  }

  const psdName = path.basename(psdPath, path.extname(psdPath)).replace(/[^a-zA-Z0-9_-]/g, '_');
  const outputDir = path.join('output', psdName);
  const imagesDir = path.join(outputDir, 'images');

  console.log(`Parsing PSD: ${psdPath}`);
  console.log(`PSD Name: ${psdName}`);
  console.log(`Output Dir: ${outputDir}`);

  try {
    const { layers, width, height, fonts, psdPpi } = parsePsd(psdPath);
    console.log(`Found ${layers.length} top-level layers (${width}x${height})`);

    await fs.ensureDir(outputDir);
    await fs.ensureDir(imagesDir);
    console.log(`Output directories created: ${outputDir}/, ${imagesDir}/`);

    const { images, layerMap } = await exportAllImages(layers, psdName, imagesDir);
    console.log(`Exported ${images.length} images`);

    const html = generateHtml(layers, width, height, fonts, psdPpi);
    const fontsUsageJson = generateFontsUsage(fonts);

    const htmlPath = path.join(outputDir, 'index.html');
    const fontsPath = path.join(outputDir, 'fonts_usage.json');

    await fs.writeFile(htmlPath, html, 'utf-8');
    await fs.writeFile(fontsPath, fontsUsageJson, 'utf-8');

    console.log('\nConversion complete!');
    console.log(`  HTML: ${htmlPath}`);
    console.log(`  Fonts: ${fontsPath}`);
    console.log(`  Images: ${images.length} files in ${imagesDir}/`);


  } catch (err) {
    console.error('Error during conversion:', err);
    if (err instanceof Error && err.message.includes('out of memory')) {
      console.error('Tip: Try increasing Node.js memory limit with --max-old-space-size flag');
    }
    process.exit(1);
  }
}

main();
