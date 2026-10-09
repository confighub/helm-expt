// Exact-artifact package proofs for the charts the retained AICR EKS training
// entries pin (scripts/lib/aicr-nested-charts-coverage.mjs).
//
// This is the same declaration as scripts/nvidia-gpu-stack-proof.mjs, run with
// another candidate table: scripts/lib/aicr-nested-chart-candidates.mjs. The
// orchestrator, scripts/nvidia-gpu-stack-coverage.mjs --set aicr-nested-charts,
// supplies and independently verifies the exact artifact URL and SHA-256.

process.env.HELM_EXPT_PROOF_CANDIDATE_SET = "aicr-nested-charts";
await import("./nvidia-gpu-stack-proof.mjs");
