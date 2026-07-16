// Generate a premium MY Presence app icon from the logo SVG
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

async function main() {
  const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
    <linearGradient id="bg2" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000" flood-opacity="0.3"/>
    </filter>
    <filter id="glow">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect width="512" height="512" rx="112" fill="url(#bg2)"/>
  <rect x="8" y="8" width="496" height="496" rx="108" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4"/>
  <circle cx="256" cy="240" r="160" fill="rgba(255,255,255,0.06)"/>
  <path d="M170 310V182L256 252L342 182V310L256 240L170 310Z" fill="white" filter="url(#shadow)"/>
  <circle cx="370" cy="256" r="40" fill="#22c55e" stroke="#0b0b0f" stroke-width="8" filter="url(#glow)"/>
  <circle cx="370" cy="256" r="16" fill="rgba(255,255,255,0.25)"/>
</svg>`;

  const png = await sharp(Buffer.from(iconSvg))
    .resize(1024, 1024)
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(root, 'ic_app_logo.png'), png);
  fs.writeFileSync(path.join(root, 'public', 'ic_app_logo.png'), png);

  console.log('Generated premium MY Presence logo');
  console.log('Size: 1024x1024,', png.length, 'bytes');

  const info = await sharp(png).raw().toBuffer();
  const pixels = info.length / 4;
  let colors = new Set();
  for (let i = 0; i < pixels; i += 2000) {
    const r = info[i*4], g = info[i*4+1], b = info[i*4+2];
    colors.add(`${r},${g},${b}`);
  }
  console.log('Distinct colors in sample:', colors.size);
}

main().catch(console.error);
