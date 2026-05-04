import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output');
const fontsDir = path.join(outputDir, 'fonts');

const FONT_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2', '.eot'];
const FONT_FORMAT_MAP: Record<string, string> = {
  '.ttf': 'truetype',
  '.otf': 'opentype',
  '.woff': 'woff',
  '.woff2': 'woff2',
  '.eot': 'embedded-opentype',
};

async function main() {
  // Check if fonts directory exists
  if (!await fs.pathExists(fontsDir)) {
    console.error('Error: output/fonts directory not found. Please create it and add font files.');
    process.exit(1);
  }

  // Read all font files in output/fonts
  const fontFiles = (await fs.readdir(fontsDir)).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return FONT_EXTENSIONS.includes(ext);
  });

  if (fontFiles.length === 0) {
    console.error('Error: No font files found in output/fonts. Supported extensions:', FONT_EXTENSIONS.join(', '));
    process.exit(1);
  }

  console.log(`Found ${fontFiles.length} font files in output/fonts:`);
  fontFiles.forEach(f => console.log(`  - ${f}`));

  // Generate @font-face rules
  const fontFaces = fontFiles.map(fontFile => {
    const ext = path.extname(fontFile).toLowerCase();
    const format = FONT_FORMAT_MAP[ext] || 'truetype';
    const fontFamily = path.basename(fontFile, ext);
    const relativePath = `../fonts/${fontFile}`;
    return `@font-face {
  font-family: '${fontFamily}';
  src: url('${relativePath}') format('${format}');
  font-weight: normal;
  font-style: normal;
}`;
  });

  const styleBlock = `<style>\n${fontFaces.join('\n\n')}\n</style>`;
  const injectionMarker = '<!-- Injected Web Fonts -->';

  // Find all index.html files in output/{psdName}/
  const allDirs = await fs.readdir(outputDir);
  const psdDirs = [];
  for (const dir of allDirs) {
    const dirPath = path.join(outputDir, dir);
    const stat = await fs.stat(dirPath);
    if (stat.isDirectory() && dir !== 'fonts') {
      psdDirs.push(dir);
    }
  }

  let processed = 0;
  for (const psdDir of psdDirs) {
    const htmlPath = path.join(outputDir, psdDir, 'index.html');
    if (!await fs.pathExists(htmlPath)) {
      console.log(`Skipping ${psdDir}: index.html not found`);
      continue;
    }

    let html = await fs.readFile(htmlPath, 'utf-8');

    // Check if already injected
    if (html.includes(injectionMarker)) {
      console.log(`Skipping ${htmlPath}: fonts already injected`);
      continue;
    }

    // Inject before </head>
    if (!html.includes('</head>')) {
      console.warn(`Warning: ${htmlPath} has no </head> tag, skipping`);
      continue;
    }

    const injectedHtml = html.replace('</head>', `${styleBlock}\n${injectionMarker}\n</head>`);
    await fs.writeFile(htmlPath, injectedHtml, 'utf-8');
    console.log(`Injected fonts into ${htmlPath}`);
    processed++;
  }

  console.log(`\nDone! Injected fonts into ${processed} HTML file(s).`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
