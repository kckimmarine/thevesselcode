/**
 * Mechanical engineering utilities — bolt tightening torque & crankshaft deflection.
 * Used by Maritime Toolkit UI and `scripts/test-mechanical-engineering-calc.mjs`.
 */
(function (global) {
    'use strict';

    const K_FACTORS = Object.freeze({ oiled: 0.14, dry: 0.18 });
    const DEFAULT_PROOF = Object.freeze({
        '8.8': 580,
        '10.9': 900,
        '12.9': 1040,
    });
    const PRELOAD_FACTOR = 0.9;
    const KGF_PER_NM = 1 / 9.80665;

    /** @type {{ bolts: Array, propertyClasses?: Record<string, { proofStressMpa: number }>, preloadFactor?: number } | null} */
    let _standards = null;

    function setStandards(data) {
        if (!data || !Array.isArray(data.bolts)) {
            throw new Error('Invalid bolt-torque-standards payload');
        }
        _standards = data;
    }

    function getStandards() {
        return _standards;
    }

    function proofStressMpa(propertyClass) {
        const key = String(propertyClass);
        const fromJson = _standards?.propertyClasses?.[key]?.proofStressMpa;
        if (fromJson != null) return Number(fromJson);
        return DEFAULT_PROOF[key] ?? null;
    }

    function findBolt(size) {
        const id = String(size || '').trim().toUpperCase();
        const bolts = _standards?.bolts || [];
        return bolts.find((b) => String(b.size).toUpperCase() === id) || null;
    }

    function listBoltSizes() {
        return (_standards?.bolts || []).map((b) => b.size);
    }

    function listPropertyClasses() {
        const keys = _standards?.propertyClasses
            ? Object.keys(_standards.propertyClasses)
            : Object.keys(DEFAULT_PROOF);
        return keys.sort();
    }

    /**
     * Target tightening torque: T = K * d * Fm (N·m) with d [mm], Fm [N].
     * @param {{ size: string, propertyClass: string, lubrication?: 'oiled'|'dry', fmN?: number }} opts
     */
    function calcBoltTorque(opts) {
        const size = opts?.size;
        const propertyClass = String(opts?.propertyClass || '8.8');
        const lubrication = opts?.lubrication === 'dry' ? 'dry' : 'oiled';
        const bolt = findBolt(size);
        if (!bolt) {
            return { error: 'UNKNOWN_SIZE', size };
        }
        const d = Number(bolt.diameterMm);
        const as = Number(bolt.stressAreaMm2);
        const sp = proofStressMpa(propertyClass);
        if (!sp) {
            return { error: 'UNKNOWN_CLASS', propertyClass };
        }
        const preload = Number(_standards?.preloadFactor ?? PRELOAD_FACTOR);
        const Fm = opts?.fmN != null ? Number(opts.fmN) : preload * as * sp;
        const K = K_FACTORS[lubrication];
        const torqueNm = (K * d * Fm) / 1000;
        const torqueKgfM = torqueNm * KGF_PER_NM;
        return {
            size: bolt.size,
            propertyClass,
            lubrication,
            kFactor: K,
            diameterMm: d,
            stressAreaMm2: as,
            proofStressMpa: sp,
            fmN: Fm,
            torqueNm: Math.round(torqueNm * 100) / 100,
            torqueKgfM: Math.round(torqueKgfM * 100) / 100,
        };
    }

    /** Pre-calculated lookup for all sizes × classes × lubrication states. */
    function buildTorqueLookupTable() {
        const sizes = listBoltSizes();
        const classes = listPropertyClasses();
        const rows = [];
        for (const size of sizes) {
            for (const propertyClass of classes) {
                const oiled = calcBoltTorque({ size, propertyClass, lubrication: 'oiled' });
                const dry = calcBoltTorque({ size, propertyClass, lubrication: 'dry' });
                if (oiled.error || dry.error) continue;
                rows.push({
                    size,
                    propertyClass,
                    torqueNmOiled: oiled.torqueNm,
                    torqueKgfMOiled: oiled.torqueKgfM,
                    torqueNmDry: dry.torqueNm,
                    torqueKgfMDry: dry.torqueKgfM,
                });
            }
        }
        return rows;
    }

    /**
     * Crankshaft deflection diagnostic (readings in mm).
     * Allowable vertical deflection: stroke × 0.00007 (0.07 mm per 1000 mm stroke).
     */
    function diagnoseDeflection({ strokeMm, top, bottom, port, starboard, unit = 'mm' }) {
        const stroke = Number(strokeMm);
        const toMm = (v) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return NaN;
            if (unit === 'in' || unit === 'inch') return n * 25.4;
            return n;
        };
        const t = toMm(top);
        const b = toMm(bottom);
        const p = toMm(port);
        const s = toMm(starboard);
        const deltaV = t - b;
        const deltaH = p - s;
        const limit = Number.isFinite(stroke) && stroke > 0 ? stroke * 0.00007 : NaN;
        const absV = Math.abs(deltaV);

        let status = 'INVALID';
        let color = 'slate';
        let advice = 'Enter stroke and dial gauge readings (mm).';

        if (Number.isFinite(limit) && Number.isFinite(deltaV)) {
            if (absV <= limit * 0.7) {
                status = 'NORMAL';
                color = 'green';
                advice = 'Within normal range.';
            } else if (absV <= limit) {
                status = 'ATTENTION';
                color = 'yellow';
                advice = 'Monitor next voyage.';
            } else {
                status = 'EXCEEDED';
                color = 'red';
                advice = 'Check Main Bearing clearance and bedplate alignment immediately.';
            }
        }

        return {
            strokeMm: stroke,
            unit,
            top: t,
            bottom: b,
            port: p,
            starboard: s,
            deltaV,
            deltaH,
            allowableLimitMm: limit,
            status,
            color,
            advice,
        };
    }

    async function loadStandardsFromJson(url = '/data/bolt-torque-standards.json') {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`bolt-torque-standards load failed: ${res.status}`);
        const data = await res.json();
        setStandards(data);
        return data;
    }

    global.TVC_MechanicalCalc = {
        K_FACTORS,
        setStandards,
        getStandards,
        findBolt,
        listBoltSizes,
        listPropertyClasses,
        calcBoltTorque,
        buildTorqueLookupTable,
        diagnoseDeflection,
        loadStandardsFromJson,
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
