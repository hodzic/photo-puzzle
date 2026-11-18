import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeShare, decodeShare, codeFromHash, toBase64Url, fromBase64Url, photoFromHash, isPhotosPage } from '../js/share.js';
import { shuffle, solvedBoard } from '../js/puzzle.js';

test('base64url round trip, including large arrays', () => {
  const bytes = new Uint8Array(100000).map((_, i) => (i * 7) % 256);
  const s = toBase64Url(bytes);
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(fromBase64Url(s), bytes);
});

test('share round trip with a photo', () => {
  const board = shuffle(4, 5);
  const image = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 255]);
  const code = encodeShare({ cols: 4, rows: 5, board, numbers: true, image, imageType: 'image/webp' });
  const d = decodeShare(code);
  assert.deepEqual(d, { cols: 4, rows: 5, board, numbers: true, image, imageType: 'image/webp', imageUrl: '' });
  assert.equal(codeFromHash('#p=' + code), code);
  assert.equal(codeFromHash('#other'), null);
});

test('share round trip without a photo', () => {
  const board = shuffle(3, 3);
  const d = decodeShare(encodeShare({ cols: 3, rows: 3, board }));
  assert.equal(d.image, null);
  assert.deepEqual(d.board, board);
});

test('damaged links are rejected', () => {
  const b = solvedBoard(3, 3);
  [b[0], b[1]] = [b[1], b[0]];
  assert.throws(() => decodeShare(encodeShare({ cols: 3, rows: 3, board: b })), /damaged/);
  const good = encodeShare({ cols: 3, rows: 3, board: shuffle(3, 3), image: new Uint8Array([1]), imageType: 'image/jpeg' });
  assert.throws(() => decodeShare(good.slice(0, 8)), /incomplete/);
  assert.throws(() => decodeShare('!!!'), /damaged/);
});

test('share round trip with a photo address', () => {
  const board = shuffle(3, 4), imageUrl = 'https://lh3.googleusercontent.com/abc_DEF-123=w2048';
  const d = decodeShare(encodeShare({ cols: 3, rows: 4, board, imageUrl }));
  assert.equal(d.imageUrl, imageUrl);
  assert.equal(d.image, null);
  assert.throws(() => decodeShare(encodeShare({ cols: 3, rows: 4, board, imageUrl: 'javascript:alert(1)' })), /damaged/);
});

test('photo links', () => {
  const u = 'https://example.com/a b.jpg';
  assert.deepEqual(photoFromHash('#photo=' + encodeURIComponent(u) + '&size=4x5'), { url: u, cols: 4, rows: 5 });
  assert.deepEqual(photoFromHash('#photo=' + encodeURIComponent(u)), { url: u, cols: 0, rows: 0 });
  assert.equal(photoFromHash('#photo=' + encodeURIComponent(u) + '&size=9x9').cols, 0);
  assert.equal(photoFromHash('#photo=ftp%3A%2F%2Fx'), null);
  assert.ok(isPhotosPage('https://photos.app.goo.gl/AbCd'));
  assert.ok(!isPhotosPage('https://lh3.googleusercontent.com/x'));
});
