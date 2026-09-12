# ADR 0001: Modular React/NestJS application with PostgreSQL and MongoDB

Status: Accepted for the foundation, 2026-09-12.

## Context

The user explicitly replaced the earlier Temporal proposal with React, Node/Java, PostgreSQL and MongoDB. Additional infrastructure is justified only by measured scale. Development must preserve evidence, determinism and replaceable provider adapters.

## Decision

Use a pnpm workspace with React/TypeScript and Vite in `apps/web`, NestJS in `apps/api`, and runtime schemas in `packages/contracts`. Packages expose compiled ESM and type declarations. The workspace builds dependencies first. Node 24 is the CI runtime; Node 26 is permitted locally. Exact dependency versions and the lockfile make installation reproducible.

PostgreSQL owns canonical facts, identities, portfolios, goals, relational causal edges, audits and future job/outbox tables. MongoDB owns document snapshots, filings, extracted working documents and explanation versions. There is no domain schema or migration yet: first define the contract/data dictionary and then add tracked migrations. Database readiness performs `SELECT 1` and MongoDB `ping` rather than claiming availability from configuration alone.

Start future asynchronous work with PostgreSQL jobs/outbox, leases and idempotency. Java/Spring Boot remains a future option for a module with demonstrable benefit. Do not duplicate implementations.

## Consequences

One language initially simplifies shared schemas and local development. Vite gives a small responsive web foundation; routing, installability and safe offline behavior remain planned features. A later SSR decision can be recorded if public discovery requires it. No need for Temporal, Redis, Kafka, Elasticsearch, Kubernetes or specialised databases at setup time.

Local Compose services are bound to loopback and use non-default ports to coexist with existing Mac databases. Named volumes survive shutdown. Production identity, secret management, deployment and database migrations are separate work.

## References

- User correction and current blueprint, sections 12 and 20.
- [NestJS setup](https://docs.nestjs.com/first-steps)
- [Vite setup](https://vite.dev/guide/)
- [pnpm configuration](https://pnpm.io/settings)
