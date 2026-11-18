// Share links, pure. The whole puzzle travels in the link's #fragment (never sent to a server), base64url-encoded:
//   byte 0  format version (1)
//   byte 1  columns, byte 2 rows
//   byte 3  flags: bit 0 show numbers on photo tiles
//   byte 4  image type: 0 none (numbers only), 1 WebP, 2 JPEG, 3 web address of the photo
//   then cols*rows bytes of the scrambled board, then the image file's bytes (or the address, UTF-8).

import { isSolvable, MIN, MAX } from './puzzle.js';

const VERSION = 1;
export const IMAGE_TYPES = ['', 'image/webp', 'image/jpeg', 'url'];
export const HASH_KEY = 'p=';

export function toBase64Url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export const isWebUrl = s => { try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; } };

// image: the photo's bytes with imageType 'image/webp' or 'image/jpeg', or imageUrl: its web address.
export function encodeShare({ cols, rows, board, numbers = false, image = null, imageType = '', imageUrl = '' }) {
  if (imageUrl) { image = new TextEncoder().encode(imageUrl); imageType = 'url'; }
  const t = image ? IMAGE_TYPES.indexOf(imageType) : 0;
  if (t < 0) throw new Error('Unsupported image type ' + imageType);
  const n = cols * rows, img = image || new Uint8Array(0);
  const bytes = new Uint8Array(5 + n + img.length);
  bytes.set([VERSION, cols, rows, numbers ? 1 : 0, t]);
  bytes.set(board, 5);
  bytes.set(img, 5 + n);
  return toBase64Url(bytes);
}

// Throws an Error with a readable message when the link is damaged.
export function decodeShare(code) {
  let bytes;
  try { bytes = fromBase64Url(code.trim()); } catch { throw new Error('The link is damaged.'); }
  if (bytes.length < 5) throw new Error('The link is incomplete.');
  const [version, cols, rows, flags, t] = bytes;
  if (version !== VERSION) throw new Error('This link was made by a newer version of Photo Puzzle.');
  if (cols < MIN || cols > MAX || rows < MIN || rows > MAX || t >= IMAGE_TYPES.length) throw new Error('The link is damaged.');
  const n = cols * rows;
  if (bytes.length < 5 + n) throw new Error('The link is incomplete.');
  const board = Array.from(bytes.subarray(5, 5 + n));
  if (!isSolvable(board, cols, rows)) throw new Error('The link is damaged.');
  let image = t ? bytes.slice(5 + n) : null, imageUrl = '';
  if (t && !image.length) throw new Error('The link is incomplete: the photo is missing.');
  if (IMAGE_TYPES[t] === 'url') {
    imageUrl = new TextDecoder().decode(image);
    if (!isWebUrl(imageUrl)) throw new Error('The link is damaged.');
    image = null;
  }
  return { cols, rows, board, numbers: !!(flags & 1), image, imageType: image ? IMAGE_TYPES[t] : '', imageUrl };
}

// Reads a share code from a location hash ("#p=..."), or null.
export const codeFromHash = hash => (hash.startsWith('#' + HASH_KEY) ? hash.slice(1 + HASH_KEY.length) : null);

// A link that opens a new puzzle from a web photo: #photo=<address>[&size=4x5]. Returns { url, cols, rows } or null.
export function photoFromHash(hash) {
  if (!hash.startsWith('#photo=')) return null;
  const q = new URLSearchParams(hash.slice(1));
  const url = q.get('photo'), m = /^(\d)x(\d)$/.exec(q.get('size') || '');
  if (!isWebUrl(url)) return null;
  const ok = v => v >= MIN && v <= MAX;
  return m && ok(+m[1]) && ok(+m[2]) ? { url, cols: +m[1], rows: +m[2] } : { url, cols: 0, rows: 0 };
}

// Google Photos share and album pages are web pages, not pictures, and can't be read from another site.
export const isPhotosPage = url => /^https:\/\/(photos\.app\.goo\.gl|photos\.google\.com|goo\.gl\/photos)\b/.test(url);
