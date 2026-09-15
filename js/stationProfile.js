/* THE VESSEL CODE — Browser station profile (separate IndexedDB per Captain/Engine/Deck PC) */
const TVC_StationProfile = (function () {
    const PROFILE_KEY = 'tvc_station_db_profile';
    const DB_BASE = 'tvc_pms_v2';

    const PROFILES = {
        captain: { loginMode: 'MASTER', label: 'Captain station PC', dbSuffix: 'stn_captain' },
        engine: { loginMode: 'ENGINE', label: 'Engine station PC', dbSuffix: 'stn_engine' },
        deck: { loginMode: 'DECK', label: 'Deck station PC', dbSuffix: 'stn_deck' },
    };

    const ALIASES = {
        MASTER: 'captain',
        CAPTAIN: 'captain',
        ENGINE: 'engine',
        DECK: 'deck',
    };

    function isElectron() {
        try {
            if (typeof TVC_Config !== 'undefined' && TVC_Config.isElectron?.()) return true;
        } catch (_) {}
        return !!(typeof window !== 'undefined' && window.tvcElectron?.isElectron);
    }

    function normalizeProfileInput(raw) {
        const s = String(raw || '').trim().toLowerCase();
        if (PROFILES[s]) return s;
        const up = String(raw || '').trim().toUpperCase();
        return ALIASES[up] || null;
    }

    function getProfile() {
        if (isElectron()) return null;
        try {
            const locked = localStorage.getItem(PROFILE_KEY);
            return PROFILES[locked] ? locked : null;
        } catch (_) {
            return null;
        }
    }

    function lockProfile(id) {
        if (isElectron()) return { ok: false, error: 'electron' };
        const p = normalizeProfileInput(id);
        if (!p) return { ok: false, error: 'invalid' };
        const existing = getProfile();
        if (existing && existing !== p) {
            return { ok: false, error: 'profile_locked', existing, requested: p };
        }
        try { localStorage.setItem(PROFILE_KEY, p); } catch (_) {}
        return { ok: true, profile: p };
    }

    function applyFromUrl() {
        if (isElectron()) return null;
        try {
            const q = new URLSearchParams(location.search);
            const raw = q.get('station') || q.get('profile') || q.get('stn');
            if (!raw) return null;
            return lockProfile(raw);
        } catch (_) {
            return null;
        }
    }

    function getDbName() {
        const p = getProfile();
        if (!p) return DB_BASE;
        return `${DB_BASE}_${PROFILES[p].dbSuffix}`;
    }

    function getLoginMode() {
        const p = getProfile();
        return p ? PROFILES[p].loginMode : null;
    }

    function getLabel() {
        const p = getProfile();
        return p ? PROFILES[p].label : null;
    }

    function getStorageSuffix() {
        const p = getProfile();
        return p ? `_stn_${p}` : '';
    }

    function isStationLocked() {
        return !!getProfile();
    }

    function entryPath(profileId) {
        const p = normalizeProfileInput(profileId);
        if (!p) return '/index.html';
        return `/station-${p}.html`;
    }

    let _urlLockWarning = null;

    function getUrlLockWarning() {
        return _urlLockWarning;
    }

    (function runUrlLock() {
        if (isElectron()) return;
        try {
            const q = new URLSearchParams(location.search);
            const raw = q.get('station') || q.get('profile') || q.get('stn');
            if (!raw) return;
            const r = lockProfile(raw);
            if (r?.error === 'profile_locked') {
                _urlLockWarning = `This browser is already set up as ${PROFILES[r.existing].label}. Use that station entry or clear site data to switch.`;
            }
        } catch (_) {}
    })();

    return {
        PROFILES,
        getProfile,
        lockProfile,
        getDbName,
        getLoginMode,
        getLabel,
        getStorageSuffix,
        isStationLocked,
        normalizeProfileInput,
        applyFromUrl,
        getUrlLockWarning,
        entryPath,
        isElectron,
    };
})();
if (typeof window !== 'undefined') window.TVC_StationProfile = TVC_StationProfile;
