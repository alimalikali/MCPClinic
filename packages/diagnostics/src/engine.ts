import type { Diagnosis, DiagnosticReport, TraceBundle, TraceEvent } from "../../contracts/src/index.ts";

const actors = new Set(["clinic_client", "proxy_ingress", "server_ingress", "identity_provider"]);
const kinds = new Set(["request", "response", "validation", "gap", "policy_block"]);
const provenance = new Set(["live_probe", "local_observer", "import", "fixture"]);
const eventKeys = new Set(["schemaVersion", "runId", "eventId", "sequence", "requestId", "attemptId", "parentEventId", "sourceId", "sourceSequence", "actor", "stage", "kind", "timestamp", "monotonicOffsetMs", "method", "urlSafe", "statusCode", "authorization", "facts", "redactionVersion", "provenance"]);
const allowedFacts = new Set(["coverageComplete", "droppedEvents", "validationResult", "route", "upstreamRoute", "protocolProfile"]);

export function validateBundle(value: unknown): asserts value is TraceBundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("trace bundle must be an object");
  const bundle = value as Record<string, unknown>;
  const unexpected = Object.keys(bundle).filter((key) => !["schemaVersion", "runId", "events"].includes(key));
  if (unexpected.length) throw new Error(`unknown bundle field(s): ${unexpected.join(", ")}`);
  if (bundle.schemaVersion !== "1.0" || typeof bundle.runId !== "string" || !Array.isArray(bundle.events)) throw new Error("invalid trace bundle header");
  const eventIds = new Set<string>();
  for (const raw of bundle.events) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("event must be an object");
    const event = raw as Record<string, any>;
    const unknown = Object.keys(event).filter((key) => !eventKeys.has(key));
    if (unknown.length) throw new Error(`event ${event.eventId ?? "?"} has unknown field(s): ${unknown.join(", ")}`);
    if (event.schemaVersion !== "1.0" || event.runId !== bundle.runId) throw new Error(`event ${event.eventId ?? "?"} has an incompatible version or run ID`);
    for (const key of ["eventId", "sourceId", "stage", "timestamp", "redactionVersion"]) if (typeof event[key] !== "string" || !event[key]) throw new Error(`event is missing ${key}`);
    if (!Number.isInteger(event.sequence) || event.sequence < 0 || !actors.has(event.actor) || !kinds.has(event.kind) || !provenance.has(event.provenance)) throw new Error(`event ${event.eventId} has an invalid enum or sequence`);
    if (Number.isNaN(Date.parse(event.timestamp))) throw new Error(`event ${event.eventId} has an invalid timestamp`);
    if (eventIds.has(event.eventId)) throw new Error(`duplicate event ID: ${event.eventId}`);
    eventIds.add(event.eventId);
    if (event.urlSafe && (/\?|#|@/.test(event.urlSafe))) throw new Error(`event ${event.eventId} urlSafe contains unsafe URL components`);
    if (!event.facts || typeof event.facts !== "object" || Array.isArray(event.facts)) throw new Error(`event ${event.eventId} facts must be an object`);
    const unsafeFacts = Object.keys(event.facts).filter((key) => !allowedFacts.has(key));
    if (unsafeFacts.length) throw new Error(`event ${event.eventId} has non-allowlisted fact(s): ${unsafeFacts.join(", ")}`);
    if (event.authorization) {
      if (!["observed", "not_observed", "not_applicable"].includes(event.authorization.status)) throw new Error(`event ${event.eventId} has invalid authorization status`);
      if (event.authorization.status !== "observed" && "present" in event.authorization) throw new Error(`event ${event.eventId} cannot state presence when authorization was not observed`);
    }
  }
}

function diagnosis(partial: Partial<Diagnosis> & Pick<Diagnosis, "id" | "ruleId" | "category" | "summary">): Diagnosis {
  return { stage: "mcp_request", severity: "error", confidence: "unknown", evidenceIds: [], counterEvidenceIds: [], candidateOwners: ["unknown"], ownerAttribution: "unknown", missingEvidence: [], nextCheck: "Collect complete observations at adjacent boundaries.", remediation: "Do not change configuration until the missing boundary evidence is collected.", verificationRecipe: "Rerun the same request and compare explicitly correlated observations.", docReferences: [], applicability: ["2026-07-28"], limitations: [], ...partial };
}

function authorizationObserved(event: TraceEvent, present: boolean): boolean {
  return event.authorization?.status === "observed" && event.authorization.present === present;
}

