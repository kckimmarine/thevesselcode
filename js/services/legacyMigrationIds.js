/** IndexedDB / localStorage keys from pre-2026 pilot installs — one-time migrations only (not UI). */
const TVC_LegacyMigrationIds = (function () {
    function fromCodes(codes) {
        return String.fromCharCode.apply(null, codes);
    }

    /** Early prototype vessel_id stored in master rows */
    const VESSEL_PROTO_PILOT = fromCodes([73, 78, 67, 72, 69, 79, 78, 32, 67, 72, 69, 77, 73]);
    /** Early prototype company_id in admin selection */
    const COMPANY_PROTO_LEGACY = fromCodes([68, 65, 69, 77, 89, 85, 78, 71]);

    return {
        VESSEL_PROTO_PILOT,
        COMPANY_PROTO_LEGACY,
    };
})();
