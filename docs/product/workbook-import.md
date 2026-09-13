# Standard holdings workbook import — XLSX-001

This child delivers one user-authored XLSX format, not broker onboarding. Holdings remain unverified user records; acquisition cost is not market value. CSV and manual entry remain available. A workbook replaces the entire holdings list only after review, explicit storage consent and confirmation.

## Template and journey

My holdings → Import CSV or XLSX → Download blank XLSX template (or the explicitly synthetic sample). The workbook has exactly two visible sheets: Holdings with `isin,quantity,total_cost_paise` headers, and Reconciliation with `row_count,total_cost_paise` plus one declared totals row. Populate at most200 consecutive holdings rows. Quantities support6 decimal places. Whole-paise acquisition costs use existing exact integer limits. Enter values exceeding15 significant digits as text: Excel cannot preserve all digits in numeric cells. Text-formatted sample cells avoid silent rounding. Reconciliation totals are manually declared values, not formulas.

Upload validates locally in a disposable worker and exposes normalized rows. Failure leaves the old draft intact. Editing normalized rows switches to CSV, visibly discarding workbook reconciliation metadata. Preview revalidates the original workbook on the server, or in an on-device worker, before creating the same30-minute owned preview used by CSV. Confirm saves an immutable holdings edition; retries return the saved edition. Changed holdings versions reject. No raw workbook, filename or path is retained in the database/export. Normalized rows and parser/reconciliation metadata are retained and removed with the account.

## Parser and boundaries

Pinned fflate0.8.3 and fast-xml-parser5.11.1. Input64KiB;32 ZIP entries;512KiB expanded per entry;2MiB aggregate; bounded node/row/shared-string/depth counts. ZIP directory/local metadata, nonoverlapping ranges, sizes and CRCs must agree. No ZIP64, encryption, streaming descriptors, arbitrary compressed methods, macros, embedded binary parts, formulas, external relationships, hidden sheets or merged cells. Reject DTD/entity declarations; disable automatic entity processing and numeric conversion. A fixed `inflateSync` output buffer of declared size+1 bounds expansion allocations and detects undersized declarations before XML processing. This alone is not a CPU deadline: Node and browser workers terminate after2seconds. Browser parsing never runs on the UI thread. No provider calls, formula evaluation or file extraction occurs.

The parser intentionally rejects layouts outside this contract. LibreOffice/Excel round trips and physical Android file-picker behavior are acceptance gates, not claimed validated by authorship. Full broker parser onboarding under SRC-013 remains open.

## Acceptance

Blank/synthetic template download; exact long text cost and fractional quantities; mismatch/duplicate/formula/date/bomb/CRC failures preserve current records; owned preview, stale version and confirmation replay; local no-network persistence and export; mobile upload, errors, corrections and review. Test evidence belongs in the handoff after parent-run gates.

Numeric cells require an absent style table or a General-format default cellXfs[0] with no nonzero base-style reference. Explicit cell, row or column styles reject numeric cells. This prevents date/scientific formatting inherited through default styles from converting serials into quantities. Plain text cells retain their exact content regardless of text formatting; General unstyled numeric decimals remain supported.

An actual synthetic sample saved by openpyxl3.1.5 is retained as a regression fixture, including 16-digit text paise. Harmless prefixed document metadata/theme elements are validated then discarded; functional worksheet/relationship elements remain unqualified. Rooted internal worksheet relationships are restricted to known package parts with traversal/external paths rejected. This compatibility evidence does not assert Excel/LibreOffice or physical-phone acceptance.
