# Plan step readings

**UNOFFICIAL/EXPERIMENTAL**

`readings.yaml` is written by hand. It is not generated.

Some Catalog entries take the steps of their plan from one line each of their
flattening verdict file. That line comes from a sweep of the whole chart. It
names the work and cannot say what one base needs. A reading says what one
base needs for one such step, and who does it. It comes from the base's own
retained objects and from one live run on a throwaway local cluster.

## What a reading holds

| Field | What it says |
| --- | --- |
| `record` | The name of the record under `data/base-variant-records/records/`. |
| `step` | The id of a step that record takes from its verdict file. |
| `reading` | One of the five readings below. |
| `suppliedBy` | The workload that does the work. Only a `workload-supplies` reading has it. |
| `instruction` | One to three plain sentences. They say what happens and what the reader must do, if anything. The entry page prints the first one, so it carries the answer. |
| `evidence` | The committed files that show the reading. An item may name one `object` as `Kind namespace/name`, or `Kind name` for an object with no namespace. It may list `absentKinds` that the file must not hold. `shows` quotes the field, argument or annotation. |
| `observed` | The dated log of the live run, and what the run saw, with numbers. A reading has no `observed` block when the run did not carry out the step itself. A hooks step whose hook Job did not run is one, and its reading cites the log as evidence instead. |

## The six readings

| Reading | Meaning | Phase of the step |
| --- | --- | --- |
| `workload-supplies` | The workload makes the thing itself after it starts. The reader does nothing. | `observe` |
| `needs-component-first` | Another component must be on the cluster first. | `pre-apply` |
| `hook-job` | A Helm hook Job of the chart does it, and the retained objects leave it out. | unchanged |
| `check-after-install` | The chart's hook only checks the result after an install, and the retained objects leave it out. | `post-apply` |
| `not-needed-in-this-base` | The construct the sweep counted does not render in this base. | `observe` |
| `unknown` | The committed files do not say. The step stays as it was. | unchanged |

## How the records use it

`scripts/generate-config-catalog-program.mjs` reads this file when it builds a
record. A reading refines a step that the verdict file already names. It never
adds a step.

- The step's text becomes the verdict's line and then the `instruction`.
- The phase follows the reading, as the table above says.
- The step says `observed` only when the reading has an `observed` block whose log is committed. Otherwise it says `recorded-not-run`.
- The step is never automatic, and the record's resolution is left alone.
- The step cites this file, every file the reading cites, and the log.

The entry's test script, `try-objects.sh`, stops before it applies anything
for a step whose phase is unchanged or `pre-apply`. It no longer stops for a
step the reading moved to `observe`.

## How it is checked

`npm run config-model:verify` reads this file and trusts none of it.

- Every reading names a record that exists and a step that record takes from its verdict file.
- Every cited file exists.
- Every named object is in the file it cites. The file is parsed, and the object is matched by kind, namespace and name.
- Every kind listed under `absentKinds` is absent from its file.
- A log named under `observed` exists.
- The record's step says what the reading says, and no more.

## To add or change a reading

1. Read the entry's retained objects, and name the object and the field that show the reading.
2. Run the entry's `try-objects.sh` on a throwaway cluster and record what you saw in a dated log under `docs/user/`.
3. Edit `readings.yaml`.
4. Run `node scripts/generate-config-catalog-program.mjs --generate`, `npm run catalog:listings`, `npm run workshop-catalog-guide:generate` and the site regeneration in `AGENTS.md`.
5. Run `npm run config-model:verify`.

The first thirteen readings come from the walk in
[live-walk-plan-step-readings-2026-10-11.md](../../docs/user/live-walk-plan-step-readings-2026-10-11.md).
