// A live example is a place in ConfigHub where a reader can open a Catalog
// chart that someone uploaded. The maintainer approves each one, and it goes
// in data/catalog-live-examples/examples.yaml. A chart page shows a live
// example only when that file names one for the chart.
//
// An example is not evidence about a Catalog entry. It changes no listing
// state, so each entry must say in plain words what was done and what was not.

export const LIVE_EXAMPLES_PATH = "data/catalog-live-examples/examples.yaml";
export const LIVE_EXAMPLE_ANCHOR = "live-example";

const ENTRY_KEYS = ["chart", "organization", "holds", "observedOn", "done", "notDone", "addresses", "howTo", "commands"];
const ADDRESS_KEYS = ["label", "url"];
const SENTENCE_WORD_CAP = 32;

const text = (value) => (typeof value === "string" ? value.trim() : "");
const words = (value) => value.match(/[A-Za-z0-9][A-Za-z0-9'/:+._-]*/g)?.length ?? 0;
const sentences = (value) => value.split(/(?<=[.!?])\s+/).filter(Boolean);

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Returns the examples and every reason the file may not be used. A page is
// generated only when the list of problems is empty.
export function validateLiveExamples(document, { knownCharts }) {
  const problems = [];
  const examples = [];
  if (document?.kind !== "CatalogLiveExamples") problems.push("the file must have kind CatalogLiveExamples");
  const entries = document?.spec?.examples;
  if (!Array.isArray(entries)) return { examples, problems: [...problems, "spec.examples must be a list, and an empty list is valid"] };
  const seen = new Set();
  entries.forEach((entry, index) => {
    const name = `example ${index + 1}${text(entry?.chart) ? ` (${text(entry.chart)})` : ""}`;
    const problem = (message) => problems.push(`${name}: ${message}`);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return problem("must be a mapping");
    for (const key of Object.keys(entry)) if (!ENTRY_KEYS.includes(key)) problem(`has an unknown field ${key}`);
    const chart = text(entry.chart);
    if (!chart) problem("names no chart");
    else if (!knownCharts.has(chart)) problem("names a chart the Catalog does not hold as a Helm chart");
    else if (seen.has(chart)) problem("is a second example for one chart, and a chart page shows one");
    seen.add(chart);
    if (!isDate(text(String(entry.observedOn ?? "")))) problem("needs observedOn, the date it was observed, as YYYY-MM-DD");
    for (const [field, meaning] of [
      ["organization", "the organization, described in words, and who can open it"],
      ["holds", "what the example holds"],
      ["done", "a plain statement of what was done"],
      ["notDone", "a plain statement of what was not done"],
      ["howTo", ""],
    ]) {
      const value = text(entry[field]);
      // howTo is the one optional statement.
      if (!value && field === "howTo" && entry.howTo === undefined) continue;
      if (!value) { problem(`needs ${field}, ${meaning}`); continue; }
      if (/—/.test(value)) problem(`${field} uses an em dash`);
      if (!/[.!?]$/.test(value)) problem(`${field} must be one or more whole sentences`);
      for (const sentence of sentences(value)) {
        if (words(sentence) > SENTENCE_WORD_CAP) problem(`${field} has a sentence of ${words(sentence)} words, above ${SENTENCE_WORD_CAP}`);
      }
    }
    const addresses = Array.isArray(entry.addresses) ? entry.addresses : [];
    if (addresses.length === 0) problem("needs at least one address");
    addresses.forEach((address, position) => {
      const at = `address ${position + 1}`;
      if (!address || typeof address !== "object") return problem(`${at} must be a mapping with a label and a url`);
      for (const key of Object.keys(address)) if (!ADDRESS_KEYS.includes(key)) problem(`${at} has an unknown field ${key}`);
      if (!text(address.label)) problem(`${at} needs a label that says what the reader opens`);
      let url = null;
      try { url = new URL(text(address.url)); } catch { /* reported below */ }
      if (!url || url.protocol !== "https:") problem(`${at} needs an https url`);
    });
    const commands = entry.commands ?? [];
    if (!Array.isArray(commands) || commands.some((command) => !text(command))) problem("commands must be a list of command lines");
    examples.push({
      chart,
      organization: text(entry.organization),
      holds: text(entry.holds),
      observedOn: text(String(entry.observedOn ?? "")),
      done: text(entry.done),
      notDone: text(entry.notDone),
      addresses: addresses.map((address) => ({ label: text(address?.label), url: text(address?.url) })),
      howTo: text(entry.howTo),
      commands: Array.isArray(commands) ? commands.map(text) : [],
    });
  });
  return { examples, problems };
}

// The section a chart page shows for its example. With no example there is no
// section at all, so a page never shows an empty slot.
export function liveExampleSectionHtml(example, { escapeHtml, commandBlock }) {
  if (!example) return "";
  const addresses = example.addresses
    .map((address) => `<li><a href="${escapeHtml(address.url)}" rel="noopener">${escapeHtml(address.label)}</a></li>`)
    .join("\n        ");
  const commands = example.commands.length
    ? `<p>These commands made it. They need a ConfigHub account, and they write to the organization you are signed in to.</p>
      ${commandBlock(example.commands.map((cmd) => ({ cmd })))}`
    : "";
  return `<section aria-labelledby="${LIVE_EXAMPLE_ANCHOR}" class="chart-live-example" data-live-example="${escapeHtml(example.chart)}" data-observed-on="${escapeHtml(example.observedOn)}">
      <h2 id="${LIVE_EXAMPLE_ANCHOR}">Open a live example in ConfigHub</h2>
      <p>${escapeHtml(example.organization)} It was observed on ${escapeHtml(example.observedOn)}.</p>
      <p>${escapeHtml(example.holds)}</p>
      <p><span data-live-example-done>${escapeHtml(example.done)}</span> <span data-live-example-not-done>${escapeHtml(example.notDone)}</span></p>
      <ul>
        ${addresses}
      </ul>
      ${example.howTo ? `<p>${escapeHtml(example.howTo)}</p>` : ""}
      ${commands}
    </section>`;
}
