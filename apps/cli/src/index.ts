#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { diagnose, toMarkdown } from "../../../packages/diagnostics/src/engine.ts";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--") && arg !== "json" && arg !== "markdown");
const formatIndex = args.indexOf("--format");
const format = formatIndex >= 0 ? args[formatIndex + 1] : "markdown";
if (!file || !["json", "markdown"].includes(format)) {
  console.error("Usage: clinic <trace.json> [--format json|markdown]");
  process.exitCode = 2;
} else {
  try {
    const report = diagnose(JSON.parse(await readFile(file, "utf8")));
    process.stdout.write(format === "json" ? `${JSON.stringify(report, null, 2)}\n` : toMarkdown(report));
  } catch (error) {
    console.error(`clinic: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
