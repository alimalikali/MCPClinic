# ADR 0001: Compatibility spike before product expansion

- **Status:** accepted
- **Date:** 2026-09-23
- **Decision owners:** Ali and MCP Clinic maintainers

## Context

MCP Clinic is intended to diagnose a current Streamable HTTP deployment using
the official TypeScript SDK, Keycloak, and Nginx. Protocol prose, an SDK, an
identity provider, and a conformance harness are independently versioned. A
passing request in one component cannot establish compatibility for the stack.

The repository previously began with a fixture-only diagnostic engine. That is
useful test scaffolding, but it is not the first acceptance gate and it must not
be presented as support for the proposed `2026-07-28` profile.

## Decision

Development is gated on a compatibility spike with this order:

1. Recheck the dated specification and official SDK documentation.
2. Resolve exact released SDK, conformance, Keycloak, Nginx, and PostgreSQL
   versions. Record immutable package versions and container digests.
3. Build the smallest healthy Express server and official SDK client directly,
   before adding Nginx or Keycloak.
4. Add Keycloak authorization code + PKCE and prove discovery, token acquisition,
   protected tool listing, and an explicit `clinic_echo` call.
5. Add Nginx, prove the same flow, and then introduce the static F09 header-strip
   configuration with correlated client, proxy-ingress, and server-ingress
   observations.
6. Pin and inspect the conformance harness's actual CLI and scenario inventory.

The current profile and any legacy profile will use separate adapters and
fixtures. There will be no silent protocol downgrade. No support statement is
made until an integration test exercises the exact recorded versions.

## Security boundaries for the spike

- OAuth secrets exist only in worker memory and are never fixtures or logs.
- Development TLS uses a generated local CA; global TLS verification bypasses
  are forbidden.
- The lab is loopback-only and uses generated local credentials.
- Observer output is constructed from allowlisted fields before it is emitted.
- Only `clinic_echo`, with a nonce-shaped input and no external side effect, may
  be invoked automatically in the lab.

## Consequences

The fixture engine remains explicitly pre-integration scaffolding. UI, Python,
LangGraph, retrieval, and hosted tracing work do not start while M0 is blocked.
If the selected released SDK cannot implement the dated profile, the project
records the mismatch and changes either its dependency or claimed profile in a
new ADR rather than emulating a different wire lifecycle.

