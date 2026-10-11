// Where the page for one Catalog entry lives, when the entry has no chart
// version page. The listing generator records the address in the listing, and
// the site generator puts the entry's five steps on the same page, so both
// read this one rule.
//
// An AICR entry sits on the page the entry register gives it, or on the AICR
// index page when the register gives it none. A NIMService variant sits on
// the nimservice page. Any other entry sits on the fallback page named for
// it, or on the nearest README above its retained objects.
import { existsSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { readYaml } from "./proof-common.mjs";

export const NIMSERVICE_ENTRY_NAME = "nimservice";
export const NIMSERVICE_ENTRY_PAGE_FILE = "nimservice.html";
export const AICR_ENTRY_INDEX_DOC = "docs/demo/aicr/index.md";
export const AICR_ENTRY_REGISTER = "examples/aicr/claims/entry-names.yaml";
export const ENTRY_STEPS_FALLBACK_DOCS = new Map([
  // The row for this entry on the Catalog page links this guide.
  ["configuration-oci-nginx-replicas-4", "docs/user/transform-oci-package.md"],
]);

// The site copy of a rendered doc.
export function docSitePath(repoPath) {
  return `d/${repoPath.replace(/\.md$/, ".html")}`;
}

// Whether an address is a chart version page.
export function isChartPageUrl(url) {
  return /\/charts\/[^/]+\.html$/.test(String(url ?? ""));
}

const registers = new Map();
function aicrRegisteredPages(repoRoot) {
  if (!registers.has(repoRoot)) {
    const path = join(repoRoot, AICR_ENTRY_REGISTER);
    const register = existsSync(path) ? readYaml(path) : {};
    registers.set(repoRoot, new Map((register?.spec?.entries ?? []).map((entry) => [String(entry.id), String(entry.page ?? "")])));
  }
  return registers.get(repoRoot);
}

// The page for an entry that has no chart version page. `sitePath` is the
// page under site/. `repoPath` is the doc it is rendered from, and is empty
// for a generated site page. `shared` says the page is not the entry's own.
// The result is null when no rule places the entry.
export function entryPageWithoutChart({ id, format, name, objects }, repoRoot) {
  if (format === "kubernetes-yaml" && name === NIMSERVICE_ENTRY_NAME) {
    return { sitePath: NIMSERVICE_ENTRY_PAGE_FILE, repoPath: "", shared: true };
  }
  const doc = (repoPath, shared) => ({ sitePath: docSitePath(repoPath), repoPath, shared });
  const retained = String(objects ?? "");
  if (format === "aicr") {
    const directory = /^examples\/aicr\/([^/]+)\//.exec(`${retained}/`)?.[1] ?? "";
    const page = aicrRegisteredPages(repoRoot).get(directory) ?? "";
    return page && existsSync(join(repoRoot, page)) ? doc(page, false) : doc(AICR_ENTRY_INDEX_DOC, true);
  }
  const fallback = ENTRY_STEPS_FALLBACK_DOCS.get(id) ?? "";
  if (fallback) return doc(fallback, true);
  const absolute = join(repoRoot, retained);
  let directory = existsSync(absolute) && statSync(absolute).isDirectory() ? retained : posix.dirname(retained);
  while (directory.startsWith("examples/") && directory !== "examples") {
    const candidate = `${directory}/README.md`;
    if (existsSync(join(repoRoot, candidate))) return doc(candidate, false);
    directory = posix.dirname(directory);
  }
  return null;
}
