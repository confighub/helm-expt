#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, sha256File, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const chart = "prometheus-community/kube-prometheus-stack";
const chartSlug = "prometheus-community-kube-prometheus-stack";
const version = "85.3.3";
const variants = ["default", "no-crds"];
const imageReviewPath = join(repoRoot, "data", "attack-plan-workdown", "image-digest-review.csv");
const resolvedImages = new Map();

if (mode === "--generate") {
  for (const variant of variants) {
    const receipt = buildReceipt(variant);
    writeYaml(receiptPath(variant), receipt);
    console.log(`wrote ${relativeRepo(receiptPath(variant))}`);
  }
} else if (mode === "--verify") {
  for (const variant of variants) {
    verifyReceipt(variant);
    console.log(`verified ${relativeRepo(receiptPath(variant))}`);
  }
} else {
  console.log(`Usage:
  node scripts/generate-kps-image-digest-resolution.mjs --generate
  node scripts/generate-kps-image-digest-resolution.mjs --verify`);
}

function buildReceipt(variant) {
  const subject = loadSubjectRows(variant);
  const uniqueImages = [...new Set(subject.rows.map((row) => row.image))].sort();
  const resolvedAt = new Date().toISOString();
  const images = uniqueImages.map((image) => {
    const resolution = resolveImage(image);
    return {
      image,
      digest: resolution.digest,
      digestReference: `${image}@${resolution.digest}`,
      mediaType: resolution.mediaType,
      resolverOutput: {
        name: resolution.name,
      },
      occurrences: subject.rows
        .filter((row) => row.image === image)
        .map((row) => ({ object: row.object, fieldPath: row.field_path })),
    };
  });

  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ImageDigestResolutionReceipt",
    metadata: {
      name: `${chartSlug}-${variant}-image-digest-resolution`,
    },
    spec: {
      chart,
      version,
      variant,
      resolvedAt,
      renderedObjectSet: {
        path: subject.renderedPath,
        sha256: subject.renderedSHA256,
      },
      sourceImageReview: {
        path: relativeRepo(imageReviewPath),
        rows: subject.rows.length,
        uniqueImages: uniqueImages.length,
      },
      resolver: {
        name: "docker-buildx-imagetools",
        commandTemplate: "docker buildx imagetools inspect <image>",
      },
      images,
      productionSupportUse: {
        status: "digest-resolution-recorded",
        claim:
          "The mutable rendered image references for this candidate base were resolved to registry manifest digests at the recorded time.",
        limits:
          "This receipt does not mean the rendered manifests are digest-pinned and does not by itself make the chart production-supported.",
        nextRequired:
          "Choose a digest-pinned base, image override policy, or explicit mutable-image exception before final production OCI support.",
      },
    },
  };
}

function verifyReceipt(variant) {
  const path = receiptPath(variant);
  check(existsSync(path), `${relativeRepo(path)} is missing; run npm run kps:image-digests`);
  const receipt = readYaml(path);
  check(receipt.kind === "ImageDigestResolutionReceipt", `${relativeRepo(path)} must be kind ImageDigestResolutionReceipt`);
  const spec = receipt.spec ?? {};
  check(spec.chart === chart, `${relativeRepo(path)} chart mismatch`);
  check(spec.version === version, `${relativeRepo(path)} version mismatch`);
  check(spec.variant === variant, `${relativeRepo(path)} variant mismatch`);
  check(spec.productionSupportUse?.limits?.includes("does not mean the rendered manifests are digest-pinned"), `${relativeRepo(path)} must state receipt limits`);

  const subject = loadSubjectRows(variant);
  check(spec.renderedObjectSet?.path === subject.renderedPath, `${relativeRepo(path)} rendered path mismatch`);
  check(spec.renderedObjectSet?.sha256 === subject.renderedSHA256, `${relativeRepo(path)} rendered sha mismatch`);
  check(sha256File(join(repoRoot, subject.renderedPath)) === subject.renderedSHA256, `${subject.renderedPath} does not match image review sha`);
  check(spec.sourceImageReview?.rows === subject.rows.length, `${relativeRepo(path)} source row count mismatch`);

  const uniqueImages = [...new Set(subject.rows.map((row) => row.image))].sort();
  const receiptImages = spec.images ?? [];
  check(receiptImages.length === uniqueImages.length, `${relativeRepo(path)} image count mismatch`);
  check(JSON.stringify(receiptImages.map((row) => row.image).sort()) === JSON.stringify(uniqueImages), `${relativeRepo(path)} image set mismatch`);
  for (const image of receiptImages) {
    check(/^sha256:[a-f0-9]{64}$/.test(image.digest ?? ""), `${relativeRepo(path)} invalid digest for ${image.image}`);
    check(image.digestReference === `${image.image}@${image.digest}`, `${relativeRepo(path)} invalid digest reference for ${image.image}`);
    const expectedOccurrences = subject.rows.filter((row) => row.image === image.image).length;
    check((image.occurrences ?? []).length === expectedOccurrences, `${relativeRepo(path)} occurrence count mismatch for ${image.image}`);
  }
}

function loadSubjectRows(variant) {
  const rows = parseCsv(readFileSync(imageReviewPath, "utf8")).filter(
    (row) => row.chart === chart && row.version === version && row.variant === variant,
  );
  check(rows.length > 0, `no image review rows for ${chart}@${version}/${variant}`);
  check(rows.every((row) => row.image_status === "mutable-tag"), "expected only mutable-tag KPS default image rows");
  const renderedPaths = new Set(rows.map((row) => row.rendered_path));
  const renderedSHAs = new Set(rows.map((row) => row.rendered_sha256));
  check(renderedPaths.size === 1, "KPS default image rows should reference one rendered path");
  check(renderedSHAs.size === 1, "KPS default image rows should reference one rendered sha");
  const renderedPath = [...renderedPaths][0];
  const renderedSHA256 = [...renderedSHAs][0];
  check(existsSync(join(repoRoot, renderedPath)), `${renderedPath} is missing`);
  check(sha256File(join(repoRoot, renderedPath)) === renderedSHA256, `${renderedPath} sha does not match image review`);
  return { rows, renderedPath, renderedSHA256 };
}

function resolveImage(image) {
  if (resolvedImages.has(image)) return resolvedImages.get(image);
  const output = execFileSync("docker", ["buildx", "imagetools", "inspect", image], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 20,
  });
  const name = matchLine(output, /^Name:\s+(.+)$/m, `missing Name for ${image}`);
  const mediaType = matchLine(output, /^MediaType:\s+(.+)$/m, `missing MediaType for ${image}`);
  const digest = matchLine(output, /^Digest:\s+(sha256:[a-f0-9]{64})$/m, `missing Digest for ${image}`);
  const resolution = { name, mediaType, digest };
  resolvedImages.set(image, resolution);
  return resolution;
}

function receiptPath(variant) {
  return join(
    repoRoot,
    "data",
    "image-digest-workdown",
    "receipts",
    chartSlug,
    variant,
    "image-digest-resolution.yaml",
  );
}

function matchLine(output, pattern, message) {
  const match = output.match(pattern);
  check(match, message);
  return match[1].trim();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}
