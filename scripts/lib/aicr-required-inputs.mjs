// The rule for a generation input that a retained AICR version newly requires.
//
// Such an input changes the retained bytes, so its value has to be accounted
// for before the entry may be published. A value is accounted for in one of
// two ways. It is confirmed as the value the entry means to ship, or it is
// confirmed as a placeholder: a value the entry carries on purpose, that the
// reader is told to change, with every place it lands in the rendered
// Applications recorded beside it. A placeholder is treated the way a hook is
// treated. It is recorded, named, given a route, and resolved for the
// destination. It is not a hidden assumption.
//
// The artifact verifier and the record generator both read this module, so the
// two cannot disagree about which status words exist or what each one allows.

import { check, readYamlTexts } from "./proof-common.mjs";

export const INPUT_AWAITING = "awaiting-maintainer-confirmation";
export const INPUT_CONFIRMED = "confirmed";
export const INPUT_PLACEHOLDER = "confirmed-placeholder";
export const REQUIRED_INPUT_STATUSES = [INPUT_AWAITING, INPUT_CONFIRMED, INPUT_PLACEHOLDER];

// The field every landing sits inside. An Argo CD Application carries its
// chart values as one YAML string, so a path below is a path inside that
// string once it is parsed.
export const PLACEHOLDER_CONTAINER = "spec.source.helm.values";

// Where a key=value selector lands in a set of rendered Applications. Each
// landing is a map inside an Application's Helm values that holds the pair.
// The result is read from the bytes, so the recorded list can be checked
// against it rather than trusted.
export function placeholderLandings(applications, selector) {
  const separator = String(selector).indexOf("=");
  check(separator > 0, `a selector placeholder must be key=value, got ${selector}`);
  const key = String(selector).slice(0, separator);
  const value = String(selector).slice(separator + 1);
  const withValues = applications.filter(
    (doc) => typeof doc?.spec?.source?.helm?.values === "string",
  );
  const parsed = readYamlTexts(withValues.map((doc) => doc.spec.source.helm.values));
  const landings = [];
  withValues.forEach((doc, index) => {
    const paths = [];
    walk(parsed[index], [], (path, node) => {
      if (node && typeof node === "object" && !Array.isArray(node) && String(node[key]) === value && key in node) {
        paths.push(path.join("."));
      }
    });
    if (paths.length > 0) {
      landings.push({ application: String(doc.metadata?.name ?? ""), valuesPaths: paths.sort() });
    }
  });
  return landings.sort((left, right) => (left.application < right.application ? -1 : 1));
}

function walk(node, path, visit) {
  visit(path, node);
  if (Array.isArray(node)) node.forEach((item, index) => walk(item, [...path, `[${index}]`], visit));
  else if (node && typeof node === "object") {
    for (const [key, child] of Object.entries(node)) walk(child, [...path, key], visit);
  }
}

export function landingCounts(landings) {
  return {
    applications: landings.length,
    fieldPaths: landings.reduce((total, landing) => total + landing.valuesPaths.length, 0),
  };
}

function sameLandings(left, right) {
  const shape = (rows) => JSON.stringify(
    [...(rows ?? [])]
      .map((row) => ({ application: String(row.application ?? ""), valuesPaths: [...(row.valuesPaths ?? [])].map(String).sort() }))
      .sort((a, b) => (a.application < b.application ? -1 : 1)),
  );
  return shape(left) === shape(right);
}

// Everything wrong with one required input, as sentences. An empty list means
// the input is accounted for at the stage the entry has reached. `landings` is
// what placeholderLandings read from the rendered bytes.
export function requiredInputFindings(input, { published, landings = [] }) {
  const findings = [];
  const name = input?.input ?? "unnamed input";
  if (!REQUIRED_INPUT_STATUSES.includes(input?.valueStatus)) {
    findings.push(`${name}: required input has no confirmation status`);
    if (published) {
      findings.push(`${name}: the entry is published while this input's value is neither confirmed nor a recorded placeholder`);
    }
    return findings;
  }
  if (input.valueStatus === INPUT_AWAITING) {
    if (published) {
      findings.push(`${name}: the entry is published while this input's value is neither confirmed nor a recorded placeholder`);
    }
    return findings;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.confirmedOn ?? ""))) {
    findings.push(`${name}: a confirmed value must record the date it was confirmed`);
  }
  if (!String(input.confirmation ?? "").trim()) {
    findings.push(`${name}: a confirmed value must record what was confirmed and why`);
  }
  if (input.valueStatus !== INPUT_PLACEHOLDER) return findings;

  // A placeholder is only a recorded placeholder when the record says what to
  // change it to, which route resolves it, and where it lands in the bytes.
  const placeholder = input.placeholder ?? {};
  const unrecorded = [];
  if (!String(placeholder.meaning ?? "").trim()) unrecorded.push("what the placeholder means");
  if (!String(placeholder.changeTo ?? "").trim()) unrecorded.push("what to change it to");
  if (!String(placeholder.changeEffect ?? "").trim()) unrecorded.push("what a different value changes");
  if (!String(placeholder.route ?? "").trim()) unrecorded.push("the route that resolves it");
  if (placeholder.container !== PLACEHOLDER_CONTAINER) unrecorded.push(`the field it sits in (${PLACEHOLDER_CONTAINER})`);
  if (!Array.isArray(placeholder.appearsIn) || placeholder.appearsIn.length === 0) unrecorded.push("where it appears");
  if (unrecorded.length > 0) {
    findings.push(
      `${name}: the value is marked as a placeholder and does not record ${unrecorded.join(", ")}, so it is neither confirmed nor a recorded placeholder${published ? ", and the entry is published" : ""}`,
    );
    return findings;
  }
  if (!sameLandings(placeholder.appearsIn, landings)) {
    findings.push(
      `${name}: the recorded placeholder locations differ from the rendered Applications, which carry ${input.value} in ${landingCounts(landings).applications} Applications at ${landingCounts(landings).fieldPaths} field paths`,
    );
  }
  const counts = landingCounts(landings);
  if (placeholder.applications !== counts.applications || placeholder.fieldPaths !== counts.fieldPaths) {
    findings.push(
      `${name}: the placeholder records ${placeholder.applications} Applications and ${placeholder.fieldPaths} field paths, and the rendered bytes hold ${counts.applications} and ${counts.fieldPaths}`,
    );
  }
  return findings;
}

