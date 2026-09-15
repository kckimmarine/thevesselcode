/**
 * Marine electrical diagnostics — PT100 (IEC 60751) and 3-phase motor FLC / protection.
 * Used by Maritime Toolkit UI and `scripts/test-electrical-calc.mjs`.
 */
(function (global) {
    'use strict';

    const R0 = 100;
    const A = 3.9083e-3;
    const B = -5.775e-7;
    const DOL_FACTOR = 6.5;
    const EOCR_FACTOR = 1.1;
    const EOCR_TRIP_MIN = 1.05;
    const EOCR_TRIP_MAX = 1.15;

    function pt100ResistanceAtTemp(tempC) {
        const t = Number(tempC);
        return R0 * (1 + A * t + B * t * t);
    }

    /**
     * @param {number} ohms Measured PT100 resistance (Ω)
     * @returns {number|null} Temperature °C (1 decimal) or null if invalid
     */
    function pt100ToTemperature(ohms) {
        const r = Number(ohms);
        if (!Number.isFinite(r) || r <= 0) return null;
        let t = (r / R0 - 1) / A;
        if (!Number.isFinite(t)) t = 0;
        for (let i = 0; i < 24; i += 1) {
            const model = R0 * (1 + A * t + B * t * t);
            const err = model - r;
            if (Math.abs(err) < 1e-4) break;
            const deriv = R0 * (A + 2 * B * t);
            if (Math.abs(deriv) < 1e-12) return null;
            t -= err / deriv;
        }
        if (!Number.isFinite(t) || t < -200 || t > 850) return null;
        return Math.round(t * 10) / 10;
    }

    /** IEC 60751 reference: 0°C–200°C every 10°C. */
    function getPt100ReferenceTable() {
        const rows = [];
        for (let tempC = 0; tempC <= 200; tempC += 10) {
            rows.push({
                tempC,
                ohms: Math.round(pt100ResistanceAtTemp(tempC) * 100) / 100,
            });
        }
        return rows;
    }

    /**
     * @param {{ powerKw: number, voltage?: number, powerFactor?: number, efficiency?: number }} opts
     */
    function calculateMotorSpecs(opts) {
        const powerKw = Number(opts?.powerKw);
        const voltage = Number(opts?.voltage ?? 440);
        const powerFactor = Number(opts?.powerFactor ?? 0.85);
        const efficiency = Number(opts?.efficiency ?? 0.9);

        if (!Number.isFinite(powerKw) || powerKw <= 0) {
            return { error: 'INVALID_POWER' };
        }
        if (!Number.isFinite(voltage) || voltage <= 0) {
            return { error: 'INVALID_VOLTAGE' };
        }

        const denom = Math.sqrt(3) * voltage * powerFactor * efficiency;
        const flcAmps = denom > 0 ? (powerKw * 1000) / denom : 0;
        const dolStartingAmps = flcAmps * DOL_FACTOR;
        const eocrSettingAmps = flcAmps * EOCR_FACTOR;

        const adviceText =
            `Set thermal overload / EOCR near ${eocrSettingAmps.toFixed(1)} A (≈${EOCR_FACTOR * 100}% FLC; typical trip band ${EOCR_TRIP_MIN}–${EOCR_TRIP_MAX} × FLC). `
            + `DOL inrush ≈${dolStartingAmps.toFixed(0)} A — verify contactor, fuse, and HV authorization for ${voltage} V distribution. `
            + 'Confirm against motor nameplate and maker protection curves.';

        return {
            powerKw,
            voltage,
            powerFactor,
            efficiency,
            flcAmps: Math.round(flcAmps * 100) / 100,
            dolStartingAmps: Math.round(dolStartingAmps * 100) / 100,
            eocrSettingAmps: Math.round(eocrSettingAmps * 100) / 100,
            eocrTripRangeAmps: {
                min: Math.round(flcAmps * EOCR_TRIP_MIN * 100) / 100,
                max: Math.round(flcAmps * EOCR_TRIP_MAX * 100) / 100,
            },
            adviceText,
        };
    }

    global.TVC_ElectricalCalc = {
        R0,
        A,
        B,
        pt100ToTemperature,
        pt100ResistanceAtTemp,
        getPt100ReferenceTable,
        calculateMotorSpecs,
        DOL_FACTOR,
        EOCR_FACTOR,
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
