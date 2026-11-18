// UI: board rendering, input, photos and share links. Board logic is in puzzle.js, the link format in share.js.

import { MIN, MAX, solvedBoard, isSolved, slide, shuffle, canSlide, arrowSource } from './puzzle.js';
import { encodeShare, decodeShare, codeFromHash, HASH_KEY } from './share.js';

const $ = id => document.getElementById(id);
const frame = $('frame'), board = $('board'), peek = $('peek');

const SHARE_LIMIT = 24000;  // bytes of photo in a share link; about 32 KB of link text
const DISPLAY_SIDE = 1400;  // longest side of the photo shown on this device

const S = {
  cols: 4, rows: 4,
  board: [], startBoard: [],
  moves: 0, start: 0, timer: 0, playing: false,
  source: null,        // the photo (ImageBitmap or <img>), uncropped
  displayUrl: '',      // object URL of the photo cropped to the board's shape
  shareCache: null,    // { key: '4x4', bytes, type } compressed photo for links
  numbers: false,
  tiles: [],
};

// ---------- settings ----------

for (const id of ['cols', 'rows']) {
  const sel = $(id);
  for (let k = MIN; k <= MAX; k++) sel.add(new Option(k, k));
}
try {
  const saved = JSON.parse(localStorage.getItem('photo-puzzle-settings') || 'null');
  if (saved) { S.cols = clampSize(saved.cols); S.rows = clampSize(saved.rows); S.numbers = !!saved.numbers; }
} catch {}

function clampSize(v) { v = parseInt(v, 10); return Number.isInteger(v) ? Math.min(MAX, Math.max(MIN, v)) : 4; }
function saveSettings() {
  try { localStorage.setItem('photo-puzzle-settings', JSON.stringify({ cols: S.cols, rows: S.rows, numbers: S.numbers })); } catch {}
}
function forgetLink() {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

// ---------- board ----------

function buildTiles() {
  board.classList.add('instant'); // new tiles jump to their places instead of sliding in from the corner
  requestAnimationFrame(() => requestAnimationFrame(() => board.classList.remove('instant')));
  S.tiles.forEach(t => t.remove());
  S.tiles = [];
  const n = S.cols * S.rows;
  frame.style.setProperty('--cols', S.cols);
  frame.style.setProperty('--rows', S.rows);
  for (let v = 1; v <= n; v++) {
    const t = document.createElement('button');
    const home = v - 1, hc = home % S.cols, hr = Math.floor(home / S.cols);
    t.className = 'tile' + (v % 2 ? ' odd' : '') + (v === n ? ' last' : '');
    t.innerHTML = `<span class="face"><span>${v}</span></span>`;
    t.firstChild.style.backgroundPosition =
      `${S.cols > 1 ? (hc / (S.cols - 1)) * 100 : 0}% ${S.rows > 1 ? (hr / (S.rows - 1)) * 100 : 0}%`;
    if (v === n) { t.tabIndex = -1; t.setAttribute('aria-hidden', 'true'); }
    else { t.setAttribute('aria-label', 'Tile ' + v); t.addEventListener('click', () => move(S.board.indexOf(v))); }
    board.appendChild(t);
    S.tiles[v] = t;
  }
  S.tiles[n].style.transform = place(n - 1);
}

const place = i => `translate(${(i % S.cols) * 100}%, ${Math.floor(i / S.cols) * 100}%)`;

function render() {
  S.board.forEach((v, i) => {
    if (!v) return;
    const t = S.tiles[v];
    t.style.transform = place(i);
    t.classList.toggle('stuck', !canSlide(S.board, S.cols, i));
  });
  $('moves').textContent = S.moves;
  board.classList.toggle('photo', !!S.source);
  board.classList.toggle('numbers', S.numbers);
  board.classList.toggle('won', isSolved(S.board));
}

function newGame(start) {
  S.board = start ? start.slice() : shuffle(S.cols, S.rows);
  S.startBoard = S.board.slice();
  S.moves = 0; S.playing = true;
  stopTimer();
  $('time').textContent = '0:00';
  render();
}

function move(i) {
  if (!S.playing) return;
  const r = slide(S.board, S.cols, i);
  if (!r) return;
  S.board = r.board; S.moves += r.moved;
  if (!S.timer) { S.start = Date.now(); S.timer = setInterval(tick, 250); }
  render();
  if (isSolved(S.board)) {
    S.playing = false; stopTimer(); tick();
    say(`Solved in ${S.moves} moves and ${$('time').textContent}.`, true);
  }
}

function tick() {
  if (!S.start) return;
  const s = Math.floor((Date.now() - S.start) / 1000);
  $('time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function stopTimer() { clearInterval(S.timer); S.timer = 0; }

function say(text, good = false) { const m = $('msg'); m.textContent = text; m.classList.toggle('good', good); }

document.addEventListener('keydown', e => {
  if (e.target.closest('select, input, label')) return;
  const src = arrowSource(S.board, S.cols, S.rows, e.key);
  if (!e.key.startsWith('Arrow')) return;
  e.preventDefault();
  if (src >= 0) move(src);
});

// ---------- photos ----------

async function loadImage(blob) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch {}
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}

const srcSize = src => [src.naturalWidth || src.width, src.naturalHeight || src.height];

// Centre-crops the photo to the board's shape, longest side at most maxSide.
function crop(src, cols, rows, maxSide) {
  const [sw, sh] = srcSize(src), ar = cols / rows;
  let cw = sw, ch = sw / ar;
  if (ch > sh) { ch = sh; cw = sh * ar; }
  const scale = Math.min(1, maxSide / Math.max(cw, ch));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(cw * scale));
  c.height = Math.max(1, Math.round(ch * scale));
  c.getContext('2d').drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, c.width, c.height);
  return c;
}

