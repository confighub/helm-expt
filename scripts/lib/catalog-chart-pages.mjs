// The parts of a chart page that are plain data work: the page's address, the
// order of versions, and the one stored summary line for a pair of versions.
// The site generator lays the page out, and the tests run these directly.

// A chart page sits beside the version pages, at site/charts/<slug>.html. A
// version page is the chart slug, a hyphen and the version, so the two cannot
// be equal for one chart. The generator also refuses to write a chart page
// whose name equals a version page of another chart.
export function chartPageSlug(chart) {
  return String(chart)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseVersion(version) {
  const match = /^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(version));
  if (!match) return null;
  return {
    numbers: match[1].split(".").map(Number),
    pre: match[2] ? match[2].split(".") : [],
  };
}

// Orders versions as versions, oldest first. 1.9.0 sorts before 1.20.0, and a
// pre-release sorts before its release. A string that is no version sorts by
// its text, after every version, so the order is still total.
export function compareChartVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) {
    if (a) return -1;
    if (b) return 1;
    return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
  }
  for (let index = 0; index < Math.max(a.numbers.length, b.numbers.length); index += 1) {
    const difference = (a.numbers[index] ?? 0) - (b.numbers[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  if (a.pre.length === 0 && b.pre.length === 0) return 0;
  if (a.pre.length === 0) return 1;
  if (b.pre.length === 0) return -1;
  for (let index = 0; index < Math.max(a.pre.length, b.pre.length); index += 1) {
    const x = a.pre[index];
    const y = b.pre[index];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xNumber = /^\d+$/.test(x);
    const yNumber = /^\d+$/.test(y);
    if (xNumber && yNumber && Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1;
    if (xNumber !== yNumber) return xNumber ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export function newestFirst(versions) {
  return [...versions].sort((left, right) => compareChartVersions(right, left));
}

const isAre = (count) => (count === 1 ? "is" : "are");

// One sentence for one pair, from the summary counts of a diff. The counts are
// objects: changed and unchanged objects exist on both sides, a removed one
// only before, and an added one only after.
export function chartDiffSummaryLine({ from, to, summary }) {
  const before = summary.changed + summary.unchanged + summary.removed;
  const where = from.base === to.base
    ? `From ${from.version} to ${to.version} on the ${from.base} base`
    : `From ${from.version} on the ${from.base} base to ${to.version} on the ${to.base} base`;
  if (summary.added === 0 && summary.removed === 0 && summary.changed === 0) {
    return `${where}, all ${before} objects are the same.`;
  }
  const parts = [summary.changed === 0
    ? `none of the ${before} objects changes`
    : `${summary.changed} of ${before} objects ${summary.changed === 1 ? "changes" : "change"}`];
  if (summary.added > 0) parts.push(`${summary.added} ${isAre(summary.added)} added`);
  if (summary.removed > 0) parts.push(`${summary.removed} ${isAre(summary.removed)} removed`);
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return `${where}, ${joined}.`;
}

// The commands that produce the same diff as the page's compare control, for
// one pair. Each side carries the id of its listing, the address of its
// retained file and, where the listing records one, the file's SHA-256.
export function chartCompareCommands(from, to) {
  const file = (side) => `${side.id}.yaml`;
  const digests = [from, to].filter((side) => side.sha256);
  return [
    { comment: "fetch the first retained file", cmd: `curl -fsSL -o ${file(from)} ${from.url}` },
    { comment: "fetch the second retained file", cmd: `curl -fsSL -o ${file(to)} ${to.url}` },
    ...(digests.length === 2 ? [{
      comment: "check the bytes against the two listings",
      cmd: `shasum -a 256 ${file(from)} ${file(to)}`,
      out: [from, to].map((side) => `${side.sha256.replace(/^sha256:/, "")}  ${file(side)}`),
    }] : []),
    { comment: "count what changes", cmd: `cub config diff ${file(from)} ${file(to)} --summary` },
    { comment: "list every changed field", cmd: `cub config diff ${file(from)} ${file(to)}` },
  ];
}
