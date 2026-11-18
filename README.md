# Photo Puzzle

A sliding-tile puzzle (the classic "15 puzzle") in any size from 2×2 to 8×8, with numbered tiles or your own photo.
Share a puzzle as a link: whoever opens it gets the same scrambled board, photo included.
Plain HTML/JS with ES modules, no build step; runs on GitHub Pages.

## Run locally

```sh
npm run serve   # then open http://localhost:8000/
npm test        # board and share-link checks (Node 20+)
```

## Layout

| Path | What |
| --- | --- |
| `index.html`, `css/app.css` | Page and styles (light/dark) |
| `js/puzzle.js` | Board model: slide a tile or a whole row/column, arrow keys, solvable shuffles, solvability check (pure, tested) |
| `js/share.js` | Share-link format (pure, tested) |
| `js/app.js` | UI: rendering, photo upload and cropping, peek, timer, sharing, opening a shared link |

## Share links

The puzzle travels in the link's `#p=` fragment, which browsers never send to a server, so photos are not uploaded anywhere.
The fragment is base64url of: format version, columns, rows, flags (show numbers), image type, the scrambled board
(one byte per cell), then the photo bytes. The photo is centre-cropped to the board's shape and compressed to WebP
(JPEG where the browser can't make WebP) at 24 KB or less, so a link is at most about 32 KB long. Browsers and most
messaging apps handle that; SMS and some chat apps may cut long links short.

Shuffles are random walks of legal moves, so every puzzle can be solved; a received board is checked for solvability.
