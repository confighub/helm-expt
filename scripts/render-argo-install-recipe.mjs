#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildRecipe } from "./lib/argo-install-recipes.mjs";
const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error("usage: node scripts/render-argo-install-recipe.mjs INPUT.json OUTPUT_DIR");
const output = resolve(outputPath);
if (existsSync(output)) throw new Error("refusing to overwrite an existing output directory");
const inputText = readFileSync(inputPath, "utf8"); let input; try { input = JSON.parse(inputText); } catch { throw new Error("input must be valid JSON"); }
const recipe = buildRecipe(input);
mkdirSync(output, { recursive: false });
const valuesText = `${JSON.stringify(recipe.values, null, 2)}\n`;
const projectsText = recipe.projects.map((item) => JSON.stringify(item, null, 2)).join("\n---\n") + "\n";
writeFileSync(`${output}/values.yaml`, valuesText); writeFileSync(`${output}/projects.yaml`, projectsText);
writeFileSync(`${output}/prerequisites.json`, `${JSON.stringify(recipe.prerequisites, null, 2)}\n`);
const hash = (value) => createHash("sha256").update(value).digest("hex");
writeFileSync(`${output}/evidence-not-run.json`, `${JSON.stringify({ candidateOnly: true, evidence: "not-run", inputSHA256: hash(inputText), outputs: { "values.yaml": hash(valuesText), "projects.yaml": hash(projectsText) }, limitations: ["No Helm render, cluster install, ConfigHub delivery, or behavioural proof was run."] }, null, 2)}\n`);
