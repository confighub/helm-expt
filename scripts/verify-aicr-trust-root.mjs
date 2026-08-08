#!/usr/bin/env node

// Keep the committed sigstore trust root a reviewed decision.
//
// The signature lane verifies AICR's release signature offline against a trust
// root committed in this repository. That is what makes the check reproducible
// years from now and what removes the last network dependency. It also makes
// the trust root the one input that ages, because sigstore publishes updates to
// it and our copy is a snapshot of one moment.
//
// The refresh trigger is drift, not expiry. Every active entry in the committed
// root carries a start date and no end date; only two historical entries have
// ended, and both ended years ago. So there is no date to count down to, and a
// lane that pretended otherwise would be inventing a deadline.
//
// What this does instead: --run fetches sigstore's published trust root, compares
// it with ours, and writes a review receipt either way. --verify is offline and
// refuses when the committed trust root has changed without a review recording
// that change. Swapping trust material is exactly the change that should never
// happen quietly.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, sha256, toYaml, write } from "./lib/proof-common.mjs";

const PUBLISHED_URL = "https://raw.githubusercontent.com/sigstore/root-signing/main/targets/trusted_root.json";
const trustRootPath = join(repoRoot, "examples", "aicr", "upstream-signatures", "trusted_root.json");
const receiptPath = join(repoRoot, "runs", "aicr-trust-root-review", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "aicr-trust-root-review", "summary.md");

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/verify-aicr-trust-root.mjs --run
  node scripts/verify-aicr-trust-root.mjs --generate
  node scripts/verify-aicr-trust-root.mjs --verify`);
  process.exit(2);
}

if (mode === "--run") {
  const review = await review_();
  write(receiptPath, toYaml(review.receipt));
  write(summaryPath, renderSummary(review.report));
  console.log(
    review.report.matchesPublished
      ? `reviewed ${review.report.observedAt}: the committed trust root is byte-identical to sigstore's published one`
      : `reviewed ${review.report.observedAt}: the committed trust root DIFFERS from sigstore's published one, which is now recorded`,
  );
} else if (mode === "--generate") {
  write(summaryPath, renderSummary(analyse(readReceipt())));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else {
  const report = analyse(readReceipt());
  // The gate. Trust material that changed since its review is trust material
  // nobody looked at.
  check(
    report.committedSha256 === report.reviewedSha256,
    `${relativeRepo(trustRootPath)} has changed since it was last reviewed; run npm run aicr-trust-root:run to review the new trust material and record it`,
  );
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-trust-root:generate`);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(report),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-trust-root:generate`,
  );
  console.log(
    `verified the committed sigstore trust root against its review of ${report.observedAt.slice(0, 10)}: ${report.active.length} active entries, ${report.retired.length} retired`,
  );
}

// Active and retired are read from the trust root itself. An entry with an end
// date in the past is kept so old signatures still verify, and saying which is
// which is more useful than a count of keys.
function describeTrustRoot(text) {
  const root = JSON.parse(text);
  const rows = [];
  const collect = (list, kind) => {
    for (const entry of list ?? []) {
      const validFor = entry.validFor ?? entry.publicKey?.validFor ?? {};
      rows.push({
        kind,
        subject: entry.subject?.commonName ?? entry.baseUrl ?? entry.url ?? entry.publicKey?.keyDetails ?? "unnamed",
        start: validFor.start ?? "",
        end: validFor.end ?? "",
      });
    }
  };
  collect(root.certificateAuthorities, "certificate authority");
  collect(root.tlogs, "transparency log");
  collect(root.ctlogs, "certificate transparency log");
  collect(root.timestampAuthorities, "timestamp authority");
  check(rows.length > 0, "the committed trust root describes no trust material");
  return {
    mediaType: root.mediaType ?? "",
    active: rows.filter((row) => !row.end),
    retired: rows.filter((row) => row.end),
  };
}

