// The lists of chart additions that share one orchestrator, one scoped
// publisher and one role-assignment script. The NVIDIA GPU stack list was the
// first; the scripts were written for it and keep its name. A second list
// reuses them by passing `--set <name>`.
//
// `label` is how messages name the list. `npmPrefix` is the npm script family
// whose commands the generated READMEs print. `packagePathPattern` is what the
// scoped publisher accepts as an exact package path for the list.

import { NVIDIA_GPU_STACK_ADDITIONS, NVIDIA_GPU_STACK_ROLES } from "./nvidia-gpu-stack-coverage.mjs";
import { AICR_NESTED_CHART_ADDITIONS, AICR_NESTED_CHART_ROLES } from "./aicr-nested-charts-coverage.mjs";

export const DEFAULT_COVERAGE_SET = "nvidia-gpu-stack";

export const COVERAGE_SETS = Object.freeze({
  "nvidia-gpu-stack": Object.freeze({
    name: "nvidia-gpu-stack",
    label: "NVIDIA GPU stack",
    additions: NVIDIA_GPU_STACK_ADDITIONS,
    roles: NVIDIA_GPU_STACK_ROLES,
    rolesName: "NVIDIA_GPU_STACK_ROLES",
    npmPrefix: "nvidia-gpu-stack-coverage",
    packagePathPattern: /^packages\/nvidia\/[a-z0-9-]+\/[A-Za-z0-9_.-]+$/,
    packagePathLabel: "an exact NVIDIA package path",
    setFlag: "",
  }),
  "aicr-nested-charts": Object.freeze({
    name: "aicr-nested-charts",
    label: "AICR nested chart",
    additions: AICR_NESTED_CHART_ADDITIONS,
    roles: AICR_NESTED_CHART_ROLES,
    rolesName: "AICR_NESTED_CHART_ROLES",
    npmPrefix: "aicr-nested-charts-coverage",
    packagePathPattern: /^packages\/[a-z0-9-]+\/[a-z0-9-]+\/[A-Za-z0-9_.-]+$/,
    packagePathLabel: "an exact package path",
    setFlag: " --set aicr-nested-charts",
  }),
});

// Reads `--set <name>` out of an argument list. Returns the set and the
// arguments without the flag, so each script keeps its own argument handling.
export function coverageSetFromArgs(args) {
  const index = args.indexOf("--set");
  if (index === -1) return { set: COVERAGE_SETS[DEFAULT_COVERAGE_SET], rest: [...args] };
  const name = args[index + 1];
  const set = COVERAGE_SETS[name];
  if (!set) throw new Error(`--set must be one of ${Object.keys(COVERAGE_SETS).join(", ")}`);
  return { set, rest: [...args.slice(0, index), ...args.slice(index + 2)] };
}

// The addition a chart version belongs to, in any list.
export function coverageAddition(repository, chart, version) {
  for (const set of Object.values(COVERAGE_SETS)) {
    const found = set.additions.find((item) => item.repository === repository && item.chart === chart && item.version === version);
    if (found) return found;
  }
  return null;
}
