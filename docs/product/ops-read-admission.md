# Final operator admission for legacy reads

OPS-READ-ADMISSION-001 closes the interval between initial operator authorization and completion of a potentially blocked storage read. The protected discovery items/runs and source registry list/history controllers authorize first, await their existing store query, then authorize again before returning any protected payload. OperatorStore performs its session lookup as a new database statement, so the final check observes expiry/revocation after the storage wait rather than a stale transaction timestamp.

No data schema, new screen, new identity or provider behavior is introduced. Existing source locks, immutable originals, public projections and permissions remain intact. A storage failure stays a storage failure. If storage succeeds but the session expired or was revoked, return401 without the protected result. A newly authenticated request can read the unchanged stored data.

The existing shared Operations request-generation barrier clears protected state on401 and prevents late old responses from restoring it. Device Operations continues to explain connected access and makes no API calls. Acceptance uses actual isolated storage table locks, expiry/revocation and fresh-login controls, not fabricated success payloads. Broader roles, production review and other mutation policies remain separate.
