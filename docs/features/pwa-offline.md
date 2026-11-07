# PWA and offline behaviour

## Purpose
Coaches install the app on their phones. The app is named Cadence Lanes; theme and background colour are forest green `#10332c`. Fonts are bundled and precached with the shell (`woff2` is in the workbox glob). Everything needs the internet: when offline the app opens and shows a red blocking screen telling the user to connect. No data is cached and nothing can be entered offline.

## Behaviour
- Built with `vite-plugin-pwa` (`frontend/vite.config.js`). Manifest: name SwimAcademy, `display: standalone`, theme `#1e293b`, icons in `frontend/public` (192, 512, maskable 512, `apple-touch-icon.png`; these are placeholders to replace with real artwork). `index.html` carries the mobile and iOS meta tags.
- Service worker (`registerType: autoUpdate`): precaches the built app files only, serves `index.html` for navigations except `/api/*`, no runtime caching, so no API response is ever stored. Old caches are cleaned up.
- `frontend/src/components/OfflineScreen.jsx` is rendered by `App.jsx` above the routes. It listens to the browser `online`/`offline` events and `navigator.onLine`; when offline it shows a full-screen red `role="alert"` screen with "You are offline. Connect to the internet to use SwimAcademy." and removes it when back online.
- Backend (`backend/main.py`, static serving only when `backend/static` exists): `index.html`, `sw.js`, the manifest and other root files are sent `Cache-Control: no-cache`; `/assets/*` (content-hashed) are `public, max-age=31536000, immutable`. This lets a deploy reach installed apps.
- Production Caddy (`clap-deploy/proxy/Caddyfile`) exempts `/manifest.webmanifest`, `/sw.js`, `/registerSW.js`, `/workbox-*.js`, `/icon-*.png` and `/apple-touch-icon.png` from basic auth, because browsers fetch them without credentials.

## Where it lives
`frontend/vite.config.js`, `frontend/index.html`, `frontend/public/`, `frontend/src/components/OfflineScreen.jsx`, `backend/main.py`, `clap-deploy/proxy/Caddyfile`.
Tests: `frontend/src/components/OfflineScreen.test.jsx`. The service worker itself is not covered by automated tests.

## Gotchas
- The service worker is not registered in vitest (separate `vitest.config.js` without the PWA plugin).
- `navigator.onLine` can say "online" on a network with no real internet; API calls then fail and the pages show their own errors.
- iOS has no install prompt: users add it with Share, then Add to Home Screen. On iOS the installed app has storage separate from Safari, so users log in again after installing.
- Registration of the service worker could not be verified in the Claude built-in browser; verify on a real phone or Chrome DevTools, Application, Service Workers.
