#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, parseDocs, readYaml, repoRoot, sha256File, toYaml, write } from "./lib/proof-common.mjs";
import { buildTimoniInventory, buildTimoniReceipt } from "./lib/timoni-materialization.mjs";

const mode = process.argv[2] ?? "--verify";
check(["--generate", "--verify"].includes(mode), "use --generate or --verify");
const prefix = "examples/timoni/flux-aio-2-9-4-0";
const path = (name) => join(repoRoot, prefix, name);
const lock = readYaml(path("source-lock.yaml"));
const source = lock.spec.source;
const selection = lock.spec.selection;
const lifecycle = readYaml(path("lifecycle-route-intent.yaml"));
const flattening = readYaml(path("flattening-safety-verdict.yaml"));
const moduleRoot = mkdtempSync(join(tmpdir(), "helm-expt-flux-source-"));

try {
  // Bind both retained layers to the same immutable manifest used by the build.
  const manifestPath = join(repoRoot, source.retainedManifest);
  check(`sha256:${sha256File(manifestPath)}` === source.manifestDigest, "Flux retained manifest does not match the source digest");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  check(manifest.schemaVersion === 2, "Flux source requires an OCI v2 manifest");
  for (const [role, field, digestField] of [["module/vendor", "retainedVendor", "vendorLayerDigest"], ["module", "retainedModule", "moduleLayerDigest"]]) {
    const layers = manifest.layers.filter((layer) => layer.annotations?.["sh.timoni.content.type"] === role);
    check(layers.length === 1, `Flux source manifest must contain one ${role} layer`);
    const layer = layers[0];
    const archive = join(repoRoot, source[field]);
    check(layer.digest === source[digestField] && `sha256:${sha256File(archive)}` === layer.digest, `Flux ${role} layer digest mismatch`);
    check(readFileSync(archive).length === layer.size, `Flux ${role} layer size mismatch`);
    // Reject links, special files and paths escaping the temporary directory.
    execFileSync("python3", ["-c", `
import pathlib, sys, tarfile
root = pathlib.Path(sys.argv[2]).resolve()
with tarfile.open(sys.argv[1], "r:gz") as archive:
    for member in archive.getmembers():
        target = (root / member.name).resolve()
        if target != root and root not in target.parents:
            raise ValueError("archive path escapes module directory")
        if not member.isfile() and not member.isdir():
            raise ValueError("module archive contains a link or special file")
    archive.extractall(root)
`, archive, moduleRoot]);
  }
  for (const [retainedField, digestField, modulePath] of [["workflow", "workflowSha256", "timoni.cue"], ["moduleConfig", "moduleConfigSha256", "templates/config.cue"]]) {
    const retained = join(repoRoot, source[retainedField]);
    check(sha256File(retained) === source[digestField], `Flux ${retainedField} differs from source lock`);
    check(sha256File(retained) === sha256File(join(moduleRoot, modulePath)), `Flux ${retainedField} differs from the immutable module layer`);
  }
  const valuesPath = join(repoRoot, selection.values);
  const selectedValuesSHA256 = sha256File(valuesPath);
  if (mode === "--generate") {
    const timoni = process.env.TIMONI_BIN ?? "timoni";
    const version = execFileSync(timoni, ["version"], { encoding: "utf8" });
    check(version.match(/^client:\s*(\S+)/m)?.[1] === String(lock.spec.processor.version), "Timoni client version differs from the recorded processor");
    const schema = execFileSync(timoni, ["mod", "show", "config", moduleRoot], { encoding: "utf8" });
    const objects = execFileSync(timoni, ["-n", selection.namespace, "build", selection.instance, source.module, "-v", source.version, "-d", source.manifestDigest, "-f", valuesPath, ...(selection.maskSecrets ? ["--mask-secrets"] : [])], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    write(path("config-schema.cue"), schema.endsWith("\n") ? schema : `${schema}\n`);
    write(path("rendered/release-objects.yaml"), objects.endsWith("\n") ? objects : `${objects}\n`);
  }
  const objectsText = readFileSync(path("rendered/release-objects.yaml"), "utf8");
  const objects = parseDocs(objectsText);
  const inventory = buildTimoniInventory(objects, objectsText, `${prefix}/source-lock.yaml`);
  const receipt = buildTimoniReceipt({ lock, lifecycleRecord: lifecycle, flatteningRecord: flattening, inventoryRecord: inventory, schemaText: readFileSync(path("config-schema.cue"), "utf8"), schemaPath: `${prefix}/config-schema.cue`, objects, observations: [
    `The selected build renders ${inventory.kindCounts.CustomResourceDefinition ?? 0} CustomResourceDefinitions, ${inventory.kindCounts.Secret ?? 0} Secrets and ${inventory.kindCounts.PersistentVolumeClaim ?? 0} PersistentVolumeClaims.`,
    "The retained module workflow declares an all-object apply set; the recorded CRD establishment and readiness routes are proposed destination requirements, not executed source steps.",
  ] });
  receipt.spec.selectedValuesSHA256 = selectedValuesSHA256;
  const outputs = [["rendered/object-inventory.json", `${JSON.stringify(inventory, null, 2)}\n`], ["generation-receipt.yaml", `${toYaml(receipt)}\n`]];
  for (const [name, contents] of outputs) {
    if (mode === "--generate") write(path(name), contents);
    else check(readFileSync(path(name), "utf8") === contents, `Flux ${name} is stale; regenerate the static proof`);
  }
  console.log(`${mode === "--generate" ? "generated" : "verified"} Flux Timoni static proof: ${objects.length} objects, ${inventory.kindCounts.CustomResourceDefinition ?? 0} CRDs; manifest, layers, workflow and selected values bound`);
} finally {
  rmSync(moduleRoot, { recursive: true, force: true });
}
