/* THE VESSEL CODE — Public IMPA catalog (no PMS login) */
(function () {
    async function applyQueryDirectAnswer(params) {
        const q = String(params.get('q') || '').trim();
        if (!q || !globalThis.TVC_SearchResolver?.classifyQuery) return false;

        const route = globalThis.TVC_SearchResolver.classifyQuery(q);
        if (!route.direct) return false;

        if (route.type === 'impa') {
            try {
                let item = await TVC_StoreManager.getItemByCode(route.impa);
                if (!item) {
                    const search = await TVC_StoreManager.searchCatalog(route.impa, { limit: 8 });
                    item = (search.items || []).find((i) => (i.impa_code || i.code) === route.impa);
                }
                if (item) {
                    if (typeof TVC_MaritimeToolkit !== 'undefined') {
                        TVC_MaritimeToolkit.setActiveTool('catalog');
                    }
                    TVC_StoreMenu.openImpaDetailModal(item);
                    return true;
                }
            } catch (err) {
                console.warn('[store-public] impa direct', err);
            }
        }

        if (globalThis.TVC_SearchPortal?.executePortalSearch) {
            await globalThis.TVC_SearchPortal.executePortalSearch(q);
            return true;
        }
        return false;
    }

    async function boot() {
        if (typeof TVC_StoreMenu === 'undefined') {
            const root = document.getElementById('storeMenuBody');
            if (root) root.innerHTML = '<p class="store-error">Catalog UI failed to load.</p>';
            return;
        }

        TVC_StoreManager.enableMemorySearch(true);
        TVC_StoreMenu.setPublicMode(true);

        if (typeof TVC_MaritimeToolkit !== 'undefined') {
            await TVC_MaritimeToolkit.init();
        }

        const params = new URLSearchParams(window.location.search);
        const toolTab = typeof TVC_MaritimeToolkit?.resolveToolkitToolFromLocation === 'function'
            ? TVC_MaritimeToolkit.resolveToolkitToolFromLocation()
            : params.get('tool');
        if (toolTab && typeof TVC_MaritimeToolkit !== 'undefined') {
            TVC_MaritimeToolkit.openToolkitModule(toolTab, { scroll: false, syncUrl: true });
        }

        try {
            await TVC_StoreManager.loadCatalog();
            await TVC_StoreManager.buildMemoryIndex();
        } catch (err) {
            console.warn('[store-public] catalog preload', err);
        }

        await TVC_StoreMenu.render();

        const searchQ = params.get('q');
        if (searchQ && String(searchQ).trim()) {
            const handled = await applyQueryDirectAnswer(params);
            if (!handled) {
                if (typeof TVC_MaritimeToolkit !== 'undefined') {
                    TVC_MaritimeToolkit.setActiveTool('catalog');
                }
                await TVC_StoreManager.searchCatalog(String(searchQ).trim());
                await TVC_StoreMenu.render();
            }
        }

        const impaCode = new URLSearchParams(window.location.search).get('impa');
        if (impaCode) {
            try {
                const item = await TVC_StoreManager.getItemByCode(impaCode);
                if (item) {
                    if (typeof TVC_MaritimeToolkit !== 'undefined') {
                        TVC_MaritimeToolkit.setActiveTool('catalog');
                    }
                    TVC_StoreMenu.openImpaDetailModal(item);
                }
            } catch (err) {
                console.warn('[store-public] impa deep link', err);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
