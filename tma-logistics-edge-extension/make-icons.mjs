// Generates the TMA Logistics Hub toolbar icons (blue rounded square, white "T")
// matching the dashboard brand mark. Pure Node, no dependencies.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const outDir = process.argv[2];
if (!outDir) {
  console.error("Usage: node make-icons.mjs <output-dir>");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function writePng(filePath, size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync(filePath, png);
}

// Geometry in the unit square, matching the dashboard's .brand mark.
const CORNER_RADIUS = 0.22;
const BAR = { x0: 0.24, x1: 0.76, y0: 0.26, y1: 0.41 };
const STEM = { x0: 0.435, x1: 0.565, y0: 0.26, y1: 0.78 };
const TOP_COLOR = [0x17, 0x65, 0xf3];
const BOTTOM_COLOR = [0x0d, 0x45, 0xb5];

function insideRoundedSquare(x, y) {
  const r = CORNER_RADIUS;
  const cx = x < r ? r : x > 1 - r ? 1 - r : x;
  const cy = y < r ? r : y > 1 - r ? 1 - r : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function insideLetter(x, y) {
  const inBar = x >= BAR.x0 && x <= BAR.x1 && y >= BAR.y0 && y <= BAR.y1;
  const inStem = x >= STEM.x0 && x <= STEM.x1 && y >= STEM.y0 && y <= STEM.y1;
  return inBar || inStem;
}

function renderIcon(size) {
  const samples = 4; // 4x4 supersampling for smooth edges
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let coverage = 0;
      let letter = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (px + (sx + 0.5) / samples) / size;
          const y = (py + (sy + 0.5) / samples) / size;
          if (!insideRoundedSquare(x, y)) continue;
          coverage += 1;
          if (insideLetter(x, y)) letter += 1;
        }
      }
      const total = samples * samples;
      const alpha = coverage / total;
      if (!alpha) continue;
      const t = (px / size + py / size) / 2;
      const base = TOP_COLOR.map((c, i) => c + (BOTTOM_COLOR[i] - c) * t);
      const letterMix = coverage ? letter / coverage : 0;
      const offset = (py * size + px) * 4;
      for (let i = 0; i < 3; i++) rgba[offset + i] = Math.round(base[i] + (255 - base[i]) * letterMix);
      rgba[offset + 3] = Math.round(alpha * 255);
    }
  }
  return rgba;
}

for (const size of [16, 32, 48, 128]) {
  writePng(path.join(outDir, `icon-${size}.png`), size, renderIcon(size));
  console.log(`icon-${size}.png written`);
}
