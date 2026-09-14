/**
 * ASTM Table 54B — bunker mass (VCF, weight-in-air, CO₂).
 * Shared by Maritime Toolkit UI and `scripts/test-maritime-toolkit-data.mjs`.
 */
(function (global) {
    'use strict';

    const FUEL_GRADES = Object.freeze({
        VLSFO: {
            key: 'VLSFO',
            label: 'VLSFO (0.50% S)',
            labelKo: 'VLSFO (황 0.50%)',
            defaultDensity: 991,
            co2Factor: 3.151,
        },
        LSMGO: {
            key: 'LSMGO',
            label: 'LSMGO (0.10% S)',
            labelKo: 'LSMGO / MGO (황 0.10%)',
            defaultDensity: 850,
            co2Factor: 3.206,
        },
        HSFO: {
            key: 'HSFO',
            label: 'HSFO 380',
            labelKo: 'HSFO 380',
            defaultDensity: 991,
            co2Factor: 3.151,
        },
    });

    function kCoefficients(density15) {
        const d = Number(density15);
        if (!Number.isFinite(d) || d <= 0) return { K0: 103.872, K1: 0.2701 };
        if (d <= 840) return { K0: 341.0957, K1: 0 };
        return { K0: 103.872, K1: 0.2701 };
    }

    /** Thermal expansion coefficient α @ 15°C reference (ASTM 54B). */
    function alphaAt15(density15) {
        const d = Number(density15);
        if (!Number.isFinite(d) || d <= 0) return 0;
        const { K0, K1 } = kCoefficients(d);
        return (K0 + K1 * d) / (d * d);
    }

    /** Volume correction factor to 15°C. */
    function vcf54B(density15, tempC) {
        const alpha = alphaAt15(density15);
        const t = Number(tempC);
        const deltaT = Number.isFinite(t) ? t - 15 : 0;
        return Math.exp(-alpha * deltaT * (1 + 0.8 * alpha * deltaT));
    }

    /**
     * @param {object} p
     * @param {number} p.volumeM3 — observed volume (m³)
     * @param {number} p.density15 — density @ 15°C (kg/m³)
     * @param {number} p.tempC — observed temperature (°C)
     * @param {string} [p.fuelKey] — VLSFO | LSMGO | HSFO
     */
    function calcBunkerAstM54B(p) {
        const volumeM3 = Math.max(0, Number(p?.volumeM3) || 0);
        const density15 = Math.max(0, Number(p?.density15) || 0);
        const tempC = Number(p?.tempC);
        const fuelKey = p?.fuelKey || 'VLSFO';
        const fuel = FUEL_GRADES[fuelKey] || FUEL_GRADES.VLSFO;

        if (!volumeM3 || !density15) {
            return {
                volumeM3,
                density15,
                tempC,
                fuelKey,
                alpha: 0,
                vcf: 1,
                v15: 0,
                densityInAir: 0,
                mt: 0,
                co2Mt: 0,
                co2Factor: fuel.co2Factor,
            };
        }

        const alpha = alphaAt15(density15);
        const vcf = vcf54B(density15, tempC);
        const v15 = volumeM3 * vcf;
        const densityInAir = density15 * vcf - 1.1;
        const mt = (volumeM3 * densityInAir) / 1000;
        const co2Factor = fuelKey === 'LSMGO' ? 3.206 : 3.151;
        const co2Mt = mt * co2Factor;

        return {
            volumeM3,
            density15,
            tempC,
            fuelKey,
            alpha,
            vcf,
            v15,
            densityInAir,
            mt,
            co2Mt,
            co2Factor,
        };
    }

    const api = {
        FUEL_GRADES,
        kCoefficients,
        alphaAt15,
        vcf54B,
        calcBunkerAstM54B,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    global.TVC_BunkerCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
