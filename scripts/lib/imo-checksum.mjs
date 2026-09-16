/**
 * IMO number validation (7-digit with modulus-10 check digit).
 */
export function digitsOnlyImo(value) {
    const d = String(value ?? '').replace(/\D/g, '');
    return d.length === 7 ? d : '';
}

export function isValidImoNumber(value) {
    const imo = digitsOnlyImo(value);
    if (!imo) return false;
    let sum = 0;
    for (let i = 0; i < 6; i++) {
        sum += Number(imo[i]) * (7 - i);
    }
    const check = sum % 10;
    return check === Number(imo[6]);
}

export function imoPartitionKey(imo) {
    const d = digitsOnlyImo(imo);
    return d ? d.slice(0, 2) : '00';
}
