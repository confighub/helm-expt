// The compare control on a chart page. It computes a diff when the reader asks
// for one, in the reader's browser, and stores nothing.
//
// The inputs are two retained object files from this repository. Each file is
// checked against the SHA-256 its Catalog listing records before it is used.
// The comparison is the vendored core of `cub config diff` in config-diff.js.
import { diffConfigFiles, sha256Of } from "./config-diff.js";

const section = document.querySelector("[data-chart-compare]");
if (section) {
  start(section).catch((error) => {
    const result = section.querySelector("[data-compare-result]");
    if (result) show(result, [note(`The compare control could not start: ${error.message} The commands below give the same diff.`, "chart-compare-error")]);
  });
}

function element(tag, text = "", className = "") {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function note(text, className = "") {
  return element("p", text, className);
}

function show(container, nodes) {
  container.replaceChildren(...nodes);
  container.hidden = false;
}

async function start(section) {
  const form = section.querySelector("form[data-compare-control]");
  const result = section.querySelector("[data-compare-result]");
  const response = await fetch(section.dataset.chartJson);
  if (!response.ok) throw new Error(`the chart file answered HTTP ${response.status}.`);
  const chart = await response.json();
  const root = section.dataset.repositoryRoot;
  const selects = {
    from: { version: form.elements["from-version"], base: form.elements["from-base"] },
    to: { version: form.elements["to-version"], base: form.elements["to-base"] },
  };
  const versionOf = (name) => chart.versions.find((version) => version.version === name);
  const sideOf = (side) => {
    const version = versionOf(selects[side].version.value);
    const base = version?.bases.find((candidate) => candidate.base === selects[side].base.value);
    return version && base ? { version: version.version, ...base } : null;
  };
  const fillBases = (side, wanted) => {
    const version = versionOf(selects[side].version.value);
    const bases = (version?.bases ?? []).filter((base) => base.objects);
    selects[side].base.replaceChildren(...bases.map((base) => {
      const option = element("option", base.base === version.defaultBase ? `${base.base} (default)` : base.base);
      option.value = base.base;
      return option;
    }));
    const keep = bases.find((base) => base.base === wanted) ?? bases.find((base) => base.base === version?.defaultBase) ?? bases[0];
    if (keep) selects[side].base.value = keep.base;
  };
  const choose = (side, value) => {
    const [version, base] = String(value ?? "").split("/");
    if (!versionOf(version)) return false;
    selects[side].version.value = version;
    fillBases(side, base);
    return selects[side].base.value === base;
  };
  const writeCommands = () => {
    const from = sideOf("from");
    const to = sideOf("to");
    const code = section.querySelector("[data-compare-command] code");
    if (from && to && code) code.replaceChildren(...commandNodes(from, to));
  };
  for (const side of ["from", "to"]) {
    selects[side].version.addEventListener("change", () => { fillBases(side, selects[side].base.value); writeCommands(); });
    selects[side].base.addEventListener("change", writeCommands);
  }

  let run = 0;
  const compare = async () => {
    const from = sideOf("from");
    const to = sideOf("to");
    if (!from || !to) return;
    const mine = ++run;
    show(result, [note("Fetching the two retained files and checking their digests.")]);
    try {
      const [before, after] = await Promise.all([load(root, from), load(root, to)]);
      const diff = await diffConfigFiles(before.bytes, after.bytes);
      if (mine === run) show(result, resultNodes(chart, { from, to, before, after, diff }));
    } catch (error) {
      if (mine === run) show(result, [note(`${error.message} The diff is not shown. The commands below fetch the same files.`, "chart-compare-error")]);
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const next = new URLSearchParams(window.location.search);
    next.set("from", `${selects.from.version.value}/${selects.from.base.value}`);
    next.set("to", `${selects.to.version.value}/${selects.to.base.value}`);
    history.replaceState(null, "", `?${next}#${section.querySelector("h2").id}`);
    compare();
  });
  // A stored summary line links its own pair, so one press computes it here.
  for (const link of section.querySelectorAll("a[data-compare-from]")) {
    link.addEventListener("click", (event) => {
      if (!choose("from", link.dataset.compareFrom) || !choose("to", link.dataset.compareTo)) return;
      event.preventDefault();
      writeCommands();
      history.replaceState(null, "", link.getAttribute("href"));
      form.scrollIntoView({ block: "start" });
      compare();
    });
  }

  fillBases("from", selects.from.base.value);
  fillBases("to", selects.to.base.value);
  form.hidden = false;
  // An address that names a pair is a request for that diff.
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") && params.get("to") && choose("from", params.get("from")) && choose("to", params.get("to"))) {
    writeCommands();
    await compare();
  }
  section.dataset.compareReady = "true";
}

