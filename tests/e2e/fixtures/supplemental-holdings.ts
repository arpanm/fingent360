// Synthetic user-defined mapping only. No claim that these are broker headers or values.
export const supplementalCsv =
  'Security,Units,Displayed average,Private note\nINE002A01018,3,33.33,SYNTHETIC discarded source note\nINE002A01018,0.000001,N/A,SYNTHETIC discarded source note';
export const supplementalInput = () => ({
  format: 'supplemented-csv' as const,
  csv: supplementalCsv,
  mapping: {
    isinColumn: 0,
    quantityColumn: 1,
    costUnit: 'INR-rupees' as const,
    duplicates: 'combine' as const,
  },
  declaredRowCount: 2,
  declaredTotal: '100.01',
  supplement: {
    origin: 'user-attested-acquisition-cost' as const,
    basis: 'trade-confirmations' as const,
    attested: true as const,
    rows: [
      {
        sourceRow: 2,
        isin: 'INE002A01018',
        quantity: '3',
        totalCost: '100.00',
      },
      {
        sourceRow: 3,
        isin: 'INE002A01018',
        quantity: '0.000001',
        totalCost: '0.01',
      },
    ],
  },
});
