// A new installer package is versioned with a leading v; a package that exists
// keeps the spelling it was made and published under.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readYamlFiles, repoRoot } from "../scripts/lib/proof-common.mjs";
import { installerOciRef, installerOciRefForPackagePath } from "../scripts/lib/installer-oci.mjs";
import {
  INSTALLER_OCI_PACKAGE_INDEX,
  installerPackageVersion,
  installerPackageVersionProblem,
  withLeadingV,
} from "../scripts/lib/installer-package-version.mjs";

// No chart publishes this version, so it stands for a package not made yet.
const unmade = "0.0.0-unmade";

test("an existing package keeps its spelling", () => {
  assert.equal(installerPackageVersion("traefik/traefik", "41.4.0"), "41.4.0");
  assert.match(installerOciRefForPackagePath("packages/traefik/traefik/41.4.0"), /\/traefik-traefik:41\.4\.0$/);
  assert.equal(installerPackageVersion("jetstack/cert-manager", "v1.21.1"), "v1.21.1");
  assert.match(installerOciRef("jetstack/cert-manager", "v1.21.1"), /\/jetstack-cert-manager:v1\.21\.1$/);
});

test("a new package for a chart version without a v gets one", () => {
  assert.equal(installerPackageVersion("traefik/traefik", unmade), `v${unmade}`);
  assert.match(installerOciRef("traefik/traefik", unmade), new RegExp(`/traefik-traefik:v${unmade.replaceAll(".", "\\.")}$`));
  assert.match(installerOciRefForPackagePath(`packages/traefik/traefik/${unmade}`), new RegExp(`:v${unmade.replaceAll(".", "\\.")}$`));
});

test("a new package for a chart version with a v keeps it", () => {
  assert.equal(withLeadingV(`v${unmade}`), `v${unmade}`);
  assert.equal(installerPackageVersion("jetstack/cert-manager", `v${unmade}`), `v${unmade}`);
});

test("regenerating a new package keeps the version it was written with", () => {
  const dir = mkdtempSync(join(tmpdir(), "installer-package-version-"));
  try {
    const packageRoot = join(dir, "packages", "traefik", "traefik", unmade);
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(join(packageRoot, "installer.yaml"), `apiVersion: installer.confighub.com/v1alpha1\nkind: Package\nmetadata:\n  name: traefik-traefik\n  version: v${unmade}\n`);
    assert.equal(installerPackageVersion("traefik/traefik", unmade, { packageRoot }), `v${unmade}`);
    assert.match(installerOciRefForPackagePath(packageRoot), new RegExp(`:v${unmade.replaceAll(".", "\\.")}$`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Every installer.yaml in the repository, read from git so force-added
// candidates under runs/ count too.
function installerVersions() {
  const paths = execFileSync("git", ["ls-files", "-z", "--", "*/installer.yaml"], { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\0")
    .filter((path) => path.endsWith("/installer.yaml") && !path.startsWith("site/"));
  const parsed = readYamlFiles(paths.map((path) => join(repoRoot, path)));
  return paths
    .map((path) => ({ path, installer: parsed.get(join(repoRoot, path)) }))
    .filter(({ installer }) => installer?.apiVersion === "installer.confighub.com/v1alpha1" && installer?.kind === "Package")
    .map(({ path, installer }) => {
      const parts = path.split("/");
      return {
        path,
        chartRef: `${parts.at(-4)}/${parts.at(-3)}`,
        chartVersion: parts.at(-2),
        version: installer.metadata?.version,
      };
    });
}

function versionProblems(entries) {
  return entries
    .map((entry) => installerPackageVersionProblem(entry.version, entry.chartRef, entry.chartVersion))
    .filter(Boolean);
}

test("every package in the repository follows the rule", () => {
  const entries = installerVersions();
  assert.ok(entries.length >= 180, `expected the existing packages, found ${entries.length}`);
  assert.deepEqual(versionProblems(entries), []);
});

test("every published row's tag is its package's version", () => {
  const index = JSON.parse(readFileSync(INSTALLER_OCI_PACKAGE_INDEX, "utf8"));
  const byPath = new Map(installerVersions().map((entry) => [entry.path, entry.version]));
  for (const row of index.packages) {
    const tag = row.installer_oci_ref.slice(row.installer_oci_ref.lastIndexOf(":") + 1);
    assert.equal(tag, byPath.get(row.installer_yaml), row.package_path);
  }
});

test("planted: an existing package renamed with a v, or a new one without it, is rejected", () => {
  const planted = [
    { chartRef: "traefik/traefik", chartVersion: "41.4.0", version: "v41.4.0" },
    { chartRef: "traefik/traefik", chartVersion: unmade, version: unmade },
    { chartRef: "jetstack/cert-manager", chartVersion: `v${unmade}`, version: `vv${unmade}` },
  ];
  const problems = versionProblems(planted);
  assert.equal(problems.length, planted.length);
  assert.match(problems[0], /published as 41\.4\.0; a published package keeps its spelling/);
  assert.match(problems[1], new RegExp(`versioned v${unmade.replaceAll(".", "\\.")}, the chart version with a leading v`));
  assert.equal(versionProblems([...installerVersions(), planted[0]]).length, 1);
});