// Fetches one retained file from this site's own origin and checks its bytes.
async function load(root, side) {
  const address = new URL(root + side.objects.path, window.location.href);
  const response = await fetch(address);
  if (!response.ok) throw new Error(`The retained file for ${side.version}, base ${side.base}, answered HTTP ${response.status}.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const sha256 = await sha256Of(bytes);
  if (side.objects.sha256 && sha256 !== side.objects.sha256) {
    throw new Error(`The retained file for ${side.version}, base ${side.base}, has SHA-256 ${sha256}, and its listing records ${side.objects.sha256}.`);
  }
  return { bytes, sha256, verified: Boolean(side.objects.sha256) };
}

function inputLine(label, side, file, count) {
  const line = element("p", "", "chart-compare-input");
  line.append(element("strong", `${label}. `));
  const checked = file.verified
    ? `The file's SHA-256 matches the digest its listing records, ${file.sha256}.`
    : `Its listing records the object-set digest ${side.objects.objectSetDigest} and no file digest. The file bytes were fetched from the repository at main, and their SHA-256 is ${file.sha256}.`;
  line.append(`${side.version}, base ${side.base}, ${count} objects. ${checked}`);
  return line;
}

const objectName = (object) => `${object.apiVersion} ${object.kind} ${object.namespace ?? "(namespace unspecified)"}/${object.name}`;

function valueNode(value) {
  const text = JSON.stringify(value);
  if (text.length <= 160) return element("code", text);
  const details = element("details", "", "chart-compare-value");
  details.append(element("summary", `a value of ${text.length} characters`));
  details.append(element("pre", JSON.stringify(value, null, 2)));
  return details;
}

function fieldNode(field) {
  const item = element("li");
  item.append(element("code", field.path || "(whole object)"), ` ${field.operation} `);
  if (field.operation === "add") item.append(valueNode(field.after));
  else if (field.operation === "remove") item.append(valueNode(field.before));
  else item.append(valueNode(field.before), " to ", valueNode(field.after));
  return item;
}

function resultNodes(chart, { from, to, before, after, diff }) {
  const summary = diff.summary;
  const nodes = [
    inputLine("Before", from, before, diff.before.objectCount),
    inputLine("After", to, after, diff.after.objectCount),
  ];
  const headline = element("p", "", "chart-compare-summary");
  headline.dataset.compareSummary = `${summary.added} added, ${summary.removed} removed, ${summary.changed} changed, ${summary.unchanged} unchanged`;
  headline.append(element("strong", `${summary.added} added, ${summary.removed} removed, ${summary.changed} changed, ${summary.unchanged} unchanged.`));
  headline.append(diff.equal ? " The two files hold the same objects." : " Each changed object is listed below with its changed fields.");
  nodes.push(headline);
  for (const change of diff.changes) {
    const details = element("details", "", "chart-compare-change");
    details.open = diff.changes.length <= 3;
    const count = change.fields.length;
    details.append(element("summary", `${change.change} ${objectName(change.object)}, ${count} ${count === 1 ? "field" : "fields"}`));
    const list = element("ul");
    list.append(...change.fields.map(fieldNode));
    details.append(list);
    nodes.push(details);
  }
  nodes.push(note(`${diff.comparison} This comparison did not check ${diff.notChecked.join(", ")}.`, "chart-compare-limits"));
  nodes.push(note(`Computed in this browser by the cub config diff core from ${chart.compare.core.repository} at commit ${chart.compare.core.commit.slice(0, 7)}. Nothing was stored.`, "chart-compare-limits"));
  return nodes;
}

// The same lines the page was generated with, for the chosen pair.
function commandNodes(from, to) {
  const file = (side) => `${side.listing.id}.yaml`;
  const rows = [
    { comment: "fetch the first retained file", cmd: `curl -fsSL -o ${file(from)} ${from.objects.url}` },
    { comment: "fetch the second retained file", cmd: `curl -fsSL -o ${file(to)} ${to.objects.url}` },
  ];
  if (from.objects.sha256 && to.objects.sha256) {
    rows.push({
      comment: "check the bytes against the two listings",
      cmd: `shasum -a 256 ${file(from)} ${file(to)}`,
      out: [from, to].map((side) => `${side.objects.sha256.replace(/^sha256:/, "")}  ${file(side)}`),
    });
  }
  rows.push({ comment: "count what changes", cmd: `cub config diff ${file(from)} ${file(to)} --summary` });
  rows.push({ comment: "list every changed field", cmd: `cub config diff ${file(from)} ${file(to)}` });
  const nodes = [];
  rows.forEach((row, index) => {
    if (index > 0) nodes.push("\n\n");
    nodes.push(element("span", `# ${row.comment}`, "term-comment"), "\n");
    nodes.push(element("span", "$", "term-prompt"), ` ${row.cmd}`);
    for (const out of row.out ?? []) nodes.push(`\n${out}`);
  });
  return nodes;
}
