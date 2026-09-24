import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/kube-prometheus-stack-proof.mjs", import.meta.url));
const archiveSHA256 = "b846cc368aaafd122148c8eec9b361d3893c6068d6301ec20d41c8023dcd8c88";

function runCandidate(env = {}) {
  const inherited = { ...process.env };
  for (const name of [
    "HELM_EXPT_KPS_MINIMAL_CANDIDATE",
    "HELM_EXPT_PROOF_OFFLINE_CANDIDATE",
    "HELM_EXPT_PROOF_OUTPUT_ROOT",
    "HELM_EXPT_CHART_VERSION",
  ]) delete inherited[name];
  return spawnSync(process.execPath, [script, "--help"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    env: { ...inherited, ...env },
  });
}

test("minimal candidate requires the KPS-specific offline gate", () => {
  const result = runCandidate({ HELM_EXPT_KPS_MINIMAL_CANDIDATE: "1" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires HELM_EXPT_PROOF_OFFLINE_CANDIDATE=1/);
});

test("minimal candidate requires an isolated output root", () => {
  const result = runCandidate({
    HELM_EXPT_KPS_MINIMAL_CANDIDATE: "1",
    HELM_EXPT_PROOF_OFFLINE_CANDIDATE: "1",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires an isolated HELM_EXPT_PROOF_OUTPUT_ROOT/);
});

test("minimal candidate is pinned to kube-prometheus-stack 87.19.2", () => {
  const result = runCandidate({
    HELM_EXPT_KPS_MINIMAL_CANDIDATE: "1",
    HELM_EXPT_PROOF_OFFLINE_CANDIDATE: "1",
    HELM_EXPT_PROOF_OUTPUT_ROOT: "data/candidate-test",
    HELM_EXPT_CHART_VERSION: "87.15.1",
    HELM_EXPT_CHART_ARTIFACT_SHA256: archiveSHA256,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /only supports kube-prometheus-stack 87\.19\.2/);
});

test("minimal candidate requires the reviewed exact chart archive", () => {
  const result = runCandidate({
    HELM_EXPT_KPS_MINIMAL_CANDIDATE: "1",
    HELM_EXPT_PROOF_OFFLINE_CANDIDATE: "1",
    HELM_EXPT_PROOF_OUTPUT_ROOT: "data/candidate-test",
    HELM_EXPT_CHART_VERSION: "87.19.2",
    HELM_EXPT_CHART_ARTIFACT_SHA256: "0".repeat(64),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires the reviewed kube-prometheus-stack 87\.19\.2 archive SHA256/);
});

test("minimal candidate accepts both gates, an isolated root, and 87.19.2", () => {
  const result = runCandidate({
    HELM_EXPT_KPS_MINIMAL_CANDIDATE: "1",
    HELM_EXPT_PROOF_OFFLINE_CANDIDATE: "1",
    HELM_EXPT_PROOF_OUTPUT_ROOT: "data/candidate-test",
    HELM_EXPT_CHART_VERSION: "87.19.2",
    HELM_EXPT_CHART_ARTIFACT_SHA256: archiveSHA256,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--generate-proof/);
});

test("retained minimal platform proof passes chart assertions and exact source binding", () => {
  const result = spawnSync(process.execPath, [script, "--verify-proof"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    env: {
      ...process.env,
      HELM_EXPT_KPS_MINIMAL_CANDIDATE: "1",
      HELM_EXPT_PROOF_OFFLINE_CANDIDATE: "1",
      HELM_EXPT_PROOF_OUTPUT_ROOT: "runs/prometheus-operator-minimal-candidate",
      HELM_EXPT_CHART_VERSION: "87.19.2",
      HELM_EXPT_CHART_ARTIFACT_URL: "https://github.com/prometheus-community/helm-charts/releases/download/kube-prometheus-stack-87.19.2/kube-prometheus-stack-87.19.2.tgz",
      HELM_EXPT_CHART_ARTIFACT_SHA256: archiveSHA256,
    },
  });
  assert.equal(result.status, 0, result.stderr);
});
