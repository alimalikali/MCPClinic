export type ObservationStatus = "observed" | "not_observed" | "not_applicable";
export type Actor = "clinic_client" | "proxy_ingress" | "server_ingress" | "identity_provider";
export type EventKind = "request" | "response" | "validation" | "gap" | "policy_block";

export interface TraceEvent {
  schemaVersion: "1.0";
  runId: string;
  eventId: string;
  sequence: number;
  requestId?: string;
  attemptId?: string;
  parentEventId?: string;
  sourceId: string;
  sourceSequence?: number;
  actor: Actor;
  stage: string;
  kind: EventKind;
  timestamp: string;
  monotonicOffsetMs?: number;
  method?: string;
  urlSafe?: string;
  statusCode?: number;
  authorization?: {
    status: ObservationStatus;
    present?: boolean;
    scheme?: "Bearer" | "other";
    tokenFingerprint?: string;
  };
  facts: Record<string, string | number | boolean | null>;
  redactionVersion: string;
  provenance: "live_probe" | "local_observer" | "import" | "fixture";
}

export interface TraceBundle {
  schemaVersion: "1.0";
  runId: string;
  events: TraceEvent[];
}

export type Confidence = "confirmed" | "supported" | "hypothesis" | "unknown";
export type Owner = "client" | "server" | "proxy_boundary" | "identity_provider" | "configuration" | "multiple" | "unknown";

export interface Diagnosis {
  id: string;
  ruleId: string;
  stage: string;
  category: string;
  severity: "info" | "warning" | "error";
  confidence: Confidence;
  summary: string;
  evidenceIds: string[];
  counterEvidenceIds: string[];
  candidateOwners: Owner[];
  ownerAttribution: Owner;
  missingEvidence: string[];
  nextCheck: string;
  remediation: string;
  verificationRecipe: string;
  docReferences: string[];
  applicability: string[];
  limitations: string[];
}

export interface DiagnosticReport {
  schemaVersion: "1.0";
  runId: string;
  outcome: "findings" | "healthy" | "unknown";
  diagnoses: Diagnosis[];
}
