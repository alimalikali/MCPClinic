import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { diagnose, validateBundle } from "../src/engine.ts";

async function fixture(name: string) { return JSON.parse(await readFile(new URL(`../../../fixtures/${name}`, import.meta.url), "utf8")); }

test("confirms loss only with observations on both proxy boundaries", async () => {
  const report = diagnose(await fixture("f09-confirmed.json"));
  assert.equal(report.diagnoses[0].ruleId, "F09_AUTHORIZATION_BOUNDARY_LOSS");
  assert.equal(report.diagnoses[0].confidence, "confirmed");
  assert.equal(report.diagnoses[0].ownerAttribution, "proxy_boundary");
});

test("does not blame the proxy when proxy ingress evidence is absent", async () => {
  const report = diagnose(await fixture("f09-incomplete.json"));
  assert.equal(report.diagnoses[0].confidence, "supported");
  assert.equal(report.diagnoses[0].ownerAttribution, "unknown");
  assert.match(report.diagnoses[0].limitations[0], /does not prove/);
});

test("not_observed cannot be represented as absent", async () => {
  const value = await fixture("f09-confirmed.json");
  value.events[2].authorization = { status: "not_observed", present: false };
  assert.throws(() => validateBundle(value), /cannot state presence/);
});

test("rejects arbitrary facts and unsafe URLs before analysis", async () => {
  const value = await fixture("f09-confirmed.json");
  value.events[0].facts.authorization = "Bearer secret";
  assert.throws(() => validateBundle(value), /non-allowlisted/);
  delete value.events[0].facts.authorization;
  value.events[0].urlSafe = "https://user:pass@example.test/mcp?token=secret";
  assert.throws(() => validateBundle(value), /unsafe URL/);
});

test("duplicate observer sequence suppresses boundary diagnosis", async () => {
  const value = await fixture("f09-confirmed.json");
  value.events.push({ ...value.events[2], eventId: "server-duplicate", sequence: 4 });
  const report = diagnose(value);
  assert.deepEqual(report.diagnoses.map((item) => item.ruleId), ["CORRELATION_DUPLICATE_SOURCE_SEQUENCE"]);
});