// The sentences a record and its listing carry for a confirmed placeholder.
// They are written from the receipt, so the count and the locations in them
// are the ones the verifier compared with the rendered bytes.
export function placeholderSentences(input) {
  const placeholder = input.placeholder;
  const where = placeholder.appearsIn
    .map((row) => `${row.application} at ${row.valuesPaths.join(" and ")}`)
    .join("; ");
  return {
    purpose: [
      `${input.input}=${input.value} is a placeholder, confirmed as one on ${input.confirmedOn}.`,
      `Change it to ${placeholder.changeTo}.`,
      `It is written into ${placeholder.container} of ${placeholder.applications} rendered Applications at ${placeholder.fieldPaths} field paths, which are ${where}.`,
      String(placeholder.changeEffect).trim(),
    ].join(" "),
    limit: `The generation input ${input.input}=${input.value} is a placeholder, confirmed as one on ${input.confirmedOn}. ${String(input.valueOrigin).trim()} Change it to ${placeholder.changeTo}. ${String(placeholder.changeEffect).trim()}`,
  };
}

// The refusals this rule exists for, exercised on every run of the artifact
// verifier. Each case starts from a placeholder that is fully recorded.
export function runRequiredInputSelfTest() {
  const landings = [
    { application: "alpha", valuesPaths: ["controller.nodeSelector"] },
    { application: "beta", valuesPaths: ["nodeSelector", "webhook.nodeSelector"] },
  ];
  const recorded = () => ({
    input: "systemNodeSelector",
    value: "nodeGroup=example",
    valueStatus: INPUT_PLACEHOLDER,
    confirmedOn: "2026-01-01",
    confirmation: "Confirmed as a placeholder.",
    placeholder: {
      meaning: "An example label.",
      changeTo: "the label on your own system node group",
      changeEffect: "A different value changes the bundle.",
      route: "system-node-selector-placeholder",
      container: PLACEHOLDER_CONTAINER,
      applications: 2,
      fieldPaths: 3,
      appearsIn: structuredClone(landings),
    },
  });
  const refused = (label, change, pattern, published = true) => {
    const input = recorded();
    change(input);
    const findings = requiredInputFindings(input, { published, landings });
    check(
      findings.some((finding) => pattern.test(finding)),
      `required-input self-test: ${label} was not refused (${findings.join(" | ") || "no finding"})`,
    );
  };
  check(
    requiredInputFindings(recorded(), { published: true, landings }).length === 0,
    "required-input self-test: a fully recorded placeholder must not block publication",
  );
  check(
    requiredInputFindings({ ...recorded(), valueStatus: INPUT_CONFIRMED, placeholder: undefined }, { published: true, landings }).length === 0,
    "required-input self-test: a confirmed value must not block publication",
  );
  check(
    requiredInputFindings({ ...recorded(), valueStatus: INPUT_AWAITING }, { published: false, landings }).length === 0,
    "required-input self-test: an unconfirmed value is allowed while the entry is unpublished",
  );
  const neither = /neither confirmed nor a recorded placeholder/;
  refused("a published entry with an unconfirmed value", (input) => { input.valueStatus = INPUT_AWAITING; }, neither);
  refused("a published entry with an unknown status", (input) => { input.valueStatus = "probably-fine"; }, neither);
  refused("a placeholder with no recorded locations", (input) => { input.placeholder.appearsIn = []; }, neither);
  refused("a placeholder with no replacement instruction", (input) => { input.placeholder.changeTo = ""; }, neither);
  refused("a placeholder with no route", (input) => { delete input.placeholder.route; }, neither);
  refused("a placeholder status with no placeholder record", (input) => { delete input.placeholder; }, neither);
  refused(
    "a placeholder whose locations differ from the bytes",
    (input) => { input.placeholder.appearsIn[0].valuesPaths = ["somewhere.else"]; },
    /recorded placeholder locations differ from the rendered Applications/,
  );
  refused(
    "a placeholder whose counts differ from the bytes",
    (input) => { input.placeholder.applications = 9; },
    /the rendered bytes hold 2 and 3/,
  );
  refused("a confirmation with no date", (input) => { delete input.confirmedOn; }, /must record the date it was confirmed/, false);
  refused("a confirmation with no reason", (input) => { input.confirmation = " "; }, /must record what was confirmed and why/, false);
}
