#!/usr/bin/env node

// Verify the two signed inputs used to retain AICR v0.19.0.
//
// The release signs both the CLI binary and the recipe catalog. The live run
// verifies those signatures with a pinned Cosign image and a committed trust
// root while the container has no network. Ordinary verification then binds
// the receipt to the committed bundles, source bytes, checksum list, and
// generation receipt without requiring Docker or a downloaded binary.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const version = "v0.19.0";
const versionSlug = "v0-19-0";
const signatureRoot = join(repoRoot, "examples", "aicr", "upstream-signatures");
const versionRoot = join(signatureRoot, version);
const trustedRootPath = join(signatureRoot, "trusted_root.json");
const recipeBundlePath = join(versionRoot, "recipe-catalog.sigstore.json");
const binaryBundlePath = join(versionRoot, "aicr-attestation.sigstore.json");
const checksumListPath = join(versionRoot, "aicr_checksums.txt");
const generationReceiptPath = join(
  repoRoot,
  "examples",
  "aicr",
  "eks-h100-training-kubeflow-v0-19-0",
  "generation-receipt.yaml",
);
const receiptPath = join(repoRoot, "runs", `aicr-provenance-${versionSlug}`, "receipt.yaml");
const summaryPath = join(repoRoot, "data", `aicr-provenance-${versionSlug}`, "summary.md");
const expectedIdentity =
  "https://github.com/NVIDIA/aicr/.github/workflows/on-tag.yaml@refs/tags/v0.19.0";
const expectedIssuer = "https://token.actions.githubusercontent.com";
const cosignImage =
  "gcr.io/projectsigstore/cosign@sha256:d91bc4e7e95e8d2f549c747a72dc174f90579e410a1695f57f686674f84ce849";

