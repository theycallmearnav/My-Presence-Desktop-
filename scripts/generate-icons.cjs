// One-off generator for the app's placeholder icons.
//   node scripts/generate-icons.cjs
// Produces:
//   electron/trayIcon.b64.txt  — 32px PNG base64 read by electron/main.ts for the tray
//   build/icon.ico             — 256px PNG-in-ICO used by electron-builder for the installer
// Replace both with real branded art whenever it's ready.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

// Brand-gradient rounded square (indigo -> violet), RGBA PNG at size S.
function makePng(S) {
  const raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0; // filter byte per scanline
    for (let x = 0; x < S; x++) {
      const i = y * (S * 4 + 1) + 1 + x * 4;
      const t = (x + y) / (S + S);
      raw[i] = Math.round(99 + t * 40);
      raw[i + 1] = Math.round(102 - t * 10);
      raw[i + 2] = Math.round(241 - t * 5);
      const dx = Math.min(x, S - 1 - x);
      const dy = Math.min(y, S - 1 - y);
      raw[i + 3] = dx + dy < Math.max(2, S / 10) ? 0 : 255; // clipped corners
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const root = path.join(__dirname, '..');

fs.writeFileSync(path.join(root, 'electron', 'trayIcon.b64.txt'), makePng(32).toString('base64'));

// Modern ICO: a single 256px PNG entry (width/height byte 0 means 256).
const png256 = makePng(256);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
const entry = Buffer.alloc(16);
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png256.length, 8);
entry.writeUInt32LE(22, 12); // data offset: 6 header + 16 entry
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'icon.ico'), Buffer.concat([header, entry, png256]));

console.log('wrote electron/trayIcon.b64.txt and build/icon.ico');
