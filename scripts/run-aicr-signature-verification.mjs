#!/usr/bin/env node

// Verify the upstream AICR release signature, and record what that proves.
//
// From v0.15.0 onward every AICR release ships a signed recipe catalog. The
// signature is a sigstore bundle carrying SLSA provenance, and verifying it is
// the rung the catalog cannot climb with digests alone: a digest says the
// bytes did not change, a signature says who produced them.
//
// The toolchain decision this lane implements is recorded in
// docs/reference/aicr-signature-verification.md. In short, cosign 2.6.1 runs
// in a container, the sigstore trust root is committed next to the bundle so
// verification needs no network, and `--use-signed-timestamps` supplies the
// trusted time that the release's Rekor v2 era log entry does not carry.
//
// --run performs the live verification and writes the receipt. --verify
// re-checks the committed receipt against the committed bundle offline and
// without cosign, so the ordinary verify chain stays toolchain-free.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const signatureRoot = join(repoRoot, "examples", "aicr", "upstream-signatures");
const trustedRootPath = join(signatureRoot, "trusted_root.json");
const upstreamVersion = "v0.18.0";
const bundlePath = join(signatureRoot, upstreamVersion, "recipe-catalog.sigstore.json");
const receiptPath = join(repoRoot, "runs", "aicr-signature-verification", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "aicr-signature-verification", "summary.md");
const cosignImage = "gcr.io/projectsigstore/cosign:v2.6.1";
const expectedIdentity =
  "https://github.com/NVIDIA/aicr/.github/workflows/on-tag.yaml@refs/tags/v0.18.0";
const expectedIssuer = "https://token.actions.githubusercontent.com";

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-aicr-signature-verification.mjs --run
  node scripts/run-aicr-signature-verification.mjs --generate
  node scripts/run-aicr-signature-verification.mjs --verify
  node scripts/run-aicr-signature-verification.mjs --self-test`);
  process.exit(2);
}

if (mode === "--run") {
  run();
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, readCommittedSignature());
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live verification`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-signature:generate`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, readCommittedSignature());
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-signature:generate`,
  );
  console.log("verified the AICR upstream signature receipt");
} else {
  selfTest();
  console.log("verified the AICR signature checks against fake surfaces");
}

// readCommittedSignature reads everything the receipt must agree with, using
// no verification tooling: the bundle's own bytes, its signer identity, its
// SLSA subject, and the trust root pinned beside it.
function readCommittedSignature(rootOverride) {
  const root = rootOverride ?? signatureRoot;
  const bundleFile = rootOverride
    ? join(root, "recipe-catalog.sigstore.json")
    : bundlePath;
  const trustedFile = join(root, "trusted_root.json");
  check(existsSync(bundleFile), `${relativeRepo(bundleFile)} is missing`);
  check(existsSync(trustedFile), `${relativeRepo(trustedFile)} is missing`);
  const bundleText = readFileSync(bundleFile, "utf8");
  const bundle = JSON.parse(bundleText);
  const material = bundle.verificationMaterial ?? {};
  const envelope = bundle.dsseEnvelope ?? {};
  check(envelope.payload, "the committed bundle carries no DSSE payload");
  const statement = JSON.parse(Buffer.from(envelope.payload, "base64").toString("utf8"));
  const subjects = (statement.subject ?? []).map((row) => ({
    name: row.name,
    sha256: row.digest?.sha256 ?? "",
  }));
  check(subjects.length > 0, "the committed bundle attests to no subject");
  const certificate = material.certificate?.rawBytes ?? "";
  check(certificate, "the committed bundle carries no signer certificate");
  const identity = readCertificateIdentity(certificate);
  const tlogEntries = material.tlogEntries ?? [];
  const timestamps = material.timestampVerificationData?.rfc3161Timestamps ?? [];
  return {
    bundleSha256: sha256(bundleText),
    trustedRootSha256: sha256(readFileSync(trustedFile, "utf8")),
    mediaType: bundle.mediaType ?? "",
    payloadType: envelope.payloadType ?? "",
    statementType: statement._type ?? "",
    predicateType: statement.predicateType ?? "",
    subjects,
    identity,
    tlogEntryKind: tlogEntries[0]?.kindVersion?.kind ?? "",
    tlogEntryVersion: tlogEntries[0]?.kindVersion?.version ?? "",
    tlogHasIntegratedTime: Boolean(tlogEntries[0]?.integratedTime),
    signedTimestampCount: timestamps.length,
  };
}

