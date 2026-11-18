// Board model, pure. A board is an array of cols*rows cells, row by row; 0 is the gap and tile v belongs at index v-1,
// so the solved board is 1..n-1 followed by the gap in the bottom-right corner.

export const MIN = 2, MAX = 8;

export const solvedBoard = (cols, rows) => {
  const n = cols * rows;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? 0 : i + 1));
};

export const isSolved = b => b.every((v, i) => v === (i === b.length - 1 ? 0 : i + 1));

// Tiles that can move: any tile in the gap's row or column (the tiles between it and the gap move with it).
export function canSlide(b, cols, i) {
  const g = b.indexOf(0);
  if (i === g || i < 0 || i >= b.length) return false;
  return Math.floor(i / cols) === Math.floor(g / cols) || i % cols === g % cols;
}

// Slides tile i (and any tiles between it and the gap) toward the gap.
// Returns { board, moved } with moved = number of tiles that moved, or null if tile i can't move.
export function slide(b, cols, i) {
  if (!canSlide(b, cols, i)) return null;
  const board = b.slice(), g = b.indexOf(0);
  const step = Math.floor(i / cols) === Math.floor(g / cols) ? Math.sign(i - g) : Math.sign(i - g) * cols;
  let moved = 0;
  for (let p = g; p !== i; p += step) { board[p] = board[p + step]; moved++; }
  board[i] = 0;
  return { board, moved };
}

// Index of the tile that moves when an arrow key is pressed (the tile moves in the arrow's direction), or -1.
export function arrowSource(b, cols, rows, key) {
  const g = b.indexOf(0), r = Math.floor(g / cols), c = g % cols;
  switch (key) {
    case 'ArrowLeft': return c < cols - 1 ? g + 1 : -1;
    case 'ArrowRight': return c > 0 ? g - 1 : -1;
    case 'ArrowUp': return r < rows - 1 ? g + cols : -1;
    case 'ArrowDown': return r > 0 ? g - cols : -1;
    default: return -1;
  }
}

// Scrambles by a random walk of legal moves from the solved board, so the result is always solvable.
export function shuffle(cols, rows, rand = Math.random, steps = Math.max(300, cols * rows * 40)) {
  const b = solvedBoard(cols, rows);
  let g = b.length - 1, prev = -1;
  for (let k = 0; k < steps || isSolved(b); k++) {
    const r = Math.floor(g / cols), c = g % cols, opts = [];
    if (r > 0) opts.push(g - cols);
    if (r < rows - 1) opts.push(g + cols);
    if (c > 0) opts.push(g - 1);
    if (c < cols - 1) opts.push(g + 1);
    const fwd = opts.filter(o => o !== prev);
    const n = fwd[Math.floor(rand() * fwd.length)];
    b[g] = b[n]; b[n] = 0; prev = g; g = n;
  }
  return b;
}

export const isBoard = (b, cols, rows) =>
  Array.isArray(b) && b.length === cols * rows && new Set(b).size === b.length && b.every(v => Number.isInteger(v) && v >= 0 && v < b.length);

// Reachable from the solved board iff the permutation's parity equals the parity of the gap's distance from its home.
export function isSolvable(b, cols, rows) {
  if (!isBoard(b, cols, rows)) return false;
  const n = b.length, target = b.map(v => (v === 0 ? n - 1 : v - 1)); // target[i] = home index of the piece at i
  const seen = new Array(n).fill(false);
  let swaps = 0;
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = target[j]) { seen[j] = true; len++; }
    swaps += len - 1;
  }
  const g = b.indexOf(0);
  const dist = (rows - 1 - Math.floor(g / cols)) + (cols - 1 - (g % cols));
  return swaps % 2 === dist % 2;
}
