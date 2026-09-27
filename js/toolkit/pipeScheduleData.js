/**
 * ASME B36.10M / JIS-compatible carbon steel pipe schedule reference (SCH 40, 80, 160).
 * Weights are estimated for carbon steel (ρ ≈ 7850 kg/m³).
 */
(function (global) {
    'use strict';

    const LB_PER_FT_FROM_KG_M = 0.671968975;

    /** @typedef {{ nps: string, dn: string, jisA: string, odMm: number, odIn: number, sch40: number|null, sch80: number|null, sch160: number|null, jisSeries?: string }} PipeRow */

    /** @type {PipeRow[]} */
    const ROWS = [
        { nps: '1/2"', dn: 'DN15', jisA: '15A', odMm: 21.3, odIn: 0.84, sch40: 2.77, sch80: 3.73, sch160: null, jisSeries: 'G3452 SGP' },
        { nps: '3/4"', dn: 'DN20', jisA: '20A', odMm: 26.7, odIn: 1.05, sch40: 2.87, sch80: 3.91, sch160: null, jisSeries: 'G3452 SGP' },
        { nps: '1"', dn: 'DN25', jisA: '25A', odMm: 33.4, odIn: 1.315, sch40: 3.38, sch80: 4.55, sch160: null, jisSeries: 'G3452 SGP' },
        { nps: '1-1/4"', dn: 'DN32', jisA: '32A', odMm: 42.2, odIn: 1.66, sch40: 3.56, sch80: 4.85, sch160: null, jisSeries: 'G3452 SGP' },
        { nps: '1-1/2"', dn: 'DN40', jisA: '40A', odMm: 48.3, odIn: 1.9, sch40: 3.68, sch80: 5.08, sch160: null, jisSeries: 'G3452 SGP' },
        { nps: '2"', dn: 'DN50', jisA: '50A', odMm: 60.3, odIn: 2.375, sch40: 3.91, sch80: 5.54, sch160: 8.74, jisSeries: 'G3454 STPG' },
        { nps: '2-1/2"', dn: 'DN65', jisA: '65A', odMm: 73.0, odIn: 2.875, sch40: 5.16, sch80: 7.01, sch160: 9.53, jisSeries: 'G3454 STPG' },
        { nps: '3"', dn: 'DN80', jisA: '80A', odMm: 88.9, odIn: 3.5, sch40: 5.49, sch80: 7.62, sch160: 11.13, jisSeries: 'G3454 STPG' },
        { nps: '4"', dn: 'DN100', jisA: '100A', odMm: 114.3, odIn: 4.5, sch40: 6.02, sch80: 8.56, sch160: 13.49, jisSeries: 'G3454 STPG' },
        { nps: '5"', dn: 'DN125', jisA: '125A', odMm: 141.3, odIn: 5.563, sch40: 6.55, sch80: 9.53, sch160: 15.88, jisSeries: 'G3454 STPG' },
        { nps: '6"', dn: 'DN150', jisA: '150A', odMm: 168.3, odIn: 6.625, sch40: 7.11, sch80: 10.97, sch160: 18.26, jisSeries: 'G3454 STPG' },
        { nps: '8"', dn: 'DN200', jisA: '200A', odMm: 219.1, odIn: 8.625, sch40: 8.18, sch80: 12.7, sch160: 23.01, jisSeries: 'G3454 STPG' },
        { nps: '10"', dn: 'DN250', jisA: '250A', odMm: 273.0, odIn: 10.75, sch40: 9.27, sch80: 15.09, sch160: 25.4, jisSeries: 'G3454 STPG' },
        { nps: '12"', dn: 'DN300', jisA: '300A', odMm: 323.8, odIn: 12.75, sch40: 10.31, sch80: 17.48, sch160: 33.32, jisSeries: 'G3454 STPG' },
    ];

    function weightKgPerM(odMm, wallMm) {
        const t = Number(wallMm);
        const od = Number(odMm);
        if (!Number.isFinite(t) || !Number.isFinite(od) || t <= 0) return null;
        return Math.round(0.0246615 * (od - t) * t * 1000) / 1000;
    }

    function weightLbPerFt(odMm, wallMm) {
        const kg = weightKgPerM(odMm, wallMm);
        if (kg == null) return null;
        return Math.round(kg * LB_PER_FT_FROM_KG_M * 100) / 100;
    }

    function enrichRow(row) {
        const sch40 = row.sch40;
        const sch80 = row.sch80;
        const sch160 = row.sch160;
        const refWall = sch40 ?? sch80 ?? sch160;
        return {
            ...row,
            weightSch40KgM: sch40 != null ? weightKgPerM(row.odMm, sch40) : null,
            weightSch80KgM: sch80 != null ? weightKgPerM(row.odMm, sch80) : null,
            weightSch160KgM: sch160 != null ? weightKgPerM(row.odMm, sch160) : null,
            weightSch40LbFt: sch40 != null ? weightLbPerFt(row.odMm, sch40) : null,
            weightSch80LbFt: sch80 != null ? weightLbPerFt(row.odMm, sch80) : null,
            weightSch160LbFt: sch160 != null ? weightLbPerFt(row.odMm, sch160) : null,
            weightStdKgM: refWall != null ? weightKgPerM(row.odMm, refWall) : null,
        };
    }

    function allRows() {
        return ROWS.map(enrichRow);
    }

    function filterRows(query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return allRows();
        return allRows().filter((r) => {
            const jis = r.jisA.toLowerCase();
            const dn = r.dn.toLowerCase();
            const nps = r.nps.toLowerCase();
            if (jis === q || dn === q) return true;
            if (/^\d+a$/.test(q)) return jis === q;
            if (nps.includes(q)) return true;
            if (String(r.odMm).includes(q)) return true;
            if (r.jisSeries?.toLowerCase().includes(q)) return true;
            return false;
        });
    }

    function getRowByKey(key) {
        const k = String(key || '').trim().toLowerCase();
        return allRows().find((r) =>
            r.nps.toLowerCase() === k
            || r.jisA.toLowerCase() === k
            || r.dn.toLowerCase() === k) || null;
    }

    function formatSpecSummary(row, scheduleKey) {
        if (!row) return '';
        const wall = row[scheduleKey];
        const schedLabel = scheduleKey === 'sch40' ? 'SCH 40 (STD)' : scheduleKey === 'sch80' ? 'SCH 80 (XS)' : 'SCH 160';
        const wt = scheduleKey === 'sch40' ? row.weightSch40KgM : scheduleKey === 'sch80' ? row.weightSch80KgM : row.weightSch160KgM;
        return `${row.nps} / ${row.jisA} — ${schedLabel}, OD ${row.odMm} mm, wall ${wall ?? '—'} mm, ~${wt ?? '—'} kg/m (ASME B36.10M ref)`;
    }

    const api = {
        allRows,
        filterRows,
        getRowByKey,
        weightKgPerM,
        weightLbPerFt,
        formatSpecSummary,
        ROW_COUNT: ROWS.length,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    global.TVC_PipeScheduleData = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
