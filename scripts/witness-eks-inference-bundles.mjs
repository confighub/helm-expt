#!/usr/bin/env node
// Records a witness for every config bundle the eks-inference example
// publishes. These are artifacts this repository did not build: the witness is
// what lets a certified-bundle receipt describe them without pretending to have
// produced them. It records the pulled manifest and layer digests, a SHA-256
// per extracted file, and the producer's declared inputs.
//
// When a checkout of the producer repository is available, the witness also
// records whether every extracted file hashes identically to that repository's
// committed render. That cross-check is the point: it proves the published
// bytes and the reviewed source agree, and it catches the case where the
// producer's repository has moved on since the bundle was published.
//
// Needs the network, so this runs once per publication and its output is
// committed. Nothing in the verify chain re-pulls.
//
// Usage:
//   node scripts/witness-eks-inference-bundles.mjs [--producer-repo <path>] [--only <component>]

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { promisify } from "node:util";

import { listFiles, repoRoot, sha256, sha256File, toYaml, write } from "./lib/proof-common.mjs";

const run = promisify(execFile);
const args = process.argv.slice(2);
const producerRepo = args.includes("--producer-repo")
  ? args[args.indexOf("--producer-repo") + 1]
  : null;
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const REGISTRY = "ghcr.io/confighub/configs/eks-inference";
const PRODUCER = "https://github.com/confighub/eks-inference";
const OBSERVED_AT = "2026-08-07T17:30:00Z";

// The producer's component set, with what each one is made of. render "copy"
// means the files are literal YAML in the producer's tree: nothing templates,
// so nothing is lost at render time.
const COMPONENTS = [
  { name: "platform-profile", render: "copy", plane: "hub" },
  { name: "ack-controllers", render: "ack-charts", plane: "mgmt" },
  { name: "aws-network", render: "copy", plane: "mgmt" },
  { name: "eks-cluster", render: "copy", plane: "mgmt" },
  { name: "karpenter-aws", render: "copy", plane: "mgmt" },
  { name: "karpenter", render: "helm", plane: "workload" },
  { name: "gpu-runtime", render: "helm", plane: "workload" },
  { name: "inference-workloads", render: "copy", plane: "workload" },
];

const OUT_DIR = join(repoRoot, "data", "certified-bundles", "witnesses");

async function producerCommit() {
  if (!producerRepo) return null;
  const { stdout } = await run("git", ["-C", producerRepo, "rev-parse", "HEAD"]);
  return stdout.trim();
}

function hashTree(root) {
  const rows = [];
  for (const path of listFiles(root)) {
    rows.push({ path: relative(root, path), sha256: sha256File(path) });
  }
  return rows.sort((left, right) => (left.path < right.path ? -1 : 1));
}

async function witnessOne(component, commit) {
  const reference = `${REGISTRY}/${component.name}:latest`;
  const work = join(tmpdir(), `eks-inference-witness-${component.name}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  await run("oras", ["pull", reference], { cwd: work, timeout: 180000 });
  const { stdout: manifestText } = await run("oras", ["manifest", "fetch", reference], {
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const manifest = JSON.parse(manifestText);
  const layer = manifest.layers[0];

  const extract = join(work, "extracted");
  mkdirSync(extract, { recursive: true });
  await run("tar", ["-xzf", join(work, `${component.name}.tar.gz`), "-C", extract], {
    timeout: 120000,
  });

  const outDir = join(OUT_DIR, `eks-inference-${component.name}`);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, "files"), { recursive: true });
  const extractedFiles = [];
  for (const path of listFiles(extract).sort()) {
    const rel = relative(extract, path);
    const destination = join(outDir, "files", rel);
    mkdirSync(join(destination, ".."), { recursive: true });
    write(destination, readFileSync(path));
    extractedFiles.push({
      path: `files/${rel}`,
      bundlePath: rel,
      sha256: sha256File(path),
      bytes: statSync(path).size,
    });
  }

  // Does the published bundle still describe the producer's reviewed source?
  let crossCheck;
  if (producerRepo) {
    const committed = join(producerRepo, "configs", component.name);
    if (existsSync(committed)) {
      const published = JSON.stringify(hashTree(extract));
      const source = JSON.stringify(hashTree(committed));
      crossCheck = {
        committedRenderMatches: published === source,
        committedRenderPath: `configs/${component.name} at the producer commit above`,
        note:
          published === source
            ? "Every extracted file hashes identically to the producer repository's committed render, so the published bundle and the reviewed source agree byte for byte."
            : "The published bundle and the producer repository's committed render differ, so the repository has moved since this bundle was published.",
      };
    }
  }

  const witness = {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "OciBundleWitness",
    metadata: { name: `eks-inference-${component.name}` },
    spec: {
      observedAt: OBSERVED_AT,
      pullCommand: `oras pull ${reference}`,
      artifact: {
        reference,
        manifestDigest: `sha256:${sha256(manifestText)}`,
        artifactType: manifest.artifactType,
        createdAnnotation: manifest.annotations?.["org.opencontainers.image.created"],
        layer: {
          mediaType: layer.mediaType,
          digest: layer.digest,
          bytes: layer.size,
          title: layer.annotations?.["org.opencontainers.image.title"],
        },
      },
      extractedFiles,
      producer: {
        repository: PRODUCER,
        ...(commit ? { commit } : {}),
        component: component.name,
        plane: component.plane,
        renderKind: component.render,
      },
      ...(crossCheck ? { crossCheck } : {}),
    },
  };

  write(join(outDir, "witness.yaml"), `${toYaml(witness)}\n`);
  rmSync(work, { recursive: true, force: true });
  return { component: component.name, files: extractedFiles.length, matches: crossCheck?.committedRenderMatches };
}

const commit = await producerCommit();
const wanted = COMPONENTS.filter((component) => (only ? component.name === only : true));
for (const component of wanted) {
  const result = await witnessOne(component, commit);
  console.log(
    `witnessed ${result.component} (${result.files} file(s))${
      result.matches === undefined ? "" : result.matches ? ", matches committed render" : ", DIFFERS from committed render"
    }`,
  );
}
console.log(`wrote ${wanted.length} witness(es) under ${relative(repoRoot, OUT_DIR)}`);
