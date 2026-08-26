import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

import { check, readYaml } from "./proof-common.mjs";

export function copyInstalledCubPlugin({ commandName, home, pluginName }) {
  const sourceRoot = join(homedir(), ".confighub", "plugins", pluginName);
  const manifestPath = join(sourceRoot, "cub-plugin.yaml");
  check(existsSync(manifestPath), `cub ${commandName} plugin is not installed`);

  const manifest = readYaml(manifestPath);
  const declaredEntrypoint = String(
    manifest.commands?.find((command) => command?.name === commandName)
      ?.entrypoint ?? commandName,
  );
  check(
    declaredEntrypoint
      && !declaredEntrypoint.startsWith("/")
      && !declaredEntrypoint.split("/").includes(".."),
    `cub ${commandName} plugin declares an invalid entrypoint`,
  );

  const sourceBinary = [
    join(sourceRoot, declaredEntrypoint),
    join(sourceRoot, "bin", basename(declaredEntrypoint)),
  ].find((candidate) => existsSync(candidate));
  check(sourceBinary, `cub ${commandName} plugin executable is not installed`);

  const targetRoot = join(home, ".confighub", "plugins", pluginName);
  const targetBinary = join(targetRoot, declaredEntrypoint);
  mkdirSync(dirname(targetBinary), { recursive: true });
  copyFileSync(manifestPath, join(targetRoot, "cub-plugin.yaml"));
  copyFileSync(sourceBinary, targetBinary);
  chmodSync(targetBinary, 0o755);
}