const mode = process.argv[2] ?? "--verify";
const binaryPath = flagValue("--binary");
const archivePath = flagValue("--archive");
if (!["--run", "--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-aicr-v019-provenance.mjs --run --binary /path/to/aicr --archive /path/to/archive.tar.gz
  node scripts/run-aicr-v019-provenance.mjs --generate
  node scripts/run-aicr-v019-provenance.mjs --verify`);
  process.exit(2);
}

if (mode === "--run") run();
if (mode === "--generate") generate();
if (mode === "--verify") verify();

function flagValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] ?? "";
}

function readStatement(path) {
  check(existsSync(path), `${relativeRepo(path)} is missing`);
  const text = readFileSync(path, "utf8");
  const bundle = JSON.parse(text);
  const envelope = bundle.dsseEnvelope ?? {};
  check(envelope.payload, `${relativeRepo(path)} carries no DSSE payload`);
  const statement = JSON.parse(Buffer.from(envelope.payload, "base64").toString("utf8"));
  const certificate = bundle.verificationMaterial?.certificate?.rawBytes ?? "";
  check(certificate, `${relativeRepo(path)} carries no certificate`);
  const tlog = bundle.verificationMaterial?.tlogEntries?.[0] ?? {};
  return {
    bundleSha256: sha256(text),
    mediaType: bundle.mediaType ?? "",
    payloadType: envelope.payloadType ?? "",
    statementType: statement._type ?? "",
    predicateType: statement.predicateType ?? "",
    subjects: (statement.subject ?? []).map((row) => ({
      name: row.name,
      sha256: row.digest?.sha256 ?? "",
    })),
    identity: readCertificateIdentity(certificate),
    transparencyLog: {
      kind: tlog.kindVersion?.kind ?? "",
      version: tlog.kindVersion?.version ?? "",
      carriesIntegratedTime: Boolean(tlog.integratedTime),
    },
    signedTimestampCount:
      bundle.verificationMaterial?.timestampVerificationData?.rfc3161Timestamps?.length ?? 0,
  };
}

function readCertificateIdentity(rawBytes) {
  const der = Buffer.from(rawBytes, "base64");
  const pem = [
    "-----BEGIN CERTIFICATE-----",
    ...(der.toString("base64").match(/.{1,64}/g) ?? []),
    "-----END CERTIFICATE-----",
    "",
  ].join("\n");
  const text = execFileSync("openssl", ["x509", "-noout", "-text"], {
    input: pem,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
  return {
    subjectAlternativeName: text.match(/URI:(\S+)/)?.[1] ?? "",
    oidcIssuer: text.match(/(https:\/\/token\.actions\.githubusercontent\.com)/)?.[1] ?? "",
  };
}

function recomputeRecipeSubject() {
  const subjectRoot = join(versionRoot, "attested-subject");
  const expected = readChecksumRows(join(versionRoot, "attested-subject-checksums.txt"));
  const parts = ["registry.yaml", "catalog.yaml"].map((file) => {
    const path = join(subjectRoot, file);
    check(existsSync(path), `${relativeRepo(path)} is missing`);
    const bytes = readFileSync(path);
    check(sha256(bytes) === expected.get(file), `${relativeRepo(path)} differs from its checksum`);
    return { file, bytes };
  });
  const hash = createHash("sha256");
  for (const part of parts) {
    const length = Buffer.alloc(8);
    length.writeBigUInt64BE(BigInt(part.bytes.length));
    hash.update(length);
    hash.update(part.bytes);
  }
  return {
    sha256: hash.digest("hex"),
    parts: parts.map((part) => ({
      file: part.file,
      sha256: sha256(part.bytes),
      bytes: part.bytes.length,
    })),
    algorithm:
      "sha256 over u64be(len(registry.yaml)) || registry.yaml || u64be(len(validators/catalog.yaml)) || validators/catalog.yaml",
  };
}

function readChecksumRows(path) {
  const rows = new Map();
  for (const line of readFileSync(path, "utf8").split("\n").filter(Boolean)) {
    const match = line.match(/^([0-9a-f]{64})\s+(.+)$/);
    check(match, `${relativeRepo(path)}: cannot parse ${line}`);
    rows.set(match[2], match[1]);
  }
  return rows;
}

function staticFacts() {
  const generation = readYaml(generationReceiptPath);
  const recipeSignature = readStatement(recipeBundlePath);
  const binarySignature = readStatement(binaryBundlePath);
  const recipeSubject = recipeSignature.subjects.find((row) => row.name === "recipe-catalog");
  const binarySubject = binarySignature.subjects.find((row) => row.name === "aicr");
  check(recipeSubject, "recipe signature has no recipe-catalog subject");
  check(binarySubject, "binary attestation has no aicr subject");
  const recomputed = recomputeRecipeSubject();
  check(recipeSubject.sha256 === recomputed.sha256, "retained recipe-catalog bytes do not match the signed subject");
  check(
    binarySubject.sha256 === generation.spec?.source?.binary?.sha256,
    "binary attestation differs from the generation receipt",
  );
  for (const signature of [recipeSignature, binarySignature]) {
    check(
      signature.identity.subjectAlternativeName === expectedIdentity,
      `signature identity is ${signature.identity.subjectAlternativeName}, expected ${expectedIdentity}`,
    );
    check(signature.identity.oidcIssuer === expectedIssuer, "signature OIDC issuer is not GitHub Actions");
  }
  const releaseChecksums = readChecksumRows(checksumListPath);
  const archiveName = generation.spec?.source?.releaseAsset?.name ?? "";
  check(
    releaseChecksums.get(archiveName) === generation.spec?.source?.releaseAsset?.sha256,
    "the retained release checksum list differs from the generation receipt",
  );
  return {
    generation,
    recipeSignature,
    binarySignature,
    recipeSubject,
    binarySubject,
    recomputed,
    checksumListSha256: sha256(readFileSync(checksumListPath)),
    archiveName,
    archiveSha256: releaseChecksums.get(archiveName),
  };
}

function run() {
  check(process.env.HELM_EXPT_ALLOW_CONTAINER_TOOLS === "1", "set HELM_EXPT_ALLOW_CONTAINER_TOOLS=1 for the Cosign run");
  check(binaryPath && existsSync(binaryPath), "--binary must name the extracted v0.19.0 aicr binary");
  check(archivePath && existsSync(archivePath), "--archive must name the downloaded v0.19.0 tarball");
  const facts = staticFacts();
  check(sha256(readFileSync(binaryPath)) === facts.binarySubject.sha256, "downloaded binary differs from its signed subject");
  check(sha256(readFileSync(archivePath)) === facts.archiveSha256, "downloaded archive differs from the release checksum list");
  const recipeVerified = cosignRecipe(expectedIdentity);
  check(recipeVerified.ok && /verified ok/i.test(recipeVerified.output), `recipe signature failed: ${recipeVerified.output}`);
  const binaryVerified = cosignBinary(expectedIdentity, binaryPath);
  check(binaryVerified.ok && /verified ok/i.test(binaryVerified.output), `binary attestation failed: ${binaryVerified.output}`);
  const wrongIdentity =
    "https://github.com/not-nvidia/not-aicr/.github/workflows/on-tag.yaml@refs/tags/v0.19.0";
  const refused = cosignBinary(wrongIdentity, binaryPath);
  check(!refused.ok, "binary attestation accepted the wrong signer identity");
  const receipt = buildReceipt(facts, new Date().toISOString());
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(receiptPath)}`);
}