export function diagnose(input: unknown): DiagnosticReport {
  validateBundle(input);
  const bundle = input;
  const findings: Diagnosis[] = [];
  const sourceSequences = new Map<string, Map<number, TraceEvent[]>>();
  for (const event of bundle.events) {
    if (event.sourceSequence === undefined) continue;
    const bySequence = sourceSequences.get(event.sourceId) ?? new Map<number, TraceEvent[]>();
    bySequence.set(event.sourceSequence, [...(bySequence.get(event.sourceSequence) ?? []), event]);
    sourceSequences.set(event.sourceId, bySequence);
  }
  const duplicates = [...sourceSequences.values()].flatMap((map) => [...map.values()].filter((events) => events.length > 1)).flat();
  if (duplicates.length) findings.push(diagnosis({ id: "correlation-integrity", ruleId: "CORRELATION_DUPLICATE_SOURCE_SEQUENCE", category: "correlation_integrity", severity: "warning", confidence: "confirmed", summary: "Observer records contain duplicate source sequence numbers; boundary attribution is unsafe.", evidenceIds: duplicates.map((event) => event.eventId), candidateOwners: ["unknown"], limitations: ["Other findings are suppressed until correlation integrity is restored."] }));
  if (!duplicates.length) {
    const requests = new Map<string, TraceEvent[]>();
    for (const event of bundle.events) if (event.requestId) requests.set(event.requestId, [...(requests.get(event.requestId) ?? []), event]);
    for (const [requestId, events] of requests) {
      const client = events.find((event) => event.actor === "clinic_client" && event.kind === "request");
      const proxy = events.find((event) => event.actor === "proxy_ingress" && event.kind === "request");
      const server = events.find((event) => event.actor === "server_ingress" && event.kind === "request");
      if (client && authorizationObserved(client, false)) findings.push(diagnosis({ id: `${requestId}-client-omission`, ruleId: "F08_CLIENT_AUTHORIZATION_OMITTED", category: "authorization_missing", confidence: "confirmed", summary: `Clinic did not send authorization on request ${requestId}.`, evidenceIds: [client.eventId], candidateOwners: ["client"], ownerAttribution: "client", nextCheck: "Inspect the run's token acquisition and request construction stages.", remediation: "Attach the acquired Bearer token to the protected MCP request.", verificationRecipe: `Rerun request ${requestId} and confirm Clinic outbound observes a Bearer header.` }));
      else if (proxy && server && authorizationObserved(proxy, true) && authorizationObserved(server, false)) findings.push(diagnosis({ id: `${requestId}-proxy-boundary-loss`, ruleId: "F09_AUTHORIZATION_BOUNDARY_LOSS", category: "authorization_boundary_loss", confidence: "confirmed", summary: `Authorization disappeared between proxy ingress and server ingress for request ${requestId}.`, evidenceIds: [proxy.eventId, server.eventId], candidateOwners: ["proxy_boundary", "configuration"], ownerAttribution: "proxy_boundary", nextCheck: "Review the loaded proxy route for authorization forwarding or clearing directives.", remediation: "Restore authorization forwarding for this route after reviewing the configuration change.", verificationRecipe: `Rerun request ${requestId}; require Bearer presence at both proxy and server ingress.` }));
      else if (client && server && authorizationObserved(client, true) && authorizationObserved(server, false) && !proxy) findings.push(diagnosis({ id: `${requestId}-unisolated-loss`, ruleId: "AUTHORIZATION_UNISOLATED_BOUNDARY_LOSS", category: "authorization_boundary_loss", confidence: "supported", summary: `Clinic sent authorization but the server did not receive it for request ${requestId}; the responsible boundary is not isolated.`, evidenceIds: [client.eventId, server.eventId], candidateOwners: ["multiple", "unknown"], ownerAttribution: "unknown", missingEvidence: ["proxy ingress authorization observation"], nextCheck: "Add a proxy ingress observation for the same explicitly correlated request.", limitations: ["This evidence does not prove that Nginx removed the header."] }));
      else if (proxy && authorizationObserved(proxy, true) && !server) findings.push(diagnosis({ id: `${requestId}-missing-server-observation`, ruleId: "AUTHORIZATION_SERVER_EVIDENCE_GAP", category: "evidence_gap", severity: "warning", confidence: "unknown", summary: `Authorization reached proxy ingress for request ${requestId}, but server ingress was not observed.`, evidenceIds: [proxy.eventId], candidateOwners: ["unknown"], missingEvidence: ["server ingress observation"], nextCheck: "Collect a pre-auth server ingress observation with the same proxy-generated request ID.", limitations: ["Proxy ingress cannot establish upstream header presence."] }));
    }
  }
  return { schemaVersion: "1.0", runId: bundle.runId, outcome: findings.length ? "findings" : bundle.events.length ? "healthy" : "unknown", diagnoses: findings };
}

export function toMarkdown(report: DiagnosticReport): string {
  const lines = [`# MCP Clinic report: ${report.runId}`, "", `**Outcome:** ${report.outcome}`, ""];
  if (!report.diagnoses.length) lines.push("No deterministic finding was produced from the supplied evidence.");
  for (const item of report.diagnoses) lines.push(`## ${item.summary}`, "", `- **Confidence:** ${item.confidence}`, `- **Owner:** ${item.ownerAttribution}`, `- **Evidence:** ${item.evidenceIds.join(", ") || "none"}`, `- **Missing evidence:** ${item.missingEvidence.join(", ") || "none"}`, `- **Next check:** ${item.nextCheck}`, `- **Remediation:** ${item.remediation}`, `- **Verification:** ${item.verificationRecipe}`, ...(item.limitations.map((value) => `- **Limitation:** ${value}`)), "");
  return `${lines.join("\n")}\n`;
}
