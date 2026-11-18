// Updates: a new version downloads in the background and waits; a toast (or Check for updates at the bottom of the page)
// switches to it and reloads. The mechanics are /shared/update.js on hodzic.github.io, shared by the apps there
// (loaded on its own, so the app still runs without it).
let m = null;
const load = import('/shared/update.js').then(x => (m = x)).catch(() => null);
export const applyUpdate = () => m?.applyUpdate();
// Check now. Resolves to 'ready', 'downloading', 'current', 'failed' or 'none' (no service worker).
export const checkForUpdate = async () => ((await load) ? m.checkForUpdate() : 'none');
export function registerUpdates(onReady) {
  load.then(x => x?.registerUpdates('/photo-puzzle/sw.js', onReady));
}
