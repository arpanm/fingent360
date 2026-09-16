/** Narrow parser of the FOMC statement target-range wording; never a generic fraction normalizer. */
export function parseFedTargetRange(quote: string) {
  if (quote.length > 800)
    throw Error('Use one retained FOMC target-range excerpt.');
  const token = '([0-9]{1,2}(?:-[1-3]/[24])?)';
  const pattern = new RegExp(
    `target range for the federal funds rate (?:by [0-9]+/[24] percentage points? )?(?:at|to) ${token} to ${token} percent\\b`,
    'gi',
  );
  const matches = [...quote.replace(/\s+/g, ' ').matchAll(pattern)];
  if (matches.length !== 1)
    throw Error('Excerpt must contain one supported FOMC target range.');
  function decimal(raw: string) {
    const match = /^([0-9]{1,2})(?:-([1-3])\/([24]))?$/.exec(raw)!;
    const whole = BigInt(match[1]!);
    const numerator = BigInt(match[2] ?? '0'),
      denominator = BigInt(match[3] ?? '1');
    if (numerator >= denominator || whole > 20n)
      throw Error('Unsupported FOMC rate token.');
    const hundredths = whole * 100n + (numerator * 100n) / denominator;
    return {
      value: `${hundredths / 100n}${
        hundredths % 100n
          ? '.' +
            String(hundredths % 100n)
              .padStart(2, '0')
              .replace(/0$/, '')
          : ''
      }`,
      hundredths,
    };
  }
  const rawLower = matches[0]![1]!,
    rawUpper = matches[0]![2]!;
  const lower = decimal(rawLower),
    upper = decimal(rawUpper);
  if (lower.hundredths > upper.hundredths)
    throw Error('FOMC target bounds are reversed.');
  return {
    lower: lower.value,
    upper: upper.value,
    rawLower,
    rawUpper,
    method: 'fomc-statement-quarter-fractions-v1' as const,
  };
}
