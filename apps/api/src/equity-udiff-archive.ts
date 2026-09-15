import { inflateRawSync } from 'node:zlib';
/** A single bounded named CSV; never extracts paths or executes archive content. */
export function readUdiffArchive(
  bytes: Uint8Array,
  expectedName: string,
): string {
  if (bytes.length < 22 || bytes.length > 2000000)
    throw Error('UDiFF archive exceeds its2MB compressed bound.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    u16 = (n: number) => view.getUint16(n, true),
    u32 = (n: number) => view.getUint32(n, true);
  let end = -1;
  for (let n = bytes.length - 22; n >= Math.max(0, bytes.length - 65557); n--)
    if (u32(n) === 0x06054b50 && n + 22 + u16(n + 20) === bytes.length) {
      end = n;
      break;
    }
  if (
    end < 0 ||
    u16(end + 4) ||
    u16(end + 6) ||
    u16(end + 8) !== 1 ||
    u16(end + 10) !== 1
  )
    throw Error('Require a single-entry, single-disk UDiFF archive.');
  const directory = u32(end + 16),
    directorySize = u32(end + 12);
  if (
    directory + directorySize !== end ||
    directory + 46 > end ||
    u32(directory) !== 0x02014b50
  )
    throw Error('Malformed UDiFF ZIP directory.');
  const flags = u16(directory + 8),
    method = u16(directory + 10),
    crc = u32(directory + 16),
    compressed = u32(directory + 20),
    expanded = u32(directory + 24),
    nameLength = u16(directory + 28),
    extra = u16(directory + 30),
    comment = u16(directory + 32),
    local = u32(directory + 42);
  if (
    flags & ~0x800 ||
    ![0, 8].includes(method) ||
    u16(directory + 34) ||
    expanded > 2000000 ||
    !expanded ||
    directory + 46 + nameLength + extra + comment !== end
  )
    throw Error(
      'Encrypted, streamed, ZIP64 or oversized UDiFF archives are unsupported.',
    );
  const decoder = new TextDecoder('utf-8', { fatal: true }),
    name = decoder.decode(
      bytes.subarray(directory + 46, directory + 46 + nameLength),
    );
  if (name !== expectedName)
    throw Error(
      'Archive filename does not match the requested final trading date.',
    );
  if (
    local !== 0 ||
    local + 30 > directory ||
    u32(local) !== 0x04034b50 ||
    u16(local + 6) !== flags ||
    u16(local + 8) !== method ||
    u32(local + 14) !== crc ||
    u32(local + 18) !== compressed ||
    u32(local + 22) !== expanded
  )
    throw Error('Inconsistent UDiFF ZIP header.');
  const start = local + 30 + u16(local + 26) + u16(local + 28);
  if (
    start + compressed !== directory ||
    decoder.decode(bytes.subarray(local + 30, local + 30 + u16(local + 26))) !==
      name
  )
    throw Error('UDiFF archive has overlapping or unexpected entries.');
  const source = bytes.subarray(start, start + compressed),
    output =
      method === 0
        ? source
        : inflateRawSync(source, { maxOutputLength: 2000000 });
  if (output.length !== expanded)
    throw Error('UDiFF expanded byte count does not reconcile.');
  let check = 0xffffffff;
  for (const value of output) {
    check ^= value;
    for (let i = 0; i < 8; i++)
      check = (check >>> 1) ^ (check & 1 ? 0xedb88320 : 0);
  }
  if ((check ^ 0xffffffff) >>> 0 !== crc)
    throw Error('UDiFF archive CRC does not reconcile.');
  return decoder.decode(output);
}
