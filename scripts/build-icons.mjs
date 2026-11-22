import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "branding", "connectx-icon.svg");
const output = path.join(root, "build", "icons");
await fs.mkdir(output, { recursive: true });

const svg = await fs.readFile(source);
const png = await sharp(svg, { density: 192 })
  .resize(512, 512, { fit: "contain" })
  .png()
  .toBuffer();

await fs.writeFile(path.join(output, "connectx.png"), png);

// ICO directory entry with a 256x256 PNG payload (supported by modern Windows).
const icoPng = await sharp(png).resize(256, 256).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);       // reserved
header.writeUInt16LE(1, 2);       // ICO resource type
header.writeUInt16LE(1, 4);       // image count
header.writeUInt8(0, 6);          // 256px width
header.writeUInt8(0, 7);          // 256px height
header.writeUInt8(0, 8);          // palette colors
header.writeUInt8(0, 9);          // reserved
header.writeUInt16LE(1, 10);      // color planes
header.writeUInt16LE(32, 12);     // bits per pixel
header.writeUInt32LE(icoPng.length, 14);
header.writeUInt32LE(22, 18);     // image data offset

await fs.writeFile(path.join(output, "connectx.ico"), Buffer.concat([header, icoPng]));
console.log("Generated ConnectX Windows and Linux application icons.");
