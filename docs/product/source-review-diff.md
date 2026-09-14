# Stored source review comparison

SOURCE-REVIEW-DIFF-001 is an explicit operator workflow, not a provider refresh or market-impact analysis. Before publication, an operator reads the actual current head and nearest earlier non-draft edition. A withdrawn predecessor remains visible only through authenticated operator access; public tombstones remain unchanged. A first publication has no prior public edition. Intermediate drafts are not mistaken for published baselines.

The read locks the source head, checks the requested version, rechecks the operator session after the lock, and returns retained immutable originals plus exact field differences. Text is rendered as text. Topics preserve their recorded order. Publication/effective/retrieval/review dates, source identity/rights, hashes, body and correction notes are compared without interpretation. No new database or copied evidence is introduced.

Publication and withdrawal keep the existing exact expected-version transaction. A later head returns409 and disables action until explicit reload/review. Successful mutation immediately becomes a dated receipt, even if a following refresh fails; it never leaves the same action casually retryable. Evidence is opened for an explicit examined edition through protected existing evidence admission, then Back returns to comparison. Any401 clears protected content and returns to operator sign-in; generations prevent late responses from restoring it. Closing cancels reads.

The dialog supports keyboard controls, mobile wrapping, explicit review notes and separate publish/withdraw buttons. Device mode continues to show the connected Operations notice without any API calls. Four-eyes approval, broader roles, source licensing and production acceptance remain separate gates.

Verification: author API, browser and packaged cases460/470 ranges using labelled synthetic stored editions and actual isolated services. No runtime verification is inferred from this specification.
