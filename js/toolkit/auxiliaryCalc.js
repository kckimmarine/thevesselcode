/**
 * Marine auxiliary systems — refrigeration P-T diagnostics & boiler water treatment.
 * Used by Maritime Toolkit UI and `scripts/test-auxiliary-calc.mjs`.
 */
(function (global) {
    'use strict';

    const ATM_BAR = 1.01325;
    const SH_MIN = 4;
    const SH_MAX = 8;
    const SC_MIN = 3;
    const SC_MAX = 6;

    /** Saturation P (bar abs) vs T (°C) — reference points for interpolation. */
    const PT_TABLES = Object.freeze({
        R134a: [
            [-40, 0.608], [-30, 0.959], [-20, 1.447], [-15, 1.72], [-10, 2.028], [-5, 2.378],
            [0, 2.93], [5, 3.597], [10, 4.415], [15, 5.403], [20, 6.587],
        ],
        R404a: [
            [-40, 1.25], [-30, 1.85], [-20, 2.65], [-15, 3.05], [-10, 3.52], [-5, 4.05],
            [0, 4.65], [5, 5.32], [10, 6.08], [15, 6.92], [20, 7.85],
        ],
        R407c: [
            [-40, 1.15], [-30, 1.72], [-20, 2.48], [-15, 2.88], [-10, 3.35], [-5, 3.88],
            [0, 4.48], [5, 5.15], [10, 5.92], [15, 6.78], [20, 7.75],
        ],
    });

    const BOILER = Object.freeze({
        phMin: 9.5,
        phMax: 11.0,
        chlorideMaxPpm: 300,
        phosphateMinPpm: 20,
        phosphateMaxPpm: 50,
        phosphateTargetPpm: 35,
    });

    function normalizeRefrigerant(name) {
        const key = String(name || 'R134a').replace(/\s+/g, '').toUpperCase();
        if (key === 'R404A') return 'R404a';
        if (key === 'R407C') return 'R407c';
        if (key === 'R134A') return 'R134a';
        return PT_TABLES[key] ? key : 'R134a';
    }

    /** @param {string} refrigerant @param {number} pressureBarAbs */
    function saturationTempFromPressure(refrigerant, pressureBarAbs) {
        const table = PT_TABLES[normalizeRefrigerant(refrigerant)];
        const p = Number(pressureBarAbs);
        if (!table || !Number.isFinite(p) || p <= 0) return null;

        if (p <= table[0][1]) return table[0][0];
        const last = table[table.length - 1];
        if (p >= last[1]) return last[0];

        for (let i = 0; i < table.length - 1; i += 1) {
            const [t0, p0] = table[i];
            const [t1, p1] = table[i + 1];
            if (p >= p0 && p <= p1) {
                const logP0 = Math.log(p0);
                const logP1 = Math.log(p1);
                const logP = Math.log(p);
                const frac = logP1 === logP0 ? 0 : (logP - logP0) / (logP1 - logP0);
                return t0 + frac * (t1 - t0);
            }
        }
        return null;
    }

    function round1(n) {
        return Math.round(n * 10) / 10;
    }

    function refrigerantAdvice(superheat, subcooling) {
        const parts = [];
        if (superheat < SH_MIN) {
            parts.push(`Low superheat (${round1(superheat)}°C) — risk of liquid flood-back; check expansion valve opening / bulb contact.`);
        } else if (superheat > SH_MAX) {
            parts.push(`High superheat (${round1(superheat)}°C) — possible undercharge or restricted metering device.`);
        } else {
            parts.push(`Superheat ${round1(superheat)}°C within typical ${SH_MIN}–${SH_MAX}°C band.`);
        }
        if (subcooling < SC_MIN) {
            parts.push(`Low subcooling (${round1(subcooling)}°C) — flash gas in liquid line; verify condenser capacity / charge.`);
        } else if (subcooling > SC_MAX) {
            parts.push(`High subcooling (${round1(subcooling)}°C) — possible overcharge or condenser over-performance.`);
        } else {
            parts.push(`Subcooling ${round1(subcooling)}°C within typical ${SC_MIN}–${SC_MAX}°C band.`);
        }
        return parts.join(' ');
    }

    /**
     * @param {{ refrigerant: string, suctionBarGauge: number, suctionLineTempC: number, dischargeBarGauge: number, liquidLineTempC: number }} opts
     */
    function diagnoseRefrigerant(opts) {
        const refrigerant = normalizeRefrigerant(opts?.refrigerant);
        const suctionAbs = Number(opts?.suctionBarGauge) + ATM_BAR;
        const dischargeAbs = Number(opts?.dischargeBarGauge) + ATM_BAR;
        const suctionLineTempC = Number(opts?.suctionLineTempC);
        const liquidLineTempC = Number(opts?.liquidLineTempC);

        const tSatEvap = saturationTempFromPressure(refrigerant, suctionAbs);
        const tSatCond = saturationTempFromPressure(refrigerant, dischargeAbs);

        if (tSatEvap == null || tSatCond == null) {
            return { error: 'INVALID_PRESSURE', refrigerant };
        }

        const superheat = suctionLineTempC - tSatEvap;
        const subcooling = tSatCond - liquidLineTempC;

        return {
            refrigerant,
            suctionBarAbsolute: round1(suctionAbs),
            dischargeBarAbsolute: round1(dischargeAbs),
            tSatEvap: round1(tSatEvap),
            tSatCond: round1(tSatCond),
            superheat: round1(superheat),
            subcooling: round1(subcooling),
            diagnosisAdvice: refrigerantAdvice(superheat, subcooling),
        };
    }

    /**
     * @param {{ ph: number, chloridePpm: number, phosphatePpm: number }} opts
     */
    function diagnoseBoilerWater(opts) {
        const ph = Number(opts?.ph);
        const chloridePpm = Number(opts?.chloridePpm);
        const phosphatePpm = Number(opts?.phosphatePpm);
        const actions = [];
        let status = 'NORMAL';

        if (Number.isFinite(chloridePpm) && chloridePpm > BOILER.chlorideMaxPpm) {
            actions.push('Execute surface & bottom blowdown to prevent scale carry-over.');
            status = 'CRITICAL';
        }

        if (Number.isFinite(ph)) {
            if (ph < BOILER.phMin) {
                actions.push(`pH ${ph} low — alkalinity treatment required (target ${BOILER.phMin}–${BOILER.phMax}).`);
                status = status === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
            } else if (ph > BOILER.phMax) {
                actions.push(`pH ${ph} high — risk of caustic embrittlement; adjust chemical program.`);
                status = status === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
            }
        }

        if (Number.isFinite(phosphatePpm)) {
            if (phosphatePpm < BOILER.phosphateMinPpm) {
                const addPpm = BOILER.phosphateTargetPpm - phosphatePpm;
                actions.push(
                    `Phosphate ${phosphatePpm} ppm low — dose alkaline phosphate program to raise PO4 by ~${round1(addPpm)} ppm toward target ${BOILER.phosphateTargetPpm} ppm.`,
                );
                if (status === 'NORMAL') status = 'WARNING';
            } else if (phosphatePpm > BOILER.phosphateMaxPpm) {
                actions.push(`Phosphate ${phosphatePpm} ppm high — increase blowdown or reduce dosing.`);
                if (status === 'NORMAL') status = 'WARNING';
            }
        }

        if (!actions.length) {
            actions.push('Parameters within typical auxiliary boiler envelope — continue routine monitoring.');
        }

        return {
            ph,
            chloridePpm,
            phosphatePpm,
            status,
            actions,
            blowdownRequired: Number.isFinite(chloridePpm) && chloridePpm > BOILER.chlorideMaxPpm,
        };
    }

    global.TVC_AuxiliaryCalc = {
        ATM_BAR,
        PT_TABLES,
        BOILER,
        saturationTempFromPressure,
        diagnoseRefrigerant,
        diagnoseBoilerWater,
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
