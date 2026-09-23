# MCP Clinic

MCP Clinic is a local, evidence-first diagnostic tool for MCP connections. This
repository currently contains the first executable vertical slice: a versioned
trace contract, a deterministic correlation/rules engine, sanitized fixtures,
and a CLI that exports JSON or Markdown reports without an AI API key.

> **Compatibility status:** M0 is currently blocked. The proposed MCP profile,
> SDK, Keycloak, Nginx, and conformance versions have not been resolved or tested
> in this environment. See [the compatibility report](docs/compatibility.md) and
> [current progress](docs/progress.md). The fixture CLI is not a live MCP probe.

## Quick start

Node.js 24 or newer is required. No dependency installation is needed.

```sh
pnpm test
pnpm clinic -- fixtures/f09-confirmed.json
pnpm clinic -- fixtures/f09-incomplete.json --format json
```

The engine distinguishes an observed absence from missing evidence. In the
complete F09 fixture it identifies the proxy/server boundary. Remove the proxy
observation and it deliberately lowers attribution rather than blaming Nginx.

## Implemented scope

- `TraceEvent` schema version 1.0 with allowlisted event fields.
- Structural validation, source-sequence duplicate detection, and conservative
  correlation by explicit request ID only.
- Deterministic diagnoses for client omission, boundary header loss, incomplete
  boundary evidence, and contradictory observations.
- Stable JSON report contract and human-readable Markdown output.
- Credential leakage guardrails: unknown top-level fields and unknown fact keys
  are rejected, and URLs containing query strings or credentials are rejected.

This is a foundation, not a claim that the complete v0.1 plan is implemented.
OAuth browser handoff, live probes, observers, PostgreSQL persistence, the web
timeline, deployment lab, and the remaining fault corpus are subsequent slices.

Implementation is intentionally gated by [ADR 0001](docs/adr/0001-scope.md): no
live compatibility claim is made until a healthy flow passes with exact pinned
artifacts and the official SDK.

## Fixture format

Each fixture is a JSON object with `schemaVersion`, `runId`, and `events`. Ground
truth labels are intentionally not part of the trace consumed by the engine.
See [`packages/contracts/schema/trace-bundle.schema.json`](packages/contracts/schema/trace-bundle.schema.json).

## Safety properties

Clinic does not infer absence from a missing event or null value. It never
correlates events by timestamp proximity. Reports cite event IDs and explicitly
list missing evidence. Raw authorization values, cookies, query strings, and
arbitrary facts do not fit the accepted trace contract.
