import { randomUUID } from 'node:crypto';
export {
  test,
  expect,
  indiaActors,
  indiaReview,
  retentionHeaders,
} from './india-macro';
/** Reconstructed minimal official grammar with independently encoded dated facts; not original captured HTML. */
export function indiaGdpInput() {
  return {
    requestId: randomUUID(),
    releaseUrl: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2304949',
    rightsEvidence:
      'TEST-SIMULATION: reconstructed markup, no provider permission claimed.',
    rightsConfirmed: true,
    releaseHtml:
      '<h2>QUARTERLY ESTIMATES OF GROSS DOMESTIC PRODUCT FOR THE FIRST QUARTER (APRIL-JUNE) OF 2026-27</h2>Posted On: 31 AUG 2026 4:00PM by PIB Delhi<p>Ministry of Statistics and Programme Implementation quarterly estimates at Constant (2022-23) and Current prices.</p><p>Real GDP or GDP at Constant Prices in Q1 of FY 2026-27 is estimated at ₹81.36 lakh crore, against ₹75.46 lakh crore in Q1 of FY 2025-26, showing a growth rate of 7.8%.</p><p>Quarterly estimates follow Benchmark-Indicator methodology.</p><p>The next release of Quarterly GDP estimates for the Second Quarter (July-September) of FY 2026-27 (Q2, 2026-27) is scheduled on 30th November, 2026.</p>',
  };
}
