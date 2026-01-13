import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const svgPath = join(__dirname, '..', 'static', 'og-image.svg');
const pngPath = join(__dirname, '..', 'static', 'og-image.png');

const svgBuffer = readFileSync(svgPath);

await sharp(svgBuffer)
	.resize(1200, 630)
	.png()
	.toFile(pngPath);

console.log('OG image generated successfully at static/og-image.png');

