import assert from "node:assert/strict";
import test from "node:test";
import { assertExpectedCosignRejection } from "../scripts/lib/cosign-negative-result.mjs";

const packageDiagnostic = "failed to verify signature: provided artifact digest does not match any digest in statement";
const indexDiagnostic = "failed to verify signature: could not verify message: invalid signature when validating ASN.1 encoded signature";
const result = (diagnostic, extra = {}) => ({ status: 1, signal: null, error: null, stdout: "", stderr: `Error: ${diagnostic}\nerror during command execution: ${diagnostic}\n`, ...extra });

test("accepts the pinned package-digest rejection", () => assert.equal(assertExpectedCosignRejection(result(packageDiagnostic), "package-digest"), true));
test("accepts the pinned index-bytes rejection", () => assert.equal(assertExpectedCosignRejection(result(indexDiagnostic), "index-bytes"), true));
test("allows either exact cosign wrapper line", () => assertExpectedCosignRejection({ ...result(packageDiagnostic), stderr: `Error: ${packageDiagnostic}\n` }, "package-digest"));
for (const [label, bad] of [
  ["success", result(packageDiagnostic, { status: 0 })],
  ["TUF connection reset", result(packageDiagnostic, { stderr: `Error: ${packageDiagnostic}\nerror during command execution: connection reset by peer\n` })],
  ["ENOENT", result(packageDiagnostic, { status: null, error: { code: "ENOENT" } })],
  ["timeout", result(packageDiagnostic, { status: null, signal: "SIGTERM" })],
  ["certificate identity failure", result("certificate identity does not match")],
  ["unknown signature error", result("failed to verify signature: unknown failure")],
  ["combined expected and network error", result(`${packageDiagnostic}; connection reset by peer`)],
]) test(`rejects ${label}`, () => assert.throws(() => assertExpectedCosignRejection(bad, "package-digest")));
test("rejects stdout and wrong diagnostic kind", () => {
  assert.throws(() => assertExpectedCosignRejection(result(packageDiagnostic, { stdout: "Verified OK" }), "package-digest"));
  assert.throws(() => assertExpectedCosignRejection(result(packageDiagnostic), "index-bytes"));
  assert.throws(() => assertExpectedCosignRejection(result(packageDiagnostic), "unknown"));
});
