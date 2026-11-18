// Offline support and updates: the shared part (install, update, cache cleanup, serving the app's files from the cache and
// refreshing them in the background) is /shared/sw-core.js on hodzic.github.io, used by all the apps there.
// Run `npm run bump` for every release: VERSION (the cache name) carries the app version, so installed copies get the update.
importScripts('/shared/sw-core.js');
const VERSION='photo-puzzle-2026-11-18a';
const ASSETS=[
  '/photo-puzzle/','/photo-puzzle/index.html','/photo-puzzle/manifest.webmanifest','/photo-puzzle/css/app.css',
  '/photo-puzzle/js/app.js','/photo-puzzle/js/puzzle.js','/photo-puzzle/js/share.js','/photo-puzzle/js/version.js','/photo-puzzle/js/updates.js',
  '/photo-puzzle/icons/icon.svg','/photo-puzzle/icons/icon-192.png','/photo-puzzle/icons/apple-touch-icon.png',
];

appWorker({
  cache:VERSION,
  own:k=>k.startsWith('photo-puzzle-'), // only this app's own old caches: the other apps on hodzic.github.io share this origin's storage
  shell:ASSETS,
  index:'/photo-puzzle/index.html',
  hosts:['fonts.googleapis.com','fonts.gstatic.com'],
});
