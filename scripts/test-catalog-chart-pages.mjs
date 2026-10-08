#!/usr/bin/env node
// Self-test for the chart pages: the order of versions, the stored summary
// line, the compare commands, and the rules for a live example. The live
// example rules are tested on a fixture, because the real file may be empty.
import assert from "node:assert/strict";
import { join } from "node:path";

import { readYaml, repoRoot } from "./lib/proof-common.mjs";
import { chartCompareCommands, chartDiffSummaryLine, chartPageSlug, compareChartVersions, newestFirst } from "./lib/catalog-chart-pages.mjs";
import { LIVE_EXAMPLES_PATH, liveExampleSectionHtml, validateLiveExamples } from "./lib/catalog-live-examples.mjs";

// Versions sort as versions, not as strings.
assert.deepEqual(newestFirst(["v25.10.1", "v26.7.1", "v26.3.2", "v26.3.3"]), ["v26.7.1", "v26.3.3", "v26.3.2", "v25.10.1"]);
assert.deepEqual(newestFirst(["1.9.0", "1.20.0", "1.10.0"]), ["1.20.0", "1.10.0", "1.9.0"]);
assert.deepEqual(newestFirst(["9.5.17", "10.1.3", "9.5.15", "10.7.0", "10.2.1"]), ["10.7.0", "10.2.1", "10.1.3", "9.5.17", "9.5.15"]);
assert.deepEqual(newestFirst(["v1.9.0", "v1.26.0", "v1.20.0", "v1.25.0"]), ["v1.26.0", "v1.25.0", "v1.20.0", "v1.9.0"]);
assert.equal(compareChartVersions("1.2.0-rc.1", "1.2.0"), -1, "a pre-release sorts before its release");
assert.equal(compareChartVersions("1.2.0-rc.2", "1.2.0-rc.10"), -1);
assert.equal(compareChartVersions("v2.0.0", "2.0.0"), 0);
assert.equal(compareChartVersions("1.2", "1.2.0"), 0);
assert.equal(compareChartVersions("1.2.0+build.5", "1.2.0"), 0);
assert.equal(compareChartVersions("2.0.0", "main"), -1, "a string that is no version sorts after every version");
// A plain string sort gets the first two cases wrong, which is why this exists.
assert.notDeepEqual(["1.9.0", "1.20.0"].sort().reverse(), ["1.20.0", "1.9.0"]);

assert.equal(chartPageSlug("nvidia/gpu-operator"), "nvidia-gpu-operator");
assert.equal(chartPageSlug("prometheus-community/kube-prometheus-stack"), "prometheus-community-kube-prometheus-stack");

// The stored summary line is one sentence with a verb.
const pair = (fromVersion, toVersion, fromBase = "default", toBase = "default") => ({ from: { version: fromVersion, base: fromBase }, to: { version: toVersion, base: toBase } });
const counts = (added, removed, changed, unchanged) => ({ added, removed, changed, unchanged });
assert.equal(chartDiffSummaryLine({ ...pair("v26.3.2", "v26.3.3"), summary: counts(0, 0, 7, 17) }), "From v26.3.2 to v26.3.3 on the default base, 7 of 24 objects change.");
assert.equal(chartDiffSummaryLine({ ...pair("1.0.0", "1.0.1"), summary: counts(0, 0, 1, 23) }), "From 1.0.0 to 1.0.1 on the default base, 1 of 24 objects changes.");
assert.equal(chartDiffSummaryLine({ ...pair("1.0.0", "2.0.0"), summary: counts(2, 1, 9, 4) }), "From 1.0.0 to 2.0.0 on the default base, 9 of 14 objects change, 2 are added and 1 is removed.");
assert.equal(chartDiffSummaryLine({ ...pair("1.0.0", "2.0.0"), summary: counts(1, 0, 0, 5) }), "From 1.0.0 to 2.0.0 on the default base, none of the 5 objects changes and 1 is added.");
assert.equal(chartDiffSummaryLine({ ...pair("1.0.0", "1.0.1"), summary: counts(0, 0, 0, 5) }), "From 1.0.0 to 1.0.1 on the default base, all 5 objects are the same.");
assert.equal(chartDiffSummaryLine({ ...pair("1.0.0", "2.0.0", "default", "standalone"), summary: counts(0, 0, 3, 2) }), "From 1.0.0 on the default base to 2.0.0 on the standalone base, 3 of 5 objects change.");

// The compare commands fetch both files, check both digests, and run the diff.
const side = (id, digit) => ({ id, url: `https://example.com/${id}.yaml`, sha256: `sha256:${digit.repeat(64)}` });
const commands = chartCompareCommands(side("a-1-default", "a"), side("a-2-default", "b"));
assert.deepEqual(commands.map((row) => row.cmd), [
  "curl -fsSL -o a-1-default.yaml https://example.com/a-1-default.yaml",
  "curl -fsSL -o a-2-default.yaml https://example.com/a-2-default.yaml",
  "shasum -a 256 a-1-default.yaml a-2-default.yaml",
  "cub config diff a-1-default.yaml a-2-default.yaml --summary",
  "cub config diff a-1-default.yaml a-2-default.yaml",
]);
assert.deepEqual(commands[2].out, [`${"a".repeat(64)}  a-1-default.yaml`, `${"b".repeat(64)}  a-2-default.yaml`]);
// A side whose listing records no file digest gets no digest check.
assert.equal(chartCompareCommands({ ...side("a", "a"), sha256: "" }, side("b", "b")).some((row) => row.cmd.startsWith("shasum")), false);

