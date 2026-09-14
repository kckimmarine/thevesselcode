/**
 * JIS B2220 / ANSI / DIN flange matrix for Maritime Toolkit.
 * Data: /data/flange-standards.json
 */
(function (global) {
    'use strict';

    let _rows = null;
    let _standards = null;

    function normalizeRow(r) {
        return {
            standard: String(r.standard || ''),
            nb: String(r.nb || ''),
            od: Number(r.od),
            pcd: Number(r.pcd),
            bolts: Number(r.bolts),
            hole: Number(r.hole),
            bolt: String(r.bolt || ''),
        };
    }

    function setRows(rows) {
        _rows = (Array.isArray(rows) ? rows : []).map(normalizeRow);
        _standards = [...new Set(_rows.map((r) => r.standard))].sort();
    }

    function loadEmbeddedFallback() {
        setRows([]);
    }

    function standards() {
        return _standards ? [..._standards] : [];
    }

    function allRows() {
        return _rows ? [..._rows] : [];
    }

    function filterFlanges(standard, query) {
        const q = String(query || '').trim().toLowerCase();
        return (_rows || []).filter((row) => {
            if (row.standard !== standard) return false;
            if (!q) return true;
            return String(row.nb).toLowerCase().includes(q)
                || String(row.od).includes(q)
                || String(row.pcd).includes(q)
                || String(row.bolt).toLowerCase().includes(q);
        });
    }

    function getRow(standard, nb) {
        return (_rows || []).find((r) => r.standard === standard && r.nb === nb) || null;
    }

    async function loadFromJson(url) {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`Flange data HTTP ${res.status}`);
        const data = await res.json();
        setRows(data.rows || []);
        return _rows;
    }

    function initSync(rows) {
        if (rows) setRows(rows);
        else if (!_rows) loadEmbeddedFallback();
    }

    const api = {
        standards,
        allRows,
        filterFlanges,
        getRow,
        loadFromJson,
        initSync,
        setRows,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    global.TVC_FlangeData = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
