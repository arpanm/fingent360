# Saved-goal acceptance — GOALS-001

Run the user-owned command `pnpm sdlc "Complete saved goals" --story GOALS-001` with current databases, migrations and API/web available. No additional dependency, source entitlement or migration is introduced by this closure pass.

- API060/061: exact money/projections, repeat goal types, owner isolation, version conflicts, revision history, validation, consent and origin boundaries.
- WEB060/062/066/067 on desktop/mobile: real create/edit/reload/remove, unavailable versus signed-out states, draft cancellation, authoritative save receipt and stable input focus.
- WEB068: cancel removal without losing the draft; remove a different goal while preserving it; confirm removal of the edited goal from review, close the editor, restore focus and clear the navigation guard. Verify the actual persisted empty list and reload.
- WEB069: delay an actual original list reply, reload current records and delete through the real API, then release the old reply. The deleted goal must not reappear; the other goal remains.
- OFFLINE010/068: exact on-device finance persistence and the same removal/draft flow with no API network traffic. Native release certification is separate.

New cases are authored only. Complete passing evidence closes this bounded saved-goal story; partial, stale or failing coverage does not. Continue to standard workbook imports only after this story's acceptance closes.
