import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import {
  pngCrc,
  validateFeedbackPng,
  validateFeedbackAudio,
  validateFeedbackSubmission,
} from '../dist/feedback-validation.js';
function chunk(type, body) {
  const output = Buffer.alloc(body.length + 12);
  output.writeUInt32BE(body.length);
  output.write(type, 4);
  body.copy(output, 8);
  output.writeUInt32BE(pngCrc(output.subarray(4, -4)), output.length - 4);
  return output;
}
function png(width = 1, height = 1, pixels = Buffer.from([0, 255, 0, 0, 255])) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
test('feedback PNG validates real chunks/CRC/dimensions and bounded decoded rows', () => {
  const image = png();
  validateFeedbackPng(image, 1, 1);
  assert.throws(() => validateFeedbackPng(image, 2, 1));
  const corrupt = Buffer.from(image);
  corrupt[45] ^= 1;
  assert.throws(() => validateFeedbackPng(corrupt, 1, 1));
  assert.throws(() => validateFeedbackPng(png(1, 1, Buffer.alloc(2000)), 1, 1));
  assert.throws(() =>
    validateFeedbackPng(png(1, 1, Buffer.from([5, 0, 0, 0, 0])), 1, 1),
  );
  assert.throws(() =>
    validateFeedbackPng(Buffer.concat([image, Buffer.from('trailing')]), 1, 1),
  );
  assert.throws(() =>
    validateFeedbackPng(Buffer.from('<svg onload=alert(1)>'), 1, 1),
  );
});
test('feedback submission requires consent, canonical encoding and a written or voice message', () => {
  const body = {
    id: randomUUID(),
    receiptToken: 'a'.repeat(64),
    text: 'Synthetic feedback',
    image: {
      mime: 'image/png',
      base64: png().toString('base64'),
      width: 1,
      height: 1,
    },
    audio: null,
    context: {
      screen: 'today',
      runtime: 'web',
      appVersion: 'test',
      viewport: { width: 320, height: 600 },
      capturedAt: '2026-09-13T00:00:00.000Z',
    },
    consent: true,
  };
  assert.equal(validateFeedbackSubmission(body).image.length, png().length);
  for (const invalid of [
    { ...body, consent: false },
    { ...body, text: '' },
    { ...body, unknown: 'field' },
    { ...body, text: 'x'.repeat(5001) },
    { ...body, image: { ...body.image, base64: body.image.base64 + '=' } },
  ])
    assert.throws(() => validateFeedbackSubmission(invalid));
});
test('feedback rejects MIME spoofing and malformed/truncated voice containers', () => {
  for (const mime of ['audio/webm', 'audio/mp4', 'audio/ogg'])
    assert.throws(() => validateFeedbackAudio(Buffer.alloc(80), mime));
  const ogg = Buffer.alloc(40);
  ogg.write('OggS');
  ogg[26] = 1;
  ogg[27] = 100;
  assert.throws(() => validateFeedbackAudio(ogg, 'audio/ogg'));
  const mp4 = Buffer.alloc(40);
  mp4.writeUInt32BE(1000);
  mp4.write('ftyp', 4);
  assert.throws(() => validateFeedbackAudio(mp4, 'audio/mp4'));
  assert.throws(() =>
    validateFeedbackAudio(Buffer.alloc(4000001), 'audio/webm'),
  );
});
