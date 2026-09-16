export function sbiDisplayed(raw: string, places = 2) {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:[Ee]([+-]?\d+))?$/.exec(raw);
  if (!m || raw.length > 80) throw Error('Unsupported source decimal.');
  const exponent = Number(m[4] || 0);
  if (Math.abs(exponent) > 25) throw Error('Unsupported decimal exponent.');
  const digits = BigInt(m[2]! + (m[3] || '')),
    shift = places + exponent - (m[3]?.length || 0);
  const value =
    shift >= 0
      ? digits * 10n ** BigInt(shift)
      : (digits + 10n ** BigInt(-shift) / 2n) / 10n ** BigInt(-shift);
  const scale = 10n ** BigInt(places);
  return `${m[1] && value ? '-' : ''}${value / scale}${places ? '.' + (value % scale).toString().padStart(places, '0') : ''}`;
}
