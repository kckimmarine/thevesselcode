/* IMPA plate on-demand loader — CacheStorage LRU (max 50) */
const TVC_PlateImageCache = (function () {
    const CACHE_NAME = 'tvc-impa-plates-lru';
    const LRU_KEY = 'tvc_plate_lru_order_v1';
    const MAX_ENTRIES = 50;
    const BERTH_INDEX_URL = '/data/berth-impa-index.json';
    const PRODUCT_PHOTO_INDEX_URL = '/data/impa-product-photos.json';
    const PRODUCT_PHOTO_BASE = '/data/product-photos';

    let _berthIndex = null;
    let _berthIndexPromise = null;
    let _productPhotoIndex = null;
    let _productPhotoIndexPromise = null;

    function readLru() {
        try {
            const raw = localStorage.getItem(LRU_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function writeLru(order) {
        try {
            localStorage.setItem(LRU_KEY, JSON.stringify(order));
        } catch { /* quota */ }
    }

    async function openCache() {
        if (!('caches' in window)) return null;
        try {
            return await caches.open(CACHE_NAME);
        } catch {
            return null;
        }
    }

    function assetUrl(plateId) {
        return TVC_ImpaSchema.resolvePlateAssetUrl(plateId);
    }

    async function loadBerthIndex() {
        if (_berthIndex) return _berthIndex;
        if (_berthIndexPromise) return _berthIndexPromise;
        _berthIndexPromise = fetch(BERTH_INDEX_URL, { cache: 'no-store' })
            .then(res => (res.ok ? res.json() : { codes: {} }))
            .then(data => {
                _berthIndex = data?.codes && typeof data.codes === 'object' ? data.codes : {};
                return _berthIndex;
            })
            .catch(() => {
                _berthIndex = {};
                return _berthIndex;
            });
        return _berthIndexPromise;
    }

    async function resolveBerthPlateId(impaCode) {
        const code = String(impaCode || '').replace(/\D/g, '').padStart(6, '0');
        if (!code || code === '000000') return '';
        const index = await loadBerthIndex();
        return index[code] || index[String(impaCode || '').trim()] || '';
    }

    async function loadProductPhotoIndex() {
        if (_productPhotoIndex) return _productPhotoIndex;
        if (_productPhotoIndexPromise) return _productPhotoIndexPromise;
        _productPhotoIndexPromise = fetch(PRODUCT_PHOTO_INDEX_URL, { cache: 'no-store' })
            .then(res => (res.ok ? res.json() : { photos: {} }))
            .then(data => {
                _productPhotoIndex = data?.photos && typeof data.photos === 'object' ? data.photos : {};
                return _productPhotoIndex;
            })
            .catch(() => {
                _productPhotoIndex = {};
                return _productPhotoIndex;
            });
        return _productPhotoIndexPromise;
    }

    function productPhotoEntry(index, impaCode) {
        const code = String(impaCode || '').replace(/\D/g, '').padStart(6, '0');
        if (!code || code === '000000') return null;
        const entry = index[code];
        if (!entry || typeof entry !== 'object') return null;
        const file = String(entry.file || '').trim();
        if (!file || /[/\\]/.test(file)) return null;
        const photoUrl = String(entry.photo_url || '').trim() || `${PRODUCT_PHOTO_BASE}/${file}`;
        return { ...entry, file, photo_url: photoUrl };
    }

    async function resolveProductPhotoUrl(impaCode) {
        const index = await loadProductPhotoIndex();
        const entry = productPhotoEntry(index, impaCode);
        return entry?.photo_url || '';
    }

    async function resolveProductPhotoMeta(impaCode) {
        const index = await loadProductPhotoIndex();
        return productPhotoEntry(index, impaCode);
    }

    async function evictOldest(cache, order) {
        while (order.length > MAX_ENTRIES) {
            const url = order.shift();
            if (url && cache) await cache.delete(url).catch(() => {});
        }
        return order;
    }

    async function touch(cache, url) {
        let order = readLru().filter(u => u !== url);
        order.push(url);
        order = await evictOldest(cache, order);
        writeLru(order);
    }

    async function fetchUrl(url) {
        if (!url) return { ok: false, reason: 'no-id' };

        const cache = await openCache();

        if (cache) {
            const hit = await cache.match(url);
            if (hit) {
                await touch(cache, url);
                const blob = await hit.blob();
                return { ok: true, objectUrl: URL.createObjectURL(blob), fromCache: true };
            }
        }

        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            if (cache) {
                await cache.put(url, new Response(blob.slice(), {
                    headers: { 'Content-Type': res.headers.get('Content-Type') || 'image/webp' },
                }));
                await touch(cache, url);
            }
            return { ok: true, objectUrl: URL.createObjectURL(blob), fromCache: false };
        } catch (err) {
            const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
            return { ok: false, reason: offline ? 'offline' : 'fetch-failed', error: err };
        }
    }

    /**
     * Fetch plate webp on demand. Returns blob object URL or failure reason.
     * @returns {Promise<{ok:boolean, objectUrl?:string, fromCache?:boolean, reason?:string}>}
     */
    async function fetchPlate(plateId, impaCode) {
        if (impaCode) {
            const productMeta = await resolveProductPhotoMeta(impaCode);
            const productUrl = productMeta?.photo_url || '';
            if (productUrl) {
                const productResult = await fetchUrl(productUrl);
                if (productResult.ok) {
                    return { ...productResult, productMeta, isProductPhoto: true };
                }
            }
        }
        const berthId = impaCode ? await resolveBerthPlateId(impaCode) : '';
        if (berthId) {
            const berthUrl = assetUrl(berthId);
            const berthResult = await fetchUrl(berthUrl);
            if (berthResult.ok) return berthResult;
        }
        const url = assetUrl(plateId);
        return fetchUrl(url);
    }

    async function clearAll() {
        writeLru([]);
        _berthIndex = null;
        _berthIndexPromise = null;
        if ('caches' in window) await caches.delete(CACHE_NAME).catch(() => {});
    }

    function getStats() {
        return { maxEntries: MAX_ENTRIES, cachedUrls: readLru().length };
    }

    return {
        fetchPlate,
        fetchUrl,
        assetUrl,
        resolveBerthPlateId,
        resolveProductPhotoUrl,
        resolveProductPhotoMeta,
        loadBerthIndex,
        loadProductPhotoIndex,
        clearAll,
        getStats,
        MAX_ENTRIES,
        CACHE_NAME,
    };
})();
