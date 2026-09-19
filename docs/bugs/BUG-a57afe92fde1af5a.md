# BUG-a57afe92fde1af5a

- Status: Resolved
- Case/project: E2E-OFFLINE-960 / offline
- Stories: IMPACT-TRACE-001
- First seen: 2026-09-18T17:19:16.322Z
- Evidence: artifacts/sdlc/1789751750850-92480/08-pnpm-android_test.log
- Resolution run: 1789848189876-42077

Failure excerpt (untrusted; local original has full details):

    ZodError: [
      {
        "code": "custom",
        "message": "Event, source, identity and graph revisions do not reconcile.",
        "path": [
          "event"
        ]
      }
    ]

      113 |   );
      114 |   event.graph.events[0]!.publicationState = 'published';
    > 115 |   const publicEvent = EventPublicSchema.parse({
          |                                         ^
      116 |     id,
      117 |     status: 'published',
      118 |     event,
        at fixture (/Users/arpanmacmini/code/fingent360/tests/e2e/cases/offline/impact-trace.spec.ts:115:41)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/offline/impact-trace.spec.ts:193:36
