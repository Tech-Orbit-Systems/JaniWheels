import "dotenv/config";
import { environmentIssues } from "../src/lib/env";

const issues = environmentIssues(process.env, process.argv.includes("--launch"));
if (issues.length) {
  // Report variable names and corrections, never configuration values.
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else console.log("Environment validation passed. Provider connectivity and live acceptance are separate gates.");