function cosignRecipe(identity) {
  return runDocker([
    "verify-blob-attestation",
    "--bundle", "/sig/v0.19.0/recipe-catalog.sigstore.json",
    "--trusted-root", "/sig/trusted_root.json",
    "--certificate-oidc-issuer", expectedIssuer,
    "--certificate-identity", identity,
    "--type", "https://slsa.dev/provenance/v1",
    "--check-claims=false",
  ]);
}

function cosignBinary(identity, path) {
  return runDocker([
    "verify-blob-attestation",
    "--bundle", "/sig/v0.19.0/aicr-attestation.sigstore.json",
    "--trusted-root", "/sig/trusted_root.json",
    "--certificate-oidc-issuer", expectedIssuer,
    "--certificate-identity", identity,
    "--type", "https://slsa.dev/provenance/v1",
    `/binary/${basename(path)}`,
  ], dirname(path));
}

function runDocker(args, mountedBinaryDir = "") {
  const dockerArgs = [
    "run", "--rm", "--network", "none",
    "-v", `${signatureRoot}:/sig:ro`,
  ];
  if (mountedBinaryDir) dockerArgs.push("-v", `${mountedBinaryDir}:/binary:ro`);
  dockerArgs.push(cosignImage, ...args);
  const result = spawnSync("docker", dockerArgs, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function buildReceipt(facts, observedAt) {
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "AicrUpstreamProvenanceReceipt",
    metadata: { name: "aicr-v0-19-0-provenance" },
    spec: {
      observedAt,
      upstream: {
        project: "NVIDIA AICR",
        version,
        commit: facts.generation.spec.source.commit,
        archive: facts.archiveName,
        archiveSha256: facts.archiveSha256,
        checksumList: relativeRepo(checksumListPath),
        checksumListSha256: facts.checksumListSha256,
      },
      toolchain: {
        verifier: cosignImage,
        execution: "container with network disabled",
        trustedRoot: relativeRepo(trustedRootPath),
        trustedRootSha256: sha256(readFileSync(trustedRootPath)),
      },
      recipeCatalog: {
        bundle: relativeRepo(recipeBundlePath),
        bundleSha256: facts.recipeSignature.bundleSha256,
        attestedSha256: facts.recipeSubject.sha256,
        recomputedSha256: facts.recomputed.sha256,
        retainedParts: facts.recomputed.parts,
        algorithm: facts.recomputed.algorithm,
      },
      binary: {
        bundle: relativeRepo(binaryBundlePath),
        bundleSha256: facts.binarySignature.bundleSha256,
        attestedSha256: facts.binarySubject.sha256,
        downloadedBinarySha256: facts.binarySubject.sha256,
      },
      signature: {
        signerIdentity: expectedIdentity,
        oidcIssuer: expectedIssuer,
        recipeCatalog: {
          mediaType: facts.recipeSignature.mediaType,
          predicateType: facts.recipeSignature.predicateType,
          transparencyLog: facts.recipeSignature.transparencyLog,
          signedTimestampCount: facts.recipeSignature.signedTimestampCount,
        },
        binary: {
          mediaType: facts.binarySignature.mediaType,
          predicateType: facts.binarySignature.predicateType,
          transparencyLog: facts.binarySignature.transparencyLog,
          signedTimestampCount: facts.binarySignature.signedTimestampCount,
        },
      },
      result: {
        recipeCatalogSignature: "pass",
        binaryAttestation: "pass",
        archiveChecksum: "pass",
        networkDisabled: true,
        wrongIdentityRefused: true,
      },
      limits: [
        "The binary attestation covers the exact CLI binary, not the generated recipe or bundle.",
        "The recipe-catalog signature covers the retained component registry and validator catalog, not every overlay in the AICR repository.",
        "The retained output is bound separately by its checksums and digest index.",
        "No cluster, cloud account, GPU, model, or ConfigHub organization was used by this provenance run.",
      ],
    },
    status: {
      result: "pass",
      offlineSignatureVerification: "pass",
      negativeControl: "pass",
    },
  };
}

function generate() {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run --run first`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, staticFacts());
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
}

function verify() {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run --run first`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run --generate`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, staticFacts());
  check(readFileSync(summaryPath, "utf8") === renderSummary(receipt), `${relativeRepo(summaryPath)} is stale`);
  console.log("verified the AICR v0.19.0 recipe-catalog and binary provenance receipt");
}

function verifyReceipt(receipt, facts) {
  check(receipt.status?.result === "pass", "provenance receipt is not pass");
  check(receipt.spec?.upstream?.version === version, "receipt names the wrong AICR version");
  check(receipt.spec?.upstream?.archiveSha256 === facts.archiveSha256, "archive checksum drifted");
  check(receipt.spec?.upstream?.checksumListSha256 === facts.checksumListSha256, "checksum list drifted");
  check(receipt.spec?.recipeCatalog?.bundleSha256 === facts.recipeSignature.bundleSha256, "recipe bundle drifted");
  check(receipt.spec?.recipeCatalog?.attestedSha256 === facts.recipeSubject.sha256, "recipe subject drifted");
  check(receipt.spec?.recipeCatalog?.recomputedSha256 === facts.recomputed.sha256, "recipe digest no longer reproduces");
  check(receipt.spec?.binary?.bundleSha256 === facts.binarySignature.bundleSha256, "binary bundle drifted");
  check(receipt.spec?.binary?.attestedSha256 === facts.binarySubject.sha256, "binary subject drifted");
  check(receipt.spec?.signature?.signerIdentity === expectedIdentity, "receipt signer identity drifted");
  check(receipt.spec?.toolchain?.verifier === cosignImage, "receipt verifier is not the pinned Cosign image");
  check(receipt.spec?.result?.networkDisabled === true, "receipt did not record a network-disabled run");
  check(receipt.spec?.result?.wrongIdentityRefused === true, "receipt has no negative identity control");
}

function renderSummary(receipt) {
  const spec = receipt.spec;
  return `# AICR v0.19.0 source verification

The release archive matched NVIDIA's checksum list. The extracted CLI binary
matched the SHA-256 in its signed SLSA attestation. The recipe-catalog signature
also verified, and the catalog digest was reproduced from the retained registry
and validator catalog.

Both signatures identify the exact NVIDIA release workflow for \`${version}\`:

\`${spec.signature.signerIdentity}\`

Verification used the pinned Cosign image with networking disabled. The same
binary check refused an unrelated signer identity.

This proves the source inputs used by the retained entry. It does not prove that
the generated platform ran on EKS or an H100, and it does not cover every AICR
overlay. The [generation receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/generation-receipt.yaml)
and digest index bind the generated files separately.

Run \`npm run aicr-provenance-v0190:verify\` to check the committed receipt and
retained bytes without Docker or network access.
`;
}