// readCertificateIdentity extracts the signer identity and OIDC issuer from
// the Fulcio certificate. openssl is used only as a decoder here; it performs
// no verification, so this stays a pure read of committed bytes.
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
  const san = text.match(/URI:(\S+)/)?.[1] ?? "";
  const issuer = text.match(/(https:\/\/token\.actions\.githubusercontent\.com)/)?.[1] ?? "";
  return { subjectAlternativeName: san, oidcIssuer: issuer };
}

function run() {
  check(
    process.env.HELM_EXPT_ALLOW_CONTAINER_TOOLS === "1",
    "set HELM_EXPT_ALLOW_CONTAINER_TOOLS=1 to confirm this containerized cosign run",
  );
  check(tryCommand("docker", ["version"]).ok, "docker is required to run the pinned cosign image");

  const committed = readCommittedSignature();
  check(
    committed.identity.subjectAlternativeName === expectedIdentity
      && committed.identity.oidcIssuer === expectedIssuer,
    "the committed bundle's signer identity is not the expected AICR release workflow",
  );

  const observedAt = new Date().toISOString();
  const cosignArgs = (extra = []) => [
    "run",
    "--rm",
    "--network",
    "none",
    "-v",
    `${signatureRoot}:/w`,
    "-w",
    "/w",
    cosignImage,
    "verify-blob-attestation",
    "--bundle",
    `${upstreamVersion}/recipe-catalog.sigstore.json`,
    "--new-bundle-format",
    "--trusted-root",
    "trusted_root.json",
    "--certificate-oidc-issuer",
    expectedIssuer,
    "--use-signed-timestamps",
    "--check-claims=false",
    ...extra,
  ];

  const verified = tryCommand("docker", cosignArgs(["--certificate-identity", expectedIdentity]));
  check(
    verified.ok && /verified ok/i.test(verified.out),
    `offline verification failed: ${verified.out.trim().slice(0, 400)}`,
  );

  // A verification lane that cannot fail proves nothing, so the run also
  // shows the same command refusing a signer identity that is not upstream.
  const wrongIdentity = "https://github.com/not-nvidia/not-aicr/.github/workflows/x.yaml@refs/tags/v1";
  const refused = tryCommand("docker", cosignArgs(["--certificate-identity", wrongIdentity]));
  check(
    !refused.ok && /no matching certificateidentity/i.test(refused.out),
    "the verification lane accepted a wrong signer identity",
  );

  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "AicrUpstreamSignatureReceipt",
    metadata: { name: `aicr-${upstreamVersion.replaceAll(".", "-")}-recipe-catalog-signature` },
    spec: {
      observedAt,
      upstream: {
        project: "NVIDIA AICR",
        version: upstreamVersion,
        asset: "recipe-catalog.sigstore.json",
        committedBundle: relativeRepo(bundlePath),
        bundleSha256: committed.bundleSha256,
      },
      toolchain: {
        verifier: cosignImage,
        execution: "container with the network disabled",
        trustedRoot: relativeRepo(trustedRootPath),
        trustedRootSha256: committed.trustedRootSha256,
        flags: ["--new-bundle-format", "--trusted-root", "--use-signed-timestamps", "--check-claims=false"],
        decisionRecord: "docs/reference/aicr-signature-verification.md",
      },
      signature: {
        mediaType: committed.mediaType,
        payloadType: committed.payloadType,
        statementType: committed.statementType,
        predicateType: committed.predicateType,
        subjects: committed.subjects,
        signerIdentity: committed.identity.subjectAlternativeName,
        oidcIssuer: committed.identity.oidcIssuer,
        transparencyLogEntry: {
          kind: committed.tlogEntryKind,
          version: committed.tlogEntryVersion,
          carriesIntegratedTime: committed.tlogHasIntegratedTime,
        },
        signedTimestampCount: committed.signedTimestampCount,
      },
      result: {
        offlineVerification: "pass",
        networkDisabled: true,
        wrongIdentityRefused: true,
      },
      limits: [
        "This receipt verifies the signature over the release's recipe-catalog attestation. It does not verify the recipe catalog artifact itself, because the catalog is not a release asset and no copy is retained here; the attestation's subject digest is recorded so a future retained copy can be bound to it.",
        "Claim checking is disabled for the same reason, so this receipt proves who signed the statement and that the statement is intact, not that a local artifact matches it.",
        "The trust root is pinned as committed bytes. Refreshing it is a deliberate change, and it is the one input that ages.",
        "This receipt concerns the upstream v0.18.0 release. The catalog still retains v0.14.0, which shipped no signature at all.",
      ],
    },
    status: {
      result: "pass",
      offlineVerification: "pass",
      negativeControl: "pass",
      claim:
        "The signature over NVIDIA AICR v0.18.0's recipe-catalog attestation verifies offline against a pinned sigstore trust root, with the signer identified as the tagged release workflow in NVIDIA/aicr through GitHub Actions OIDC, and the same command refuses a different signer identity.",
    },
  };

  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(readYaml(receiptPath), committed);
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function verifyReceipt(receipt, committed) {
  check(receipt.kind === "AicrUpstreamSignatureReceipt", "AICR signature receipt kind changed");
  check(receipt.status?.result === "pass", "AICR signature verification is not pass");
  check(
    receipt.status?.offlineVerification === "pass" && receipt.status?.negativeControl === "pass",
    "AICR signature receipt lanes did not both pass",
  );
  check(
    receipt.spec?.upstream?.bundleSha256 === committed.bundleSha256,
    "the committed signature bundle changed since the receipt was written",
  );
  check(
    receipt.spec?.toolchain?.trustedRootSha256 === committed.trustedRootSha256,
    "the committed trust root changed since the receipt was written",
  );
  check(
    receipt.spec?.signature?.signerIdentity === committed.identity.subjectAlternativeName
      && receipt.spec?.signature?.oidcIssuer === committed.identity.oidcIssuer,
    "the receipt's signer identity differs from the committed bundle",
  );
  check(
    receipt.spec?.signature?.signerIdentity === expectedIdentity,
    "the receipt no longer records the expected AICR release workflow as the signer",
  );
  check(
    JSON.stringify(receipt.spec?.signature?.subjects) === JSON.stringify(committed.subjects),
    "the receipt's attested subjects differ from the committed bundle",
  );
  check(
    receipt.spec?.signature?.predicateType === committed.predicateType
      && String(committed.predicateType).includes("slsa.dev/provenance"),
    "the receipt no longer records a SLSA provenance predicate",
  );
  check(
    receipt.spec?.result?.offlineVerification === "pass"
      && receipt.spec?.result?.networkDisabled === true
      && receipt.spec?.result?.wrongIdentityRefused === true,
    "the receipt does not record an offline verification with a working negative control",
  );
  check(
    String(receipt.spec?.toolchain?.verifier ?? "").includes("cosign:v"),
    "the receipt does not pin an exact cosign version",
  );
  check(
    receipt.spec?.limits?.some((limit) => limit.includes("does not verify the recipe catalog artifact")),
    "the receipt must state that the attested artifact itself is not checked here",
  );
  check(
    !Number.isNaN(Date.parse(receipt.spec?.observedAt ?? "")),
    "the AICR signature receipt records no valid timestamp",
  );
}

