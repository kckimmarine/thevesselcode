/**
 * Marine engine combustion balance & cylinder lube feed rate utilities.
 * Used by Maritime Toolkit UI and `scripts/test-combustion-calc.mjs`.
 */
(function (global) {
    'use strict';

    const PMAX_TOL_BAR = 3.0;
    const TEXH_TOL_C = 30;

    function mean(values) {
        const nums = values.filter((v) => Number.isFinite(v));
        if (!nums.length) return NaN;
        return nums.reduce((a, b) => a + b, 0) / nums.length;
    }

    function combustionHints(deltaPmax, deltaTexh) {
        const hints = [];
        if (deltaPmax < -PMAX_TOL_BAR && deltaTexh > 20) {
            hints.push('Suspect after-burning or injector nozzle spray defect.');
        }
        if (deltaPmax > PMAX_TOL_BAR) {
            hints.push('Check fuel injection timing / VIT lead.');
        }
        if (!hints.length && (Math.abs(deltaPmax) > PMAX_TOL_BAR || Math.abs(deltaTexh) > TEXH_TOL_C)) {
            hints.push('Review combustion balance, scavenge air, and fuel rack index.');
        }
        return hints;
    }

    /**
     * @param {Array<{ cylNo: number, pMax: number, pComp: number, tExh: number }>} cylinders
     */
    function diagnoseCombustion(cylinders) {
        const rows = Array.isArray(cylinders) ? cylinders : [];
        if (!rows.length) {
            return {
                meanPmax: NaN,
                meanPcomp: NaN,
                meanTexh: NaN,
                cylinders: [],
                error: 'NO_DATA',
            };
        }

        const meanPmax = mean(rows.map((c) => Number(c.pMax)));
        const meanPcomp = mean(rows.map((c) => Number(c.pComp)));
        const meanTexh = mean(rows.map((c) => Number(c.tExh)));

        const analyzed = rows.map((c) => {
            const pMax = Number(c.pMax);
            const pComp = Number(c.pComp);
            const tExh = Number(c.tExh);
            const deltaPmax = pMax - meanPmax;
            const deltaPcomp = pComp - meanPcomp;
            const deltaTexh = tExh - meanTexh;
            const balanced =
                Math.abs(deltaPmax) <= PMAX_TOL_BAR && Math.abs(deltaTexh) <= TEXH_TOL_C;
            const status = balanced ? 'BALANCED' : 'IMBALANCED';
            const color = balanced ? 'green' : 'red';
            const hints = balanced ? [] : combustionHints(deltaPmax, deltaTexh);
            return {
                cylNo: c.cylNo,
                pMax,
                pComp,
                tExh,
                deltaPmax: Math.round(deltaPmax * 100) / 100,
                deltaPcomp: Math.round(deltaPcomp * 100) / 100,
                deltaTexh: Math.round(deltaTexh * 100) / 100,
                status,
                color,
                hints,
            };
        });

        return {
            meanPmax: Math.round(meanPmax * 100) / 100,
            meanPcomp: Math.round(meanPcomp * 100) / 100,
            meanTexh: Math.round(meanTexh * 100) / 100,
            cylinders: analyzed,
        };
    }

    /**
     * @param {{ powerKw: number, sulfurPercent: number, bn: number, oilDensity?: number }} opts
     */
    function calculateCylinderLube(opts) {
        const powerKw = Number(opts?.powerKw);
        const sulfurPercent = Number(opts?.sulfurPercent);
        const bn = Number(opts?.bn);
        const oilDensity = Number(opts?.oilDensity ?? 0.92);

        if (!Number.isFinite(powerKw) || powerKw <= 0) {
            return { error: 'INVALID_POWER' };
        }
        if (!Number.isFinite(sulfurPercent) || sulfurPercent < 0) {
            return { error: 'INVALID_SULFUR' };
        }
        if (!Number.isFinite(bn) || bn <= 0) {
            return { error: 'INVALID_BN' };
        }

        let targetFeedRateGPerKwh;
        if (bn <= 40) {
            targetFeedRateGPerKwh = Math.max(0.65, sulfurPercent * 1.5);
            targetFeedRateGPerKwh = Math.min(targetFeedRateGPerKwh, 1.2);
        } else {
            targetFeedRateGPerKwh = Math.max(0.6, (sulfurPercent * 100 / bn) * 0.35 + 0.5);
            targetFeedRateGPerKwh = Math.min(targetFeedRateGPerKwh, 1.4);
        }

        const dailyLiters =
            (powerKw * targetFeedRateGPerKwh * 24) / (1000 * (Number.isFinite(oilDensity) && oilDensity > 0 ? oilDensity : 0.92));

        let statusAdvice = 'Feed rate within typical low-BN / fuel-sulfur envelope — confirm with maker SCOC.';
        if (sulfurPercent >= 0.5 && bn <= 40) {
            statusAdvice = 'Elevated fuel sulfur with BN 40 — monitor piston crown and under-piston temperature; adjust SCOC if drain analysis trends acidic.';
        } else if (bn > 70) {
            statusAdvice = 'High-BN oil — avoid over-lubrication; verify feed rate against OEM minimum for residual sulfur.';
        }

        return {
            powerKw,
            sulfurPercent,
            bn,
            oilDensity,
            targetFeedRateGPerKwh: Math.round(targetFeedRateGPerKwh * 1000) / 1000,
            dailyLiters: Math.round(dailyLiters * 100) / 100,
            statusAdvice,
        };
    }

    /** Demo 6-cylinder dataset for toolkit UI. */
    function sampleSixCylinderBalanced() {
        return [
            { cylNo: 1, pMax: 145, pComp: 105, tExh: 380 },
            { cylNo: 2, pMax: 144, pComp: 104, tExh: 378 },
            { cylNo: 3, pMax: 146, pComp: 106, tExh: 382 },
            { cylNo: 4, pMax: 145, pComp: 105, tExh: 379 },
            { cylNo: 5, pMax: 144, pComp: 105, tExh: 381 },
            { cylNo: 6, pMax: 146, pComp: 104, tExh: 380 },
        ];
    }

    global.TVC_CombustionCalc = {
        diagnoseCombustion,
        calculateCylinderLube,
        sampleSixCylinderBalanced,
        PMAX_TOL_BAR,
        TEXH_TOL_C,
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
