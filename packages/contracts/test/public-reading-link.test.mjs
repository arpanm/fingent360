import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicReadingLink } from '../dist/public-reading-link.js';
test('DEV-029 canonical links contain only the public reader ID', () => {
  assert.equal(
    publicReadingLink('https://reader.example.org/', 'news-1'),
    'https://reader.example.org/#read/news-1',
  );
  for (const origin of [
    'http://reader.example.org',
    'https://localhost',
    'https://appassets.androidplatform.net',
    'https://127.0.0.1',
    'https://2130706433',
    'https://[::1]',
    'https://user:secret@reader.example.org',
    'https://reader.example.org/?token=secret',
    'https://reader.example.org/#privacy',
    'https://host.local',
    'https://reader.example.org/private',
  ])
    assert.throws(() => publicReadingLink(origin, 'news-1'));
  for (const id of [
    '../privacy',
    'news?token=secret',
    'news#feedback',
    'news/one',
  ])
    assert.throws(() => publicReadingLink('https://reader.example.org', id));
});
