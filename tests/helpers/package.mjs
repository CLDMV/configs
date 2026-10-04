/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /tests/helpers/package.mjs
 *	@Date: 2026-09-28T21:22:58-07:00 (1790655778)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T19:43:16-07:00 (1791081796)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Shared helpers for the @cldmv/configs test suite: the package
 * root, its package.json, and the list of JSON configs the package publishes.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path of the package root. */
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Reads and parses a JSON file relative to the package root.
 * @param {string} rel - Path relative to the package root.
 * @returns {unknown} The parsed JSON value.
 */
export function readJson(rel) {
	return JSON.parse(readFileSync(path.join(root, rel), "utf8"));
}

/** The package's own package.json. */
export const pkg = /** @type {Record<string, any>} */ (readJson("package.json"));

/**
 * The JSON config files the package publishes: every `exports` target that ends
 * in `.json`, except the package's own package.json.
 * @type {string[]}
 */
export const publishedConfigs = Object.entries(pkg.exports)
	.filter(([subpath, target]) => subpath !== "./package.json" && typeof target === "string" && target.endsWith(".json"))
	.map(([, target]) => target.replace(/^\.\//, ""));
