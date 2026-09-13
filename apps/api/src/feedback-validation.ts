import { inflateSync } from 'node:zlib';
import {
  FeedbackSubmissionSchema,
  type FeedbackSubmission,
  feedbackLimits,
} from '@fingent360/contracts';
import { BadRequestException } from '@nestjs/common';
function reject(): never {
  throw new BadRequestException(
    'Feedback attachment is invalid or unsupported. Use a PNG screenshot or a supported voice recording within the limits.',
  );
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function pngCrc(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const value of bytes) crc = crcTable[(crc ^ value) & 255]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function validateFeedbackPng(
  bytes: Buffer,
  width: number,
  height: number,
) {
  if (
    bytes.length > feedbackLimits.imageBytes ||
    bytes.length < 57 ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    reject();
  let offset = 8,
    header = false,
    end = false,
    idat = false;
  const compressed: Buffer[] = [];
  let channels = 0;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) reject();
    const length = bytes.readUInt32BE(offset),
      type = bytes.toString('ascii', offset + 4, offset + 8);
    if (length > bytes.length - offset - 12 || !/^[A-Za-z]{4}$/.test(type))
      reject();
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (
      pngCrc(bytes.subarray(offset + 4, offset + 8 + length)) !==
      bytes.readUInt32BE(offset + 8 + length)
    )
      reject();
    if (!header && type !== 'IHDR') reject();
    if (type === 'IHDR') {
      if (
        header ||
        length !== 13 ||
        body.readUInt32BE(0) !== width ||
        body.readUInt32BE(4) !== height ||
        width < 1 ||
        height < 1 ||
        width > 4096 ||
        height > 4096 ||
        body[8] !== 8 ||
        ![2, 6].includes(body[9]!) ||
        body[10] !== 0 ||
        body[11] !== 0 ||
        body[12] !== 0
      )
        reject();
      header = true;
      channels = body[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      if (end) reject();
      compressed.push(body);
      idat = true;
    } else if (type === 'IEND') {
      if (length !== 0 || !idat || offset + 12 !== bytes.length) reject();
      end = true;
    } else if ((type.charCodeAt(0) & 32) === 0) reject();
    offset += length + 12;
  }
  if (!end) reject();
  const expected = (width * channels + 1) * height;
  let decoded: Buffer;
  try {
    decoded = inflateSync(Buffer.concat(compressed), {
      maxOutputLength: expected,
    });
  } catch {
    reject();
  }
  if (decoded!.length !== expected) reject();
  for (let row = 0; row < height; row++)
    if (decoded![row * (width * channels + 1)]! > 4) reject();
}
export function validateFeedbackAudio(bytes: Buffer, mime: string) {
  if (bytes.length < 32 || bytes.length > feedbackLimits.audioBytes) reject();
  if (mime === 'audio/webm') {
    if (
      !bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) ||
      !bytes.subarray(0, 128).includes(Buffer.from('webm')) ||
      !bytes.includes(Buffer.from([0x18, 0x53, 0x80, 0x67])) ||
      !bytes.includes(Buffer.from('A_OPUS')) ||
      bytes.includes(Buffer.from('V_VP'))
    )
      reject();
  } else if (mime === 'audio/mp4') {
    let offset = 0,
      ftyp = false,
      moov = false,
      mdat = false;
    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) reject();
      const length = bytes.readUInt32BE(offset),
        type = bytes.toString('ascii', offset + 4, offset + 8);
      if (length < 8 || length > bytes.length - offset) reject();
      const box = bytes.subarray(offset + 8, offset + length);
      if (type === 'ftyp') {
        if (
          offset !== 0 ||
          box.length < 8 ||
          !/(M4A |isom|mp42|mp41|iso6)/.test(box.toString('ascii'))
        )
          reject();
        ftyp = true;
      }
      if (type === 'moov') {
        moov =
          box.includes(Buffer.from('soun')) &&
          !box.includes(Buffer.from('vide'));
      }
      if (type === 'mdat') mdat = box.length > 0;
      offset += length;
    }
    if (!ftyp || !moov || !mdat) reject();
  } else if (mime === 'audio/ogg') {
    let offset = 0,
      pages = 0;
    while (offset < bytes.length) {
      if (
        offset + 27 > bytes.length ||
        bytes.toString('ascii', offset, offset + 4) !== 'OggS' ||
        bytes[offset + 4] !== 0
      )
        reject();
      const segments = bytes[offset + 26]!;
      if (offset + 27 + segments > bytes.length) reject();
      let size = 0;
      for (let i = 0; i < segments; i++) size += bytes[offset + 27 + i]!;
      if (offset + 27 + segments + size > bytes.length) reject();
      offset += 27 + segments + size;
      pages++;
    }
    if (pages < 1 || !bytes.subarray(0, 256).includes(Buffer.from('OpusHead')))
      reject();
  } else reject();
}
export function validateFeedbackSubmission(body: unknown): {
  submission: FeedbackSubmission;
  image: Buffer | null;
  audio: Buffer | null;
} {
  const result = FeedbackSubmissionSchema.safeParse(body);
  if (!result.success)
    throw new BadRequestException(
      'Check feedback text, consent, context and attachment limits.',
    );
  const submission = result.data;
  const image = submission.image
      ? Buffer.from(submission.image.base64, 'base64')
      : null,
    audio = submission.audio
      ? Buffer.from(submission.audio.base64, 'base64')
      : null;
  if (image && submission.image) {
    if (image.toString('base64') !== submission.image.base64) reject();
    validateFeedbackPng(image, submission.image.width, submission.image.height);
  }
  if (audio && submission.audio) {
    if (audio.toString('base64') !== submission.audio.base64) reject();
    validateFeedbackAudio(audio, submission.audio.mime);
  }
  return { submission, image, audio };
}
