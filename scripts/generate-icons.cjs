// Generate proper multi-resolution icon from ic_app_logo.png
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const srcPng = path.join(root, 'ic_app_logo.png');

async function main() {
  const pngBuf = fs.readFileSync(srcPng);

  const sizes = [16, 24, 32, 48, 64, 96, 128, 256];

  const pngBuffers = await Promise.all(
    sizes.map((s) => sharp(pngBuf).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer())
  );

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);

  let dataOffset = 6 + sizes.length * 16;
  const entries = [];
  const dataChunks = [];

  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    const p = pngBuffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(s >= 256 ? 0 : s, 0);
    entry.writeUInt8(s >= 256 ? 0 : s, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(p.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    dataOffset += p.length;
    entries.push(entry);
    dataChunks.push(p);
  }

  const ico = Buffer.concat([header, ...entries, ...dataChunks]);
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), ico);

  const trayPng = await sharp(pngBuf).resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  fs.writeFileSync(path.join(root, 'electron', 'trayIcon.b64.txt'), trayPng.toString('base64'));

  fs.copyFileSync(path.join(root, 'build', 'icon.ico'), path.join(root, 'build', 'installerIcon.ico'));
  fs.copyFileSync(path.join(root, 'build', 'icon.ico'), path.join(root, 'build', 'uninstallerIcon.ico'));

  console.log(`Generated multi-res icon: ${sizes.join(', ')}`);
  console.log('Updated tray icon and installer icons');
}

main().catch(console.error);
