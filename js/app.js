// UI: board rendering, input, photos and share links. Board logic is in puzzle.js, the link format in share.js.

import { MIN, MAX, isSolved, slide, shuffle, canSlide, arrowSource, tileBackground } from './puzzle.js';
import { encodeShare, decodeShare, codeFromHash, photoFromHash, isPhotosPage, isWebUrl, HASH_KEY } from './share.js';
import { APP_VERSION } from './version.js';
import { registerUpdates, checkForUpdate, applyUpdate } from './updates.js';

const $ = id => document.getElementById(id);
const frame = $('frame'), board = $('board'), peek = $('peek');


const S = {
  cols: 4, rows: 4,
  board: [], startBoard: [],
  moves: 0, start: 0, timer: 0, playing: false,
  photo: null,       // { url, img, w, h, web } web: the photo is on another site (url is its address), else url is a blob: URL
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
function syncControls() { $('cols').value = S.cols; $('rows').value = S.rows; $('numbers').checked = S.numbers; }
function forgetLink() { if (location.hash) history.replaceState(null, '', location.pathname + location.search); }

// ---------- board ----------

function buildTiles() {
  board.classList.add('instant'); // new tiles jump to their places instead of sliding in from the corner
  requestAnimationFrame(() => requestAnimationFrame(() => board.classList.remove('instant')));
  S.tiles.forEach(t => t.remove());
  S.tiles = [];
  const n = S.cols * S.rows, p = S.photo;
  frame.style.setProperty('--cols', S.cols);
  frame.style.setProperty('--rows', S.rows);
  if (p) { board.style.setProperty('--img', `url("${p.url.replace(/["\\]/g, '\\$&')}")`); peek.src = p.url; }
  else { board.style.removeProperty('--img'); peek.removeAttribute('src'); }
  for (let v = 1; v <= n; v++) {
    const t = document.createElement('button');
    t.className = 'tile' + (v % 2 ? ' odd' : '') + (v === n ? ' last' : '');
    t.innerHTML = `<span class="face"><span>${v}</span></span>`;
    if (p) {
      const bg = tileBackground(p.w, p.h, S.cols, S.rows, (v - 1) % S.cols, Math.floor((v - 1) / S.cols));
      t.firstChild.style.backgroundSize = `${bg.size[0]}% ${bg.size[1]}%`;
      t.firstChild.style.backgroundPosition = `${bg.pos[0]}% ${bg.pos[1]}%`;
    }
    if (v === n) { t.tabIndex = -1; t.setAttribute('aria-hidden', 'true'); }
    else { t.setAttribute('aria-label', 'Tile ' + v); t.addEventListener('click', () => move(S.board.indexOf(v))); }
    board.appendChild(t);
    S.tiles[v] = t;
  }
  S.tiles[n].style.transform = place(n - 1);
  $('photoText').textContent = p ? 'New photo' : 'Your photo';
  $('photoOpts').hidden = $('peekBtn').hidden = !p;
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
  board.classList.toggle('photo', !!S.photo);
  board.classList.toggle('numbers', S.numbers);
  board.classList.toggle('won', isSolved(S.board));
}

function newGame(start) {
  buildTiles();
  S.board = start ? start.slice() : shuffle(S.cols, S.rows);
  S.startBoard = S.board.slice();
  S.moves = 0; S.playing = true; S.start = 0;
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
    say(`Solved in ${S.moves} ${S.moves === 1 ? 'move' : 'moves'} and ${$('time').textContent}.`, true);
  }
}

function tick() {
  if (!S.start) return;
  const s = Math.floor((Date.now() - S.start) / 1000);
  $('time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function stopTimer() { clearInterval(S.timer); S.timer = 0; }

function say(text, good = false) { const m = $('msg'); m.textContent = text; m.classList.toggle('good', good); }

let toastTimer = 0;
function toast(text, { ms = 4000, onTap = null } = {}) {
  const t = $('toast');
  t.textContent = text; t.hidden = false;
  t.onclick = () => { t.hidden = true; onTap?.(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

document.addEventListener('keydown', e => {
  if (!e.key.startsWith('Arrow') || e.target.closest('select, input, label, form')) return;
  e.preventDefault();
  const src = arrowSource(S.board, S.cols, S.rows, e.key);
  if (src >= 0) move(src);
});

// ---------- photos ----------

function loadImg(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => (img.naturalWidth ? res(img) : rej(new Error('empty')));
    img.onerror = () => rej(new Error('load'));
    img.src = url;
  });
}

// Sets the photo; resolves to true, or false (with a message) when it won't open.
async function setPhoto(src, web) {
  if (web && isPhotosPage(src)) {
    say('That is a Google Photos page, not the picture itself. Open the photo, right-click it (long-press on a phone), choose Copy image address, and paste that.');
    return false;
  }
  try {
    const img = await loadImg(src);
    if (S.photo && !S.photo.web) URL.revokeObjectURL(S.photo.url);
    S.photo = { url: src, img, w: img.naturalWidth, h: img.naturalHeight, web };
    return true;
  } catch {
    if (!web) URL.revokeObjectURL(src);
    say(web
      ? 'That address didn\'t open as a picture. It needs to be the address of the image itself (often ending in .jpg or .png), on a site that lets anyone see it.'
      : 'That file could not be opened as a picture. Try a JPEG or PNG.');
    return false;
  }
}

function clearPhoto() {
  if (S.photo && !S.photo.web) URL.revokeObjectURL(S.photo.url);
  S.photo = null;
}

$('photo').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  say('');
  if (!await setPhoto(URL.createObjectURL(file), false)) return;
  forgetLink();
  newGame();
});
$('photoLabel').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('photo').click(); }
});