async function review_() {
  const committed = readFileSync(trustRootPath);
  const response = await fetch(PUBLISHED_URL, { headers: { "user-agent": "helm-expt-aicr-trust-root-review" } });
  check(response.ok, `the published trust root request failed with ${response.status}`);
  const publishedText = await response.text();
  const publishedSha = sha256(Buffer.from(publishedText));
  const committedSha = sha256(committed);
  const observedAt = new Date().toISOString();
  const described = describeTrustRoot(committed.toString("utf8"));

  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "TrustRootReviewReceipt",
    metadata: { name: "aicr-trust-root-review" },
    spec: {
      claim:
        "The sigstore trust root this repository commits for offline AICR signature verification was compared against the trust root sigstore publishes, and the result was recorded whether or not they agreed.",
      observedAt,
      committed: { path: relativeRepo(trustRootPath), sha256: committedSha },
      published: { url: PUBLISHED_URL, sha256: publishedSha },
      matchesPublished: committedSha === publishedSha,
      cadence: {
        trigger: "drift",
        rule:
          "Review when a retained AICR version changes, when the signature lane changes, and otherwise whenever this lane is run. There is no expiry to count down to: every active entry in the trust root carries a start date and no end date.",
        refreshIsDeliberate:
          "Replacing the committed trust root is a reviewable change on its own, never a side effect of another one. The verify lane refuses a trust root that moved without a review recording it.",
      },
      material: described,
      boundary: {
        configPlaneOnly: true,
        note: "The review reads two JSON documents and compares them. Nothing is downloaded for execution, no signature is made, and no cluster or organization takes part.",
      },
    },
    status: { result: committedSha === publishedSha ? "matches-published" : "differs-from-published" },
  };
  return { receipt, report: analyse(receipt) };
}

function readReceipt() {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run npm run aicr-trust-root:run`);
  const receipt = readYaml(receiptPath);
  check(receipt.kind === "TrustRootReviewReceipt", `${relativeRepo(receiptPath)}: expected kind TrustRootReviewReceipt`);
  return receipt;
}

function analyse(receipt) {
  const spec = receipt.spec ?? {};
  check(spec.observedAt, `${relativeRepo(receiptPath)} records no review time`);
  const committed = readFileSync(trustRootPath);
  const described = describeTrustRoot(committed.toString("utf8"));
  return {
    observedAt: spec.observedAt,
    reviewedSha256: spec.committed?.sha256 ?? "",
    committedSha256: sha256(committed),
    publishedSha256: spec.published?.sha256 ?? "",
    publishedUrl: spec.published?.url ?? PUBLISHED_URL,
    matchesPublished: Boolean(spec.matchesPublished),
    cadence: spec.cadence ?? {},
    ...described,
  };
}

function renderSummary(report) {
  const row = (entry) =>
    `| ${entry.kind} | ${entry.subject} | ${entry.start.slice(0, 10)} | ${entry.end ? entry.end.slice(0, 10) : "no end date"} |`;
  const activeRows = report.active.map(row).join("\n");
  const retiredRows = report.retired.map(row).join("\n");
  const verdict = report.matchesPublished
    ? `At that review the committed copy was **byte-identical** to the published one, so nothing about it is a local variant.`
    : `At that review the committed copy **differed** from the published one, and the receipt records both digests so the difference can be examined rather than assumed.`;

  return `# The trust root the signature lane depends on

**UNOFFICIAL/EXPERIMENTAL.** Reviewed by \`npm run aicr-trust-root:run\`, which
is the only step that reaches the network, and checked offline by
\`npm run aicr-trust-root:verify\`. The review is recorded at
\`runs/aicr-trust-root-review/receipt.yaml\`.

[The signature lane](../../docs/reference/aicr-signature-verification.md)
verifies AICR's release signature with the network disabled, against a sigstore
trust root committed in this repository. That is what makes the check
reproducible years from now. It also makes the trust root the one input that
ages, because sigstore publishes updates and our copy is a snapshot.

## The cadence, and why it is drift rather than expiry

${report.cadence.rule}

${report.cadence.refreshIsDeliberate}

## What the committed trust root contains

Last reviewed **${report.observedAt.slice(0, 10)}**, against ${report.publishedUrl}.
${verdict}

| Kind | Subject | Valid from | Valid until |
| --- | --- | --- | --- |
${activeRows}

## What it keeps for old signatures

These entries ended, and they are retained so signatures made while they were
valid still verify. A trust root that dropped them would quietly break the
verification of anything older.

| Kind | Subject | Valid from | Valid until |
| --- | --- | --- | --- |
${retiredRows}

## The gate

\`npm run aicr-trust-root:verify\` refuses when the committed trust root has
changed since the review that recorded it. Swapping trust material is exactly
the change that should never happen quietly, and the lane makes it a reviewable
step rather than a diff someone might scroll past.

It does not check the trust root against the network. That would put a network
dependency back into the ordinary verify chain, which is the thing the
committed copy exists to remove.

Everything in the verify path runs offline against committed bytes. No cluster,
no organization, and no GPU workload takes part.
`;
}