function renderSummary(receipt) {
  const signature = receipt.spec.signature;
  const toolchain = receipt.spec.toolchain;
  return `# AICR upstream signature verification

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed
receipt. Re-run the verification with \`npm run aicr-signature:run\`; check the
committed result without cosign or a network with
\`npm run aicr-signature:verify\`.

NVIDIA AICR ${receipt.spec.upstream.version} ships a signed recipe catalog, and
that signature verifies here with the network disabled. The signer is the
tagged release workflow in NVIDIA/aicr
(\`${signature.signerIdentity}\`), identified through GitHub Actions OIDC at
\`${signature.oidcIssuer}\`. The signed statement is an in-toto statement
carrying a \`${signature.predicateType}\` predicate over
${signature.subjects.length} subject
(${signature.subjects.map((row) => `\`${row.name}\``).join(", ")}).

The verification runs ${toolchain.verifier} inside a container with no
network, against the sigstore trust root committed beside the bundle. The
release's transparency-log entry is
\`${signature.transparencyLogEntry.kind}\` version
\`${signature.transparencyLogEntry.version}\` and carries no integrated time,
so trusted time comes from the ${signature.signedTimestampCount} RFC 3161
signed timestamp in the bundle. The same command was then run against a
different signer identity and refused it, so the lane can fail.

## Limits

${receipt.spec.limits.map((limit) => `- ${limit}`).join("\n")}
`;
}