const toBlob = (canvas, type, q) => new Promise(res => canvas.toBlob(res, type, q));

async function showPhoto() {
  if (S.displayUrl) URL.revokeObjectURL(S.displayUrl);
  S.displayUrl = '';
  if (S.source) {
    const blob = await toBlob(crop(S.source, S.cols, S.rows, DISPLAY_SIDE), 'image/jpeg', 0.9);
    S.displayUrl = URL.createObjectURL(blob);
    board.style.setProperty('--img', `url("${S.displayUrl}")`);
    peek.src = S.displayUrl;
  } else {
    board.style.removeProperty('--img');
    peek.removeAttribute('src');
  }
  $('photoText').textContent = S.source ? 'Change photo' : 'Use a photo';
  $('clearPhoto').hidden = $('numbersWrap').hidden = $('peekBtn').hidden = !S.source;
  render();
}

// The photo, small enough for a link: WebP where the browser can make it, else JPEG.
async function sharePhoto() {
  const key = `${S.cols}x${S.rows}`;
  if (S.shareCache?.key === key) return S.shareCache;
  let best = null;
  outer: for (const side of [560, 460, 380, 300, 240]) {
    const c = crop(S.source, S.cols, S.rows, side);
    for (const q of [0.7, 0.55, 0.42]) {
      let blob = await toBlob(c, 'image/webp', q);
      if (!blob || blob.type !== 'image/webp') blob = await toBlob(c, 'image/jpeg', q);
      best = blob;
      if (blob.size <= SHARE_LIMIT) break outer;
    }
  }
  S.shareCache = { key, bytes: new Uint8Array(await best.arrayBuffer()), type: best.type };
  return S.shareCache;
}

$('photo').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    S.source = await loadImage(file);
  } catch {
    say('That file could not be opened as a picture. Try a JPEG or PNG.');
    return;
  }
  S.shareCache = null;
  forgetLink();
  say('');
  await showPhoto();
  newGame();
});
$('photoLabel').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('photo').click(); }
});
$('clearPhoto').addEventListener('click', async () => {
  S.source = null; S.shareCache = null;
  forgetLink(); say('');
  await showPhoto();
});
$('numbers').addEventListener('change', e => { S.numbers = e.target.checked; saveSettings(); render(); });

// Hold to see the whole picture.
const peekOn = () => { if (S.source) peek.hidden = false; };
const peekOff = () => { peek.hidden = true; };
const pb = $('peekBtn');
pb.addEventListener('pointerdown', e => { pb.setPointerCapture?.(e.pointerId); peekOn(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) pb.addEventListener(ev, peekOff);
pb.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); peekOn(); } });
pb.addEventListener('keyup', peekOff);
pb.addEventListener('contextmenu', e => e.preventDefault());

// ---------- size and shuffle ----------

async function setSize() {
  S.cols = clampSize($('cols').value);
  S.rows = clampSize($('rows').value);
  saveSettings(); forgetLink(); say('');
  buildTiles();
  if (S.source) await showPhoto();
  newGame();
}
$('cols').addEventListener('change', setSize);
$('rows').addEventListener('change', setSize);
$('shuffle').addEventListener('click', () => { forgetLink(); say(''); newGame(); });

// ---------- share ----------

$('share').addEventListener('click', async () => {
  const btn = $('share');
  btn.disabled = true;
  $('linkbox').hidden = true;
  try {
    let image = null, imageType = '';
    if (S.source) { say('Preparing the photo…'); ({ bytes: image, type: imageType } = await sharePhoto()); }
    const code = encodeShare({ cols: S.cols, rows: S.rows, board: S.startBoard, numbers: S.numbers, image, imageType });
    const url = location.origin + location.pathname + '#' + HASH_KEY + code;
    const kb = Math.ceil(url.length / 1024);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Photo Puzzle', text: 'Can you solve this puzzle?', url });
        say('Shared.');
        return;
      } catch (e) {
        if (e.name === 'AbortError') { say(''); return; }
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      say(`Link copied (${kb} KB). Paste it into a message or email.`);
    } catch {
      say('');
      $('link').value = url;
      $('linkbox').hidden = false;
      $('link').focus(); $('link').select();
    }
  } catch {
    say('The link could not be made. Try again, or try a different photo.');
  } finally {
    btn.disabled = false;
  }
});
$('link').addEventListener('focus', e => e.target.select());

// ---------- start ----------

async function openLink(code) {
  let d;
  try { d = decodeShare(code); } catch (e) { say(e.message + ' Here is a new puzzle instead.'); return false; }
  S.cols = d.cols; S.rows = d.rows; S.numbers = d.numbers;
  S.source = null; S.shareCache = null;
  if (d.image) {
    try {
      S.source = await loadImage(new Blob([d.image], { type: d.imageType }));
      S.shareCache = { key: `${d.cols}x${d.rows}`, bytes: d.image, type: d.imageType };
    } catch { say('The photo in this link could not be opened, so the puzzle uses numbers.'); }
  }
  syncControls();
  buildTiles();
  await showPhoto();
  newGame(d.board);
  if (!$('msg').textContent) say(`Someone sent you this ${d.cols} × ${d.rows} puzzle. Slide the tiles to put ${d.image ? 'the picture' : 'the numbers'} back in order.`);
  return true;
}

function syncControls() {
  $('cols').value = S.cols; $('rows').value = S.rows; $('numbers').checked = S.numbers;
}

window.addEventListener('hashchange', () => {
  const code = codeFromHash(location.hash);
  if (code) openLink(code);
});

(async () => {
  const code = codeFromHash(location.hash);
  if (code && await openLink(code)) return;
  forgetLink();
  syncControls();
  buildTiles();
  await showPhoto();
  newGame();
})();
