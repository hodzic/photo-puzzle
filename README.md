# Photo Puzzle

A sliding-tile puzzle (the classic "15 puzzle") in any size from 2×2 to 8×8, with numbered tiles or your own photo.
Share a puzzle as a link: whoever opens it gets the same scrambled board, photo included when it came from a web address.
Plain HTML/JS with ES modules, no build step, served from GitHub Pages at https://hodzic.github.io/photo-puzzle/.
Installs to a phone's home screen, works offline and updates itself.

## Run locally

```sh
npm run serve   # then open http://localhost:8000/photo-puzzle/ (paths are absolute, as on GitHub Pages); needs a checkout of hodzic.github.io next to this one, for /shared/
npm test        # board and share-link checks (Node 20+)
npm run bump    # before each release
```

## Layout

| Path | What |
| --- | --- |
| `index.html`, `css/app.css` | Page and styles (light/dark) |
| `js/puzzle.js` | Board model: slide a tile or a whole row/column, arrow keys, solvable shuffles, solvability check (pure, tested) |
| `js/share.js` | Share-link format (pure, tested) |
| `js/app.js` | UI: rendering, photos (file or web address), peek, timer, sharing, opening links |
| `sw.js`, `manifest.webmanifest`, `icons/`, `js/updates.js`, `js/version.js` | PWA. `sw.js` is the options for `/shared/sw-core.js`, and `js/updates.js` uses `/shared/update.js`: the offline and update code shared by the apps on [hodzic.github.io](https://github.com/hodzic/hodzic.github.io). Run `npm run bump` for each release: the version is the date (US Pacific) plus a letter per release that day, in `js/version.js` and the cache name in `sw.js`. Updates download in the background; a toast, or *Check for updates* at the bottom of the page, switches to them |

## Photos

A photo is centre-cropped to the board's shape with CSS (`tileBackground` in `js/puzzle.js`), not a canvas, so a photo
from another site works even when that site doesn't allow cross-origin reads. The page sends no referrer.

**From a web address** (*Photo link*): the address must be the picture itself. For Google Photos, open the photo and use
*Copy image address* (an `lh3.googleusercontent.com/...` address). Album and share links (`photos.app.goo.gl/...`) are web
pages that other sites can't read, so the app explains this instead. A link can also open the app with a web photo:

    https://hodzic.github.io/photo-puzzle/#photo=<address, URL-encoded>&size=4x5

`size` is optional (columns × rows, 2 to 8).

## Share links

The puzzle travels in the link's `#p=` fragment, which browsers never send to a server.
The fragment is base64url of: format version, columns, rows, flags (show numbers), image type, the scrambled board
(one byte per cell), then the photo's web address. Only puzzles with numbers or a web photo can be shared, which keeps
links short; a photo from the device stays on it. Older links that carry a compressed photo (image type WebP or JPEG)
still open.

Shuffles are random walks of legal moves, so every puzzle can be solved; a received board is checked for solvability.
