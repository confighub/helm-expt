// Diagnostics observed with the repository-pinned cosign v3.1.3.
// Review these on a tool upgrade; unrelated failures never prove tamper rejection.
const DIAGNOSTICS = Object.freeze({
  "package-digest": "failed to verify signature: provided artifact digest does not match any digest in statement",
  "index-bytes": "failed to verify signature: could not verify message: invalid signature when validating ASN.1 encoded signature",
});

export function assertExpectedCosignRejection(result, kind) {
  if (!Object.hasOwn(DIAGNOSTICS, kind)) throw new Error(`unknown expected cosign rejection kind: ${String(kind)}`);
  if (!result || result.status !== 1) throw new Error("cosign rejection must exit with status 1");
  if (result.signal != null) throw new Error("cosign rejection must not be signal-terminated");
  if (result.error != null) throw new Error("cosign rejection must not have a process error");
  if (toText(result.stdout) !== "") throw new Error("cosign rejection must not write stdout");
  const diagnostic = DIAGNOSTICS[kind];
  const allowed = new Set([`Error: ${diagnostic}`, `error during command execution: ${diagnostic}`]);
  const lines = toText(result.stderr).split(/\r?\n/).filter(Boolean);
  if (lines.length === 0 || lines.some((line) => !allowed.has(line))) throw new Error(`cosign stderr is not the expected ${kind} diagnostic`);
  return true;
}

function toText(value) {
  return value == null ? "" : Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
}
