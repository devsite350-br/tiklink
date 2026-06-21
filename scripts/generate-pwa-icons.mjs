import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const src = join(publicDir, 'favicon.png');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  const out = join(publicDir, `pwa-${size}x${size}.png`);
  await sharp(src).resize(size, size).png().toFile(out);
  console.log(`✓ pwa-${size}x${size}.png`);
}

console.log('\nDone!');