// The self-test drives the receipt checks from a fake signature directory, so
// it exercises the refusals without cosign, a network, or the real bundle.
function selfTest() {
  const committed = readCommittedSignature();
  {
    const receipt = () => JSON.parse(JSON.stringify({
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrUpstreamSignatureReceipt",
      metadata: { name: "fixture" },
      spec: {
        observedAt: "1970-01-01T00:00:00.000Z",
        upstream: { version: upstreamVersion, bundleSha256: committed.bundleSha256 },
        toolchain: {
          verifier: cosignImage,
          trustedRootSha256: committed.trustedRootSha256,
        },
        signature: {
          predicateType: committed.predicateType,
          subjects: committed.subjects,
          signerIdentity: committed.identity.subjectAlternativeName,
          oidcIssuer: committed.identity.oidcIssuer,
          transparencyLogEntry: {
            kind: committed.tlogEntryKind,
            version: committed.tlogEntryVersion,
            carriesIntegratedTime: committed.tlogHasIntegratedTime,
          },
          signedTimestampCount: committed.signedTimestampCount,
        },
        result: { offlineVerification: "pass", networkDisabled: true, wrongIdentityRefused: true },
        limits: ["This receipt does not verify the recipe catalog artifact itself."],
      },
      status: { result: "pass", offlineVerification: "pass", negativeControl: "pass" },
    }));

    verifyReceipt(receipt(), committed);

    const refusals = [
      [(r) => (r.spec.upstream.bundleSha256 = "0".repeat(64)), /signature bundle changed/],
      [(r) => (r.spec.toolchain.trustedRootSha256 = "0".repeat(64)), /trust root changed/],
      [(r) => (r.spec.signature.signerIdentity = "https://github.com/other/repo/.github/workflows/x.yaml@refs/tags/v1"), /signer identity differs/],
      [(r) => (r.spec.signature.subjects = []), /attested subjects differ/],
      [(r) => (r.spec.signature.predicateType = "https://example.invalid/predicate"), /SLSA provenance predicate/],
      [(r) => (r.spec.result.networkDisabled = false), /offline verification with a working negative control/],
      [(r) => (r.spec.result.wrongIdentityRefused = false), /offline verification with a working negative control/],
      [(r) => (r.spec.toolchain.verifier = "cosign"), /pin an exact cosign version/],
      [(r) => (r.spec.limits = []), /attested artifact itself is not checked/],
    ];
    for (const [mutate, pattern] of refusals) {
      const mutated = receipt();
      mutate(mutated);
      check(fails(() => verifyReceipt(mutated, committed), pattern), `self-test accepted a receipt violating ${pattern}`);
    }
  }
}

// tryCommand keeps stdout and stderr together, because cosign reports its
// verdict on stderr and the receipt records that verdict.
function tryCommand(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
    ...options,
  });
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { ok: result.status === 0, out: out || String(result.error ?? "") };
}

function fails(action, pattern) {
  try {
    action();
  } catch (error) {
    return pattern.test(String(error?.message ?? error));
  }
  return false;
}
