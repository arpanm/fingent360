# BUG-efa18bcf6151b6e5

- Status: Resolved
- Case/project: Workflow stage / workflow
- Stories: Unmapped workflow failure
- First seen: 2026-09-18T05:11:23.620Z
- Evidence: artifacts/sdlc/1789669163056-59061/11-pnpm-build.log
- Resolution run: 1789722425545-83879

Failure excerpt (untrusted; local original has full details):

    $ pnpm -r build
    Scope: 3 of 4 workspace projects
    packages/contracts build$ tsc -p tsconfig.json
    packages/contracts build: src/bond-evidence.ts(40,58): error TS2339: Property 'observation' does not exist on type '{ status: "user-description-only"; } | { status: "historical-original-attached"; editionId: string; sourceUrl: string; sourceHash: string; sourceVersion: "icra-hudco-142975-annexure-v1"; ... 4 more ...; observation: { ...; }; }'.
    packages/contracts build:   Property 'observation' does not exist on type '{ status: "user-description-only"; }'.
    packages/contracts build: Failed
    /Users/arpanmacmini/code/fingent360/packages/contracts:
    [ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @fingent360/contracts@0.1.0 build: `tsc -p tsconfig.json`
    Exit status 2
    [ELIFECYCLE] Command failed with exit code 2.
