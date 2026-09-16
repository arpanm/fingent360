# BUG-99cc743e4a8bae69

- Status: Open
- Case/project: E2E-API-030 / api
- Story: ACCOUNT-001
- Evidence: artifacts/e2e/2026-09-16T06-37-46-458Z-27790/results.json
- Source revision: historical, unverified

Registration expected201 and received503. Local server encryption settings were absent; user confirmed a fresh installation. Run first-time key setup, restart the API and execute account acceptance. Only an actual passing retry resolves this bug. No test was executed while recording it.
