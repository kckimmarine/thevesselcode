/**
 * TVC Portal — execute unified search resolution (single direct answer).
 */
(function (global) {
    'use strict';

    function resolver() {
        return global.TVC_SearchResolver;
    }

    function openBrainModal(query, options) {
        const Brain = global.TVC_BrainChat;
        if (!Brain) return false;
        if (typeof Brain.openBrainModal === 'function') {
            Brain.openBrainModal(query, options);
            return true;
        }
        if (typeof Brain.openModal === 'function') {
            Brain.openModal(query, options);
            return true;
        }
        return false;
    }

    function navigate(href) {
        global.location.href = href;
    }

    async function openImpaPlate(impa) {
        const code = String(impa || '').replace(/\D/g, '');
        if (code.length !== 6) return false;

        if (global.TVC_StoreManager?.getItemByCode && global.TVC_StoreMenu?.openImpaDetailModal) {
            try {
                if (global.TVC_MaritimeToolkit?.setActiveTool) {
                    global.TVC_MaritimeToolkit.setActiveTool('catalog');
                }
                const item = await global.TVC_StoreManager.getItemByCode(code);
                if (item) {
                    global.TVC_StoreMenu.openImpaDetailModal(item);
                    return true;
                }
            } catch (err) {
                console.warn('[searchPortal] IMPA direct open', err);
            }
        }
        navigate(`/store/${code}`);
        return true;
    }

    async function openTopVessel(query, classification) {
        const Fleet = global.TVC_FleetRegistry;
        const Lookup = global.TVC_VesselLookup;
        const q = classification?.query || query;
        const imoSeed = classification?.imo || q;

        if (Lookup?.renderResults && Fleet?.searchFleet) {
            try {
                const hits = await Fleet.searchFleet(imoSeed);
                const top = hits?.[0];
                if (top) {
                    const container = document.getElementById('tvcVesselLookupResults');
                    const input = document.getElementById('tvcVesselLookupInput');
                    if (input) input.value = top.name || q;
                    if (container) {
                        await Lookup.renderResults(container, hits, null, { singleDirect: true });
                    }
                    return true;
                }
            } catch (err) {
                console.warn('[searchPortal] vessel direct open', err);
            }
        }

        const param = classification?.imo
            ? `imo=${encodeURIComponent(classification.imo)}`
            : `vessel=${encodeURIComponent(q)}`;
        navigate(`/toolkit?${param}`);
        return true;
    }

    function openToolkitModule(classification) {
        const tool = classification.tool || 'catalog';
        const q = classification.query || '';
        if (global.TVC_MaritimeToolkit?.openToolkitModule) {
            global.TVC_MaritimeToolkit.openToolkitModule(tool, { scroll: true, syncUrl: true });
            if (tool === 'catalog' && q && global.TVC_StoreManager?.searchCatalog) {
                return global.TVC_StoreManager.searchCatalog(q).then(() => false);
            }
            return Promise.resolve(true);
        }
        const R = resolver();
        const href = R?.routeHeroQuery?.(q)?.href || `/toolkit?tool=${encodeURIComponent(tool)}`;
        navigate(href);
        return Promise.resolve(true);
    }

    /**
     * @param {string} query
     * @param {{ preferNavigate?: boolean }} opts
     */
    async function executePortalSearch(query, opts = {}) {
        const R = resolver();
        if (!R?.classifyQuery) return { ok: false, reason: 'no-resolver' };

        const classification = R.classifyQuery(query);
        if (classification.type === 'empty') {
            return { ok: false, classification };
        }

        switch (classification.type) {
            case 'impa':
                if (!opts.preferNavigate && (await openImpaPlate(classification.impa))) {
                    return { ok: true, classification };
                }
                navigate(`/store/${classification.impa}`);
                return { ok: true, classification };
            case 'vessel':
                if (!opts.preferNavigate && (await openTopVessel(query, classification))) {
                    return { ok: true, classification };
                }
                navigate(R.routeHeroQuery(query).href);
                return { ok: true, classification };
            case 'brain':
                if (openBrainModal(classification.query, { briefing: true })) {
                    return { ok: true, classification };
                }
                navigate(`/?brain=${encodeURIComponent(classification.query)}`);
                return { ok: true, classification };
            case 'toolkit':
                if (!opts.preferNavigate && global.TVC_MaritimeToolkit) {
                    await openToolkitModule(classification);
                    return { ok: true, classification };
                }
                navigate(R.routeHeroQuery(query).href);
                return { ok: true, classification };
            default:
                navigate(R.destinationForQuery(query));
                return { ok: true, classification };
        }
    }

    global.TVC_SearchPortal = {
        executePortalSearch,
        openBrainModal,
        openImpaPlate,
        openTopVessel,
        shouldSuppressList: (classification) => resolver()?.shouldSuppressResultList?.(classification),
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
