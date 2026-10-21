/**
 * The package's own identity, read from the package.json that ships with it.
 *
 * The version a client sees in the MCP `initialize` answer must be the installed
 * package's version; a copy in source drifts the first time the package is released.
 */

import { readFileSync } from 'node:fs';

interface PackageManifest {
  version: string;
}

// build/package-info.js → ../package.json: the manifest npm installs beside build/.
const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as PackageManifest;

export const packageVersion: string = manifest.version;
