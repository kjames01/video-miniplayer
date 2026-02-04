const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '../resources/icons/icon.svg');
const ICO_PATH = path.join(__dirname, '../resources/icons/icon.ico');

const SIZES = [256, 128, 64, 48, 32, 16];

async function createIcon() {
  console.log('Converting SVG to PNGs...');

  // Convert SVG to PNG buffers at different sizes
  const pngBuffers = [];
  for (const size of SIZES) {
    const buffer = await sharp(SVG_PATH)
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push(buffer);
    console.log(`  Created ${size}x${size} PNG buffer`);
  }

  console.log('Creating ICO file...');

  // Convert PNG buffers to ICO
  const icoBuffer = await toIco(pngBuffers);
  fs.writeFileSync(ICO_PATH, icoBuffer);

  console.log(`ICO file created at: ${ICO_PATH}`);
}

createIcon().catch(console.error);
