import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";

// Load this file with Node's --import while running a proof command. It
// observes Python subprocesses without changing the command being profiled:
//   node --import ./scripts/profile-proof-python.mjs scripts/generate-public-site.mjs --verify
const originalSpawnSync = childProcess.spawnSync;
const pairs = new Map();

childProcess.spawnSync = function profiledSpawnSync(command, args, options) {
  const pair = pythonPair(command, args);
  const started = performance.now();
  const result = originalSpawnSync.call(this, command, args, options);
  if (pair) {
    const row = pairs.get(pair) ?? { calls: 0, milliseconds: 0 };
    row.calls += 1;
    row.milliseconds += performance.now() - started;
    pairs.set(pair, row);
  }
  return result;
};
syncBuiltinESMExports();

process.on("exit", (exitCode) => {
  const groups = [...pairs.values()];
  const metrics = {
    pythonCalls: groups.reduce((total, row) => total + row.calls, 0),
    uniqueScriptAndInputPairs: pairs.size,
    repeatedCalls: groups.reduce((total, row) => total + Math.max(0, row.calls - 1), 0),
    pythonMilliseconds: Math.round(groups.reduce((total, row) => total + row.milliseconds, 0)),
    exitCode,
    repeatedPairGroups: groups
      .filter((row) => row.calls > 1)
      .map((row) => ({ calls: row.calls, milliseconds: Math.round(row.milliseconds) })),
  };
  const encoded = `${JSON.stringify(metrics, null, 2)}\n`;
  const outputPath = process.env.HELM_EXPT_PROFILE_OUTPUT_PATH;
  if (outputPath) writeFileSync(outputPath, encoded);
  else process.stderr.write(`profile-proof-python: ${encoded}`);
});

function pythonPair(command, args) {
  if (command !== "python3" || !Array.isArray(args)) return null;
  const codeIndex = args.indexOf("-c");
  if (codeIndex < 0 || typeof args[codeIndex + 1] !== "string") return null;
  const script = args[codeIndex + 1];
  const match = script.match(/sys\.stdin\s*=\s*open\((['"])(.+?)\1,\s*["']r["'],\s*encoding\s*=\s*["']utf-8["']\)/u);
  if (!match) return null;
  try {
    const input = readFileSync(match[2]);
    return createHash("sha256")
      .update(script.replace(match[2], "INPUT"))
      .update(input)
      .digest("hex");
  } catch {
    return null;
  }
}

// Keep this module preload-only; the explicit guard makes accidental direct
// execution fail with a useful invocation hint instead of silently doing no work.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stderr.write("Use: node --import scripts/profile-proof-python.mjs <proof-command> [args...]\n");
  process.exitCode = 2;
}