// The real file passes its own rules, whatever it holds.
const knownCharts = new Set(["example/fixture-chart", "example/other-chart"]);
const real = readYaml(join(repoRoot, LIVE_EXAMPLES_PATH));
assert.equal(real.kind, "CatalogLiveExamples");
assert.ok(Array.isArray(real.spec.examples), `${LIVE_EXAMPLES_PATH}: spec.examples must be a list`);
// Its charts are checked against the Catalog by the site generator. Here every
// other rule is applied to the entries the file really holds.
const realResult = validateLiveExamples(real, { knownCharts: new Set(real.spec.examples.map((entry) => entry.chart)) });
assert.deepEqual(realResult.problems, [], `${LIVE_EXAMPLES_PATH} breaks its own rules`);
for (const example of realResult.examples) {
  assert.ok(example.observedOn && example.done && example.notDone && example.addresses.length > 0, `${example.chart}: a live example needs a date, both statements and an address`);
}

// The fixture is valid, and each tampered copy is refused for its own reason.
const fixture = () => readYaml(join(repoRoot, "tests/fixtures/catalog-live-examples/valid.yaml"));
const valid = validateLiveExamples(fixture(), { knownCharts });
assert.deepEqual(valid.problems, []);
assert.equal(valid.examples.length, 1);
const tampered = [
  ["no date", (entry) => { delete entry.observedOn; }, /observedOn/],
  ["a date that is no date", (entry) => { entry.observedOn = "2026-13-40"; }, /observedOn/],
  ["no statement of what was done", (entry) => { delete entry.done; }, /needs done/],
  ["no statement of what was not done", (entry) => { entry.notDone = "  "; }, /needs notDone/],
  ["no address", (entry) => { entry.addresses = []; }, /at least one address/],
  ["an address that is not https", (entry) => { entry.addresses[0].url = "http://hub.example.com/x"; }, /https url/],
  ["an address with no label", (entry) => { entry.addresses[0].label = ""; }, /needs a label/],
  ["a chart the Catalog does not hold", (entry) => { entry.chart = "example/unknown"; }, /does not hold/],
  ["no organization", (entry) => { delete entry.organization; }, /needs organization/],
  ["an unknown field", (entry) => { entry.status = "deployed"; }, /unknown field status/],
  ["an em dash", (entry) => { entry.holds = "It holds one component — and more."; }, /em dash/],
  ["a statement that is not a sentence", (entry) => { entry.done = "uploaded"; }, /whole sentences/],
  ["an empty howTo", (entry) => { entry.howTo = ""; }, /needs howTo/],
  ["a sentence above the cap", (entry) => { entry.done = `${"word ".repeat(40).trim()}.`; }, /above 32/],
];
for (const [name, change, expected] of tampered) {
  const document = fixture();
  change(document.spec.examples[0]);
  const { problems } = validateLiveExamples(document, { knownCharts });
  assert.ok(problems.some((problem) => expected.test(problem)), `the rules did not refuse an example with ${name}: ${JSON.stringify(problems)}`);
}
const twice = fixture();
twice.spec.examples.push({ ...twice.spec.examples[0] });
assert.ok(validateLiveExamples(twice, { knownCharts }).problems.some((problem) => /second example/.test(problem)));
assert.ok(validateLiveExamples({ kind: "CatalogLiveExamples", spec: {} }, { knownCharts }).problems.length > 0, "a file with no list is refused");
assert.deepEqual(validateLiveExamples({ kind: "CatalogLiveExamples", spec: { examples: [] } }, { knownCharts }), { examples: [], problems: [] });

// The slot appears only for a chart with an example, and it shows the date,
// both statements and every address.
const helpers = {
  escapeHtml: (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"),
  commandBlock: (rows) => `<pre>${rows.map((row) => `$ ${row.cmd}`).join("\n")}</pre>`,
};
assert.equal(liveExampleSectionHtml(undefined, helpers), "", "a chart with no example shows no slot");
const slot = liveExampleSectionHtml(valid.examples[0], helpers);
for (const term of ['id="live-example"', "2026-10-08", "A reader needs access to that organization", "were uploaded as a variant", "Nothing was deployed to a cluster", 'href="https://hub.example.com/spaces/fixture"', "open the Space and then the Unit", "They need a ConfigHub account", "cub variant upload"]) {
  assert.ok(slot.includes(term), `the live example slot does not show ${JSON.stringify(term)}`);
}

console.log(`chart pages self-test: version order, summary lines, compare commands, and ${tampered.length + 2} refused live examples`);
