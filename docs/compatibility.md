# Compatibility spike

**Checked:** 2026-09-23  
**Status:** blocked before dependency selection

This document reports observations from the current development environment. It
does not promote the proposed versions in the implementation plan to verified
support claims.

## Intended primary evidence

| Component | Authority to inspect | Required evidence before selection | Status |
| --- | --- | --- | --- |
| MCP protocol | Dated specification at `modelcontextprotocol.io` | Transport and authorization requirements for the selected dated profile | Blocked: source unavailable from this environment |
| TypeScript SDK | Official SDK docs, release metadata, installed package | Exact release, exported v2 APIs, generated wire metadata, minimal client/server test | Blocked: docs and npm registry unavailable |
| Conformance | Official repository and pinned executable | Commit, CLI help, scenarios, requirement IDs, machine-readable output | Blocked: repository unavailable |
| Keycloak | Official release and MCP integration docs | Exact release, image digest, PKCE/audience behavior, documented RFC 8707 limitation | Blocked: docs and image registry unavailable |
| Nginx | Official image and directive docs | Exact release/image digest, header forwarding and streaming behavior | Blocked: docs/image registry unavailable |
| PostgreSQL | Official image metadata | Exact release and image digest | Blocked: image registry unavailable |

## Commands and observations

The following checks were run from the repository root on 2026-09-23:

```text
$ node --version
v24.15.0

$ pnpm --version
10.28.1

$ uv --version
uv 0.7.22

$ docker --version
bash: docker: command not found

$ curl -L --max-time 20 https://ts.sdk.modelcontextprotocol.io/v2/
curl: (56) CONNECT tunnel failed, response 403

$ curl -L --max-time 20 https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
curl: (56) CONNECT tunnel failed, response 403

$ curl -L --max-time 20 https://www.keycloak.org/securing-apps/mcp-authz-server
curl: (56) CONNECT tunnel failed, response 403

$ pnpm view @modelcontextprotocol/sdk versions --json
npm error code E403
npm error 403 Forbidden - GET https://registry.npmjs.org/@modelcontextprotocol%2fsdk
```

GitHub API and conformance package queries failed with the same network-policy
class of response. These failures are environment limitations, not evidence that
the projects or proposed releases do not exist.

## Compatibility matrix

No row is marked supported until the healthy flow runs against exact resolved
artifacts.

| Profile | SDK | Keycloak | Nginx | Conformance | Result |
| --- | --- | --- | --- | --- | --- |
| Proposed `2026-07-28` | unresolved | unresolved | unresolved | unresolved | **unverified** |
| Legacy `2025-11-25` | unresolved | unresolved | unresolved | unresolved | out of v0.1 scope |

## Unblocking recipe

On a machine with access to the official sites, npm registry, container registry,
and Docker Engine:

1. Re-run the source checks listed in `docs/versions.json`.
2. Select released artifacts based on their actual compatibility documentation;
   never substitute a guessed version or floating image tag.
3. Write exact package versions to `package.json`, run `pnpm install`, and commit
   the resulting lockfile.
4. Resolve container tags to `linux/amd64` and/or `linux/arm64` manifest digests,
   use digest-qualified Compose images, and record those digests in the manifest.
5. Capture `--help` and scenario-list output from the pinned conformance tool.
6. Run the direct SDK smoke test, then the Keycloak flow, then the proxied flow.
7. Replace `unverified` only with the observed result and link its integration
   test. Record provider limitations independently from connection success.

