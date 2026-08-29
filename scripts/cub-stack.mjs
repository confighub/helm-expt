#!/usr/bin/env node
// cub stack — a working prototype of the `cub <noun>` idea.
//
// A stack is a certified composition of components, installed by name. This
// prototype resolves a named stack from the catalog, CERTIFIES the composition (the
// step that earns its keep — resource conflicts, CRD-before-CR ordering across
// components, admission webhook certificates, namespace prerequisites), and renders
// it in `sandbox` mode for free, with no infrastructure. It reuses the committed
// renders and the same parse the certified-bundle work uses, so the certify step is
// grounded in real objects, not a mock.
//
// Verbs:
//   node scripts/cub-stack.mjs list
//   node scripts/cub-stack.mjs certify <name>    # the gate only; exits non-zero on a conflict
//   node scripts/cub-stack.mjs sandbox <name>    # certify, then render the bundle for free

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { parseDocs, readYaml, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const STACKS_DIR = join(repoRoot, "examples", "cub-stack", "stacks");
const args = process.argv.slice(2);
const verb = args[0];
const name = args[1];
const RUN = args.includes("--run");

// The cub binary. install --run drives these live; everything else is offline.
const CUB = process.env.CUB ?? join(homedir(), ".confighub", "bin", "cub");
function cub(cubArgs) {
  return execFileSync(CUB, cubArgs, { encoding: "utf8", maxBuffer: 200 * 1024 * 1024 });
}
function shellQuote(a) {
  return /[^A-Za-z0-9_./=:-]/.test(a) ? `'${a.replace(/'/g, "'\\''")}'` : a;
}

const PASS = "PASS";
const WARN = "WARN";
const FAIL = "FAIL";

function identity(doc) {
  return [
    doc.apiVersion ?? "",
    doc.kind ?? "",
    doc.metadata?.namespace ?? "",
    doc.metadata?.name ?? "",
  ].join("|");
}

function loadStack(stackName) {
  const path = join(STACKS_DIR, `${stackName}.yaml`);
  if (!existsSync(path)) {
    console.error(`no such stack "${stackName}". Try: cub stack list`);
    process.exit(2);
  }
  const stack = readYaml(path);
  const components = (stack.spec?.components ?? []).map((comp) => {
    const renderPath = join(repoRoot, comp.render);
    if (!existsSync(renderPath)) {
      console.error(`component "${comp.name}" render is missing: ${comp.render}`);
      process.exit(2);
    }
    const objects = parseDocs(readFileSync(renderPath, "utf8")).filter(
      (d) => d && d.kind && d.metadata?.name,
    );
    return { name: comp.name, render: comp.render, objects };
  });
  return {
    name: stack.metadata?.name ?? stackName,
    description: stack.spec?.description ?? "",
    components,
  };
}

// The certify step. Composes the components' objects and reports what a delivery
// would have to get right: no two components claim the same object, every custom
// resource's CRD is present and delivered first, admission webhooks have a
// certificate path, and the namespaces used exist. A conflict is the hard failure;
// the rest are warnings.
function certify(stack) {
  const findings = [];
  let hardFailures = 0;

  // 1. Resource conflicts: one identity claimed by two components.
  const owners = new Map();
  let objectCount = 0;
  for (const comp of stack.components) {
    for (const obj of comp.objects) {
      objectCount += 1;
      const id = identity(obj);
      if (!owners.has(id)) owners.set(id, []);
      owners.get(id).push(comp.name);
    }
  }
  const collisions = [...owners.entries()].filter(([, comps]) => comps.length > 1);
  if (collisions.length === 0) {
    findings.push([PASS, `no resource conflicts across components (${objectCount} objects, 0 collisions)`]);
  } else {
    hardFailures += collisions.length;
    findings.push([FAIL, `${collisions.length} resource conflict(s) — the same object is claimed by more than one component:`]);
    for (const [id, comps] of collisions.slice(0, 4)) {
      findings.push(["    ", `${id}  <=  ${comps.join(" + ")}`]);
    }
    if (collisions.length > 4) findings.push(["    ", `...and ${collisions.length - 4} more`]);
  }

  // 2. CRD-before-CR across components.
  const crdGroups = new Map(); // group -> component that ships the CRD
  let crdCount = 0;
  for (const comp of stack.components) {
    for (const obj of comp.objects) {
      if (obj.kind === "CustomResourceDefinition" && obj.spec?.group) {
        crdGroups.set(obj.spec.group, comp.name);
        crdCount += 1;
      }
    }
  }
  const order = new Map(stack.components.map((comp, i) => [comp.name, i]));
  let crCount = 0;
  let crOrderingProblems = 0;
  for (const comp of stack.components) {
    for (const obj of comp.objects) {
      const group = String(obj.apiVersion ?? "").split("/")[0];
      if (obj.kind !== "CustomResourceDefinition" && crdGroups.has(group)) {
        crCount += 1;
        const crdComp = crdGroups.get(group);
        if (order.get(crdComp) > order.get(comp.name)) crOrderingProblems += 1;
      }
    }
  }
  if (crdCount === 0) {
    findings.push([PASS, "no CRDs in this stack, so no CRD-before-CR ordering to enforce"]);
  } else if (crOrderingProblems === 0) {
    findings.push([PASS, `CRD ordering: ${crdCount} CRDs are delivered before the ${crCount} custom resources that need them`]);
  } else {
    hardFailures += crOrderingProblems;
    findings.push([FAIL, `${crOrderingProblems} custom resource(s) are ordered before the component that ships their CRD`]);
  }

  // 3. Admission webhooks that need a caBundle, and whether cert-manager can fill it.
  let emptyWebhooks = 0;
  for (const comp of stack.components) {
    for (const obj of comp.objects) {
      if (String(obj.kind).endsWith("WebhookConfiguration")) {
        if ((obj.webhooks ?? []).some((w) => !w.clientConfig?.caBundle)) emptyWebhooks += 1;
      }
    }
  }
  const hasCertManager =
    crdGroups.has("cert-manager.io") ||
    stack.components.some((comp) => /cert-manager/.test(comp.name));
  if (emptyWebhooks === 0) {
    findings.push([PASS, "no admission webhooks need a certificate"]);
  } else {
    const note = hasCertManager
      ? "cert-manager is in the stack and can issue it"
      : "no cert-manager in the stack; the reconciler must supply the certificate";
    findings.push([WARN, `${emptyWebhooks} admission webhook(s) need a caBundle — ${note}`]);
  }

  // 4. Namespaces created vs used.
  const created = new Set();
  const used = new Set();
  for (const comp of stack.components) {
    for (const obj of comp.objects) {
      if (obj.kind === "Namespace") created.add(obj.metadata.name);
      if (obj.metadata?.namespace) used.add(obj.metadata.namespace);
    }
  }
  const prereqs = [...used].filter((ns) => !created.has(ns)).sort();
  findings.push([
    PASS,
    `namespaces: ${created.size} created, ${prereqs.length} must already exist${prereqs.length ? ` (${prereqs.join(", ")})` : ""}`,
  ]);

  return { certified: hardFailures === 0, findings, objectCount, crdCount, crCount };
}

function printHeader(stack) {
  const parts = stack.components.map((comp) => comp.name).join(", ");
  console.log(`\nStack: ${stack.name}  —  ${stack.description}`);
  console.log(`Resolving ${stack.components.length} components from the catalog: ${parts}\n`);
}

function printCertify(result) {
  console.log("Certify");
  for (const [mark, text] of result.findings) {
    console.log(mark === "    " ? `      ${text}` : `  [${mark}] ${text}`);
  }
  console.log(`  => ${result.certified ? "CERTIFIED" : "REJECTED"}\n`);
}

// install: certify, then create a governed base variant holding the composition, a
// dev deployment variant cloned from it, and a review gate on the dev release. This
// is the same review-gated promotion path proven live separately. --run executes it;
// without --run it prints the plan and changes nothing.
function install(stack, { run }) {
  const result = certify(stack);
  printHeader(stack);
  printCertify(result);
  if (!result.certified) {
    console.log("Install refused: the composition is not certified. Fix the conflict first.\n");
    process.exit(1);
  }

  const base = `${stack.name}-base`;
  const dev = `${stack.name}-dev`;
  const steps = [
    { desc: "create the base variant space", args: ["space", "create", base, "--component", stack.name, "--variant", "base"] },
    ...stack.components.map((comp) => ({
      desc: `seed component ${comp.name}`,
      args: ["unit", "create", "--space", base, comp.name, comp.render, "--change-desc", `Seed ${comp.name} for stack ${stack.name}`],
    })),
    { desc: "clone the dev deployment variant", args: ["variant", "create", "dev", base, "--environment", "Dev"] },
    { desc: "gate the dev release on review", args: ["trigger", "create", "--space", dev, "-o", "json", "require-approval", "Mutation", "Kubernetes/YAML", "vet-approvedby", "1"] },
    { desc: "point the gate at the dev space (variant create copied the base's where-trigger)", args: ["space", "update", "--patch", dev, "--where-trigger", "SpaceID = '<dev-space-id>'", "--refresh-triggers"] },
  ];

  console.log(run ? "Installing (live)\n" : "Install plan (dry run, no changes)\n");
  console.log("  Governed structure:");
  console.log(`    ${base}  — base variant holding the certified composition (${stack.components.length} units)`);
  console.log(`    ${dev}  — dev deployment variant, its release gated on review\n`);
  console.log("  Steps:");
  for (const s of steps) console.log(`    cub ${s.args.map(shellQuote).join(" ")}`);
  console.log("");

  if (!run) {
    console.log(`  Dry run. Add --run to install, then \`cub unit approve\` releases the gated dev variant.\n`);
    return;
  }

  let devId = null;
  for (const s of steps) {
    const resolved = s.args.map((a) => (a === "SpaceID = '<dev-space-id>'" ? `SpaceID = '${devId}'` : a));
    process.stdout.write(`  ${s.desc}... `);
    const out = cub(resolved);
    if (s.args[0] === "variant" && s.args[1] === "create") {
      const m = out.match(/ID: ([0-9a-f-]{36})/);
      devId = m ? m[1] : null;
    }
    console.log("ok");
  }

  const firstUnit = stack.components[0].name;
  const gates = JSON.parse(cub(["unit", "get", firstUnit, "--space", dev, "-o", "jq=.Unit.ApplyGates"]) || "null");
  const gated = gates && Object.keys(gates).length > 0;
  console.log(`\n  Installed. ${base} + ${dev}.`);
  console.log(`  Review gate on ${dev}/${firstUnit}: ${gated ? "ACTIVE, release blocked until approved" : "not active"}`);
  console.log(`  The review: cub unit approve ${firstUnit} --space ${dev}`);
  console.log(`  Tear down:  cub space delete --recursive-force ${dev} ; cub space delete --recursive-force ${base}\n`);
}

if (verb === "list") {
  const files = readdirSync(STACKS_DIR).filter((f) => f.endsWith(".yaml"));
  console.log(`\nAvailable stacks (${relativeRepo(STACKS_DIR)})\n`);
  for (const f of files.sort()) {
    const s = readYaml(join(STACKS_DIR, f));
    console.log(`  ${s.metadata?.name ?? f}  —  ${s.spec?.description ?? ""}`);
    console.log(`      ${(s.spec?.components ?? []).map((cp) => cp.name).join(", ")}`);
  }
  console.log(`\ncub stack sandbox <name>   # certify and render, free\n`);
} else if (verb === "certify" || verb === "sandbox") {
  if (!name) {
    console.error(`usage: cub stack ${verb} <name>`);
    process.exit(2);
  }
  const stack = loadStack(name);
  printHeader(stack);
  const result = certify(stack);
  printCertify(result);

  if (verb === "sandbox") {
    if (result.certified) {
      console.log("Sandbox render  (free, no infrastructure)");
      console.log(`  ${result.objectCount} objects total`);
      for (const comp of stack.components) {
        console.log(`      ${comp.name}: ${comp.objects.length}`);
      }
      console.log(
        `\n  Ready. \`cub stack install ${stack.name}\` would deliver this bundle through ConfigHub and your own Argo CD or Flux.\n`,
      );
    } else {
      console.log("Not rendered: fix the conflict above before this stack can be certified.\n");
    }
  }
  process.exit(result.certified ? 0 : 1);
} else if (verb === "install") {
  if (!name) {
    console.error("usage: cub stack install <name> [--run]");
    process.exit(2);
  }
  install(loadStack(name), { run: RUN });
} else {
  console.log(`cub stack — prototype

Usage:
  node scripts/cub-stack.mjs list
  node scripts/cub-stack.mjs certify <name>
  node scripts/cub-stack.mjs sandbox <name>
  node scripts/cub-stack.mjs install <name> [--run]`);
  process.exit(verb ? 2 : 0);
}
