import test from 'node:test';
import assert from 'node:assert/strict';
import { solvedBoard, isSolved, slide, shuffle, isSolvable, arrowSource, canSlide } from '../js/puzzle.js';

const seeded = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);

test('solved board', () => {
  assert.deepEqual(solvedBoard(3, 2), [1, 2, 3, 4, 5, 0]);
  assert.ok(isSolved(solvedBoard(4, 5)));
});

test('slide moves a whole row or column', () => {
  const b = solvedBoard(4, 4); // gap at 15
  const r = slide(b, 4, 12);   // left end of the bottom row
  assert.equal(r.moved, 3);
  assert.deepEqual(r.board.slice(12), [0, 13, 14, 15]);
  const c = slide(b, 4, 3);    // top of the right column
  assert.equal(c.moved, 3);
  assert.deepEqual([c.board[3], c.board[7], c.board[11], c.board[15]], [0, 4, 8, 12]);
  assert.equal(slide(b, 4, 0), null);
  assert.equal(canSlide(b, 4, 15), false);
});

test('arrow keys move the tile next to the gap', () => {
  const b = solvedBoard(3, 3); // gap at 8
  assert.equal(arrowSource(b, 3, 3, 'ArrowRight'), 7);
  assert.equal(arrowSource(b, 3, 3, 'ArrowDown'), 5);
  assert.equal(arrowSource(b, 3, 3, 'ArrowLeft'), -1);
  assert.equal(arrowSource(b, 3, 3, 'ArrowUp'), -1);
});

test('shuffles are scrambled and solvable on every size', () => {
  for (let cols = 2; cols <= 8; cols++) for (let rows = 2; rows <= 8; rows++) {
    const b = shuffle(cols, rows, seeded(cols * 31 + rows));
    assert.equal(b.length, cols * rows);
    assert.ok(!isSolved(b));
    assert.ok(isSolvable(b, cols, rows), `${cols}x${rows}`);
  }
});

test('swapping two tiles makes a board unsolvable', () => {
  for (const [cols, rows] of [[4, 4], [3, 3], [4, 5], [5, 2]]) {
    const b = solvedBoard(cols, rows);
    [b[0], b[1]] = [b[1], b[0]];
    assert.equal(isSolvable(b, cols, rows), false);
  }
  assert.equal(isSolvable([1, 2, 3, 3], 2, 2), false);
});

import { tileBackground } from '../js/puzzle.js';
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

test('tile backgrounds: photo already the board shape', () => {
  const t = tileBackground(400, 500, 4, 5, 1, 2);
  assert.ok(near(t.size, [400, 500]));
  assert.ok(near(t.pos, [100 / 3, 50]));
});

test('tile backgrounds: wide photo is centre-cropped', () => {
  // 3x3 board, 900x300 photo: the crop is the middle 300x300, i.e. tiles 3..5 of 9 across
  const t = tileBackground(900, 300, 3, 3, 0, 0);
  assert.ok(near(t.size, [900, 300]));
  // offset of 3 tiles over a range of 8 tiles
  assert.ok(near(t.pos, [3 / 8 * 100, 0]));
  const last = tileBackground(900, 300, 3, 3, 2, 2);
  assert.ok(near(last.pos, [5 / 8 * 100, 100]));
});
