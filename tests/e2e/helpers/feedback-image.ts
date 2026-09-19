import { deflateSync } from 'node:zlib';

function crc(bytes: Buffer) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type: string, body: Buffer) {
  const output = Buffer.alloc(body.length + 12);
  output.writeUInt32BE(body.length);
  output.write(type, 4);
  body.copy(output, 8);
  output.writeUInt32BE(crc(output.subarray(4, -4)), output.length - 4);
  return output;
}
export function feedbackImage(padding = 0) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return {
    mime: 'image/png' as const,
    width: 1,
    height: 1,
    base64: Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      ...(padding ? [chunk('tEXt', Buffer.alloc(padding, 65))] : []),
      chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))),
      chunk('IEND', Buffer.alloc(0)),
    ]).toString('base64'),
  };
}
