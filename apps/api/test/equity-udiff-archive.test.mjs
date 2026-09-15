import test from 'node:test';
import assert from 'node:assert/strict';
import { readUdiffArchive } from '../dist/equity-udiff-archive.js';
// Synthetic single-entry stored ZIP. No external download or import-time work.
function archive(name, text) {
  const body = Buffer.from(text),
    filename = Buffer.from(name);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(body.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50);
  directory.writeUInt32LE(crc, 16);
  directory.writeUInt32LE(body.length, 20);
  directory.writeUInt32LE(body.length, 24);
  directory.writeUInt16LE(filename.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(directory.length + filename.length, 12);
  end.writeUInt32LE(local.length + filename.length + body.length, 16);
  return Buffer.concat([local, filename, body, directory, filename, end]);
}
test('UDiFF ZIP retains exact UTF8 and rejects CRC changes, unexpected paths, multiple entries and oversized documents', () => {
  const name = 'BhavCopy_NSE_CM_0_0_0_20250131_F_0000.csv',
    source = 'synthetic source only';
  assert.equal(readUdiffArchive(archive(name, source), name), source);
  assert.throws(() => readUdiffArchive(archive('../' + name, source), name));
  const damaged = archive(name, source);
  damaged[30 + Buffer.byteLength(name)] ^= 1;
  assert.throws(() => readUdiffArchive(damaged, name));
  const multiple = archive(name, source);
  multiple.writeUInt16LE(2, multiple.length - 14);
  assert.throws(() => readUdiffArchive(multiple, name));
  assert.throws(() =>
    readUdiffArchive(archive(name, 'x'.repeat(2000001)), name),
  );
});
