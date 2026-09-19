# BUG-244c4c2d137eba0f

- Status: Open
- Case/project: E2E-OFFLINE-1021 / offline
- Stories: EVENT-SCENARIOS-001
- First seen: 2026-09-18T19:39:46.662Z
- Evidence: artifacts/sdlc/1789752953639-97020/08-pnpm-android_test.log
- Resolution run: Unresolved

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

      107 |   );
      108 |   event.graph.events[0]!.publicationState = 'published';
    > 109 |   const publicEvent = EventPublicSchema.parse({
          |                                         ^
      110 |     id,
      111 |     status: 'published',
      112 |     event,
        at fixture (/Users/arpanmacmini/code/fingent360/tests/e2e/cases/offline/event-scenarios.spec.ts:109:41)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/offline/event-scenarios.spec.ts:212:39