$('urlBtn').addEventListener('click', () => {
  const f = $('urlForm'), open = f.hidden;
  f.hidden = !open;
  $('urlBtn').setAttribute('aria-expanded', open);
  if (open) $('url').focus();
});
$('urlForm').addEventListener('submit', async e => {
  e.preventDefault();
  const url = $('url').value.trim();
  if (!isWebUrl(url)) { say('Enter a web address starting with https://'); return; }
  say('Opening the photo…');
  if (!await setPhoto(url, true)) return;
  say('');
  $('urlForm').hidden = true; $('urlBtn').setAttribute('aria-expanded', 'false');
  forgetLink();
  newGame();
});

$('clearPhoto').addEventListener('click', () => { clearPhoto(); forgetLink(); say(''); newGame(); });
$('numbers').addEventListener('change', e => { S.numbers = e.target.checked; saveSettings(); render(); });

// Hold to see the whole picture.
const peekOn = () => { if (S.photo) peek.hidden = false; };
const peekOff = () => { peek.hidden = true; };
const pb = $('peekBtn');
pb.addEventListener('pointerdown', e => { pb.setPointerCapture?.(e.pointerId); peekOn(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) pb.addEventListener(ev, peekOff);
pb.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); peekOn(); } });
pb.addEventListener('keyup', peekOff);
pb.addEventListener('contextmenu', e => e.preventDefault());

// ---------- size and shuffle ----------

function setSize() {
  S.cols = clampSize($('cols').value);
  S.rows = clampSize($('rows').value);
  saveSettings(); forgetLink(); say('');
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
    const opts = { cols: S.cols, rows: S.rows, board: S.startBoard, numbers: S.numbers };
    if (S.photo && !S.photo.web) {
      say('A photo from this device can\'t be shared. To share a photo puzzle, open the photo with Photo link.');
      return;
    }
    if (S.photo) opts.imageUrl = S.photo.url;
    const url = location.origin + location.pathname + '#' + HASH_KEY + encodeShare(opts);
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
      say(`Link copied (${Math.ceil(url.length / 1024)} KB). Paste it into a message or email.`);
    } catch {
      say('');
      $('link').value = url;
      $('linkbox').hidden = false;
      $('link').focus(); $('link').select();
    }
  } catch {
    say('The link could not be made. Try again.');
  } finally {
    btn.disabled = false;
  }
});
$('link').addEventListener('focus', e => e.target.select());

// ---------- links into the app ----------

// A shared puzzle: #p=<code>
async function openShared(code) {
  let d;
  try { d = decodeShare(code); } catch (e) { say(e.message + ' Here is a new puzzle instead.'); return false; }
  S.cols = d.cols; S.rows = d.rows; S.numbers = d.numbers;
  saveSettings(); // the next new puzzle keeps this size, not the size the viewer last chose
  clearPhoto();
  say('');
  if (d.imageUrl) {
    if (!await setPhoto(d.imageUrl, true)) say('The photo in this link is no longer available, so the puzzle uses numbers.');
  } else if (d.image) {
    // links made before sharing needed a web photo carry the photo itself
    if (!await setPhoto(URL.createObjectURL(new Blob([d.image], { type: d.imageType })), false)) say('The photo in this link could not be opened, so the puzzle uses numbers.');
  }
  syncControls();
  newGame(d.board);
  if (!$('msg').textContent) say(`Someone sent you this ${d.cols} × ${d.rows} puzzle. Slide the tiles to put ${S.photo ? 'the picture' : 'the numbers'} back in order.`);
  return true;
}

// A new puzzle from a web photo: #photo=<address>[&size=4x5]
async function openPhotoLink(p) {
  say('Opening the photo…');
  if (!await setPhoto(p.url, true)) return false;
  say('');
  if (p.cols) { S.cols = p.cols; S.rows = p.rows; saveSettings(); }
  syncControls();
  newGame();
  return true;
}

async function openHash() {
  const code = codeFromHash(location.hash), photo = photoFromHash(location.hash);
  if (code) return openShared(code);
  if (photo) return openPhotoLink(photo);
  return false;
}
window.addEventListener('hashchange', openHash);

// ---------- start ----------

$('version').textContent = APP_VERSION;
$('checkUpdate').addEventListener('click', async () => {
  const r = await checkForUpdate();
  toast({ ready: 'A new version is ready. Tap here to switch to it.', downloading: 'A new version is downloading. You\'ll be asked to switch when it\'s ready.',
          current: 'You have the latest version.', failed: 'Couldn\'t check for updates. Are you online?',
          none: 'Updates aren\'t available in this browser.' }[r], { ms: r === 'ready' ? 15000 : 4000, onTap: r === 'ready' ? applyUpdate : null });
});
registerUpdates(() => toast('A new version is ready. Tap here to update.', { ms: 15000, onTap: applyUpdate }));

(async () => {
  syncControls();
  if (await openHash()) return;
  if (location.hash) forgetLink();
  syncControls();
  newGame();
})();
