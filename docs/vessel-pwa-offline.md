# Vessel offline without Electron (PWA)

## Summary

Yes — **one online visit over HTTPS**, then **install to the device** (Progressive Web App). After that, the **app shell** loads offline via the service worker; **PMS/SPARE data** stays in **IndexedDB** on that browser profile (same as localhost / Electron renderer).

This is **not** a replacement for **seat-licensed Electron** on the bridge PC pool, but it is a practical option for tablets, backup browsers, or trials when installers are not available.

## Station PC — separate database per mode (no seat license)

Each physical station PC should use its **own entry URL** once (online), then install the PWA from that page:

| PC | Open once (online) | IndexedDB name (conceptually) |
|----|----------------------|-------------------------------|
| Captain hub | `/station-captain.html` | `tvc_pms_v2_stn_captain` |
| Engine room | `/station-engine.html` | `tvc_pms_v2_stn_engine` |
| Deck | `/station-deck.html` | `tvc_pms_v2_stn_deck` |

The link **locks** that browser profile to one station. Department on login is fixed (Captain / Engine / Deck). **Seat license is not used** in the browser path.

Do not use the generic home URL on all three PCs — they would share one database. SM superintendent use stays on the normal URL (no station lock) or a separate browser profile.

Implementation: `js/stationProfile.js` (runs before `schema.js` / `db.js`).

## How to use

1. On each station PC, open the matching **station link** above (or login screen buttons **Captain PC / Engine PC / Deck PC**).  
   For generic SM browsing, open `https://app.thevesselcode.com/` **directly** (not inside the SM iframe).  
   - Embedded SM portal (`?embed=1`) intentionally **does not** register the service worker (avoids stale cache for shore users).
2. Stay **online** until the page finishes loading (service worker installs and precaches the shell).
3. **Install**:
   - **Chrome / Edge (desktop)**: “Install app” in the address bar, or **Install for offline (browser)** on the login screen when shown.
   - **Android Chrome**: menu → Install app / Add to Home screen.
   - **iOS Safari**: Share → **Add to Home Screen** (no `beforeinstallprompt`; use the hint button on login).
4. Sign in once (demo ship accounts + Department). Data is stored locally.
5. Go **offline** — reopen from the home-screen / installed icon. You should see **Offline mode — local data available**.

## Limits

| Topic | PWA (browser) | Electron Vessel Mode |
|--------|----------------|----------------------|
| Seat license enforcement | No (browser / station entry) | Yes |
| Separate IndexedDB per Captain/Engine/Deck | Yes — via `station-*.html` entry per PC | Per-install userData (Electron SKU) |
| ZIP sync | Yes (Export/Import) | Yes |
| App Update ZIP installers | No | Yes |
| `file://` | Not supported | N/A |

Occasional **online** access is still needed to pick up **new JS/CSS** (service worker update). Operational data remains in IndexedDB offline.

## Developers

- Service worker: `service-worker.js` (app shell precache).
- Bootstrap: `js/pwa.js` — registers SW when `TVC_Config.isVesselOfflinePwaEligible()` is true.
- Force off: `?pwa=0` on web deploy hosts. Force on in edge cases: `?pwa=1`.

Local test: `npm start` → `http://localhost:3000` → install from Chrome.
