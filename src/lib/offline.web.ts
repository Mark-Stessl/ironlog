// Registers the service worker (public/sw.js) that keeps a copy of Ironlog in the
// browser, so the home-screen app opens without internet.
export function keepOfflineCopy(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (location.hostname === 'localhost' && location.port === '8081') return; // dev server
  const base = location.pathname.startsWith('/ironlog') ? '/ironlog/' : '/';
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {});
}
