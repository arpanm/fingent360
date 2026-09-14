// Entirely synthetic user-defined columns; this is not a broker export.
export const mappedCsv =
  'Private note,Security code,Units,Purchase total\n"Synthetic, never retain",INE002A01018,1,100.00\nSynthetic second,INE002A01018,0.000001,0.01';
export const mappedInput = () => ({
  format: 'mapped-csv' as const,
  csv: mappedCsv,
  mapping: {
    isinColumn: 1,
    quantityColumn: 2,
    costColumn: 3,
    costUnit: 'INR-rupees' as const,
    duplicates: 'combine' as const,
  },
  declaredRowCount: 2,
  declaredTotal: '100.01',
});
