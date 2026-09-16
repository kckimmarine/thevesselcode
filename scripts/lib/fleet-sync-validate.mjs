import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isValidImoNumber } from './imo-checksum.mjs';

export function sha256File(path) {
    const buf = readFileSync(path);
    return createHash('sha256').update(buf).digest('hex');
}

export function validateFleetStore(fleetDir) {
    const warnings = [];
    const errors = [];
    const indexPath = join(fleetDir, 'fleet-index.json');
    if (!existsSync(indexPath)) {
        errors.push('missing fleet-index.json');
        return { ok: false, warnings, errors, vesselCount: 0, chunkCount: 0, indexSha256: null };
    }

    const index = JSON.parse(readFileSync(indexPath, 'utf8'));
    const vesselCount = Number(index.count) || 0;
    const chunkCount = readdirSync(fleetDir).filter((f) => /^fleet-\d{2}\.json$/.test(f)).length;

    if (vesselCount < 1000) warnings.push(`low vessel count: ${vesselCount}`);

    const imoEntries = Object.keys(index.imo || {});
    let invalidImo = 0;
    for (const imo of imoEntries.slice(0, 200)) {
        if (!isValidImoNumber(imo)) invalidImo++;
    }
    if (invalidImo > 0) warnings.push(`sample invalid IMO checksums: ${invalidImo}`);

    return {
        ok: errors.length === 0,
        warnings,
        errors,
        vesselCount,
        chunkCount,
        indexSha256: sha256File(indexPath),
        generated: index.generated || null,
        enrichedAt: index.enrichedAt || null,
    };
}
