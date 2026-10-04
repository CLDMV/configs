/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /tests/fix-headers.test.vitest.mjs
 *	@Date: 2026-09-28T21:23:38-07:00 (1790655818)
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
 * @fileoverview fix-headers.json only sets options that @cldmv/fix-headers
 * understands, with values of the type each option declares.
 *
 * The option names and types are read from the FixHeadersOptions typedef that
 * ships in the installed @cldmv/fix-headers package, so the check follows the
 * published release rather than a hand-maintained list.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readJson } from "./helpers/package.mjs";

/**
 * Options that fix-headers.json sets ahead of the fix-headers release that
 * publishes them. All three arrive with header date validation in
 * CLDMV/fix-headers#67 (https://github.com/CLDMV/fix-headers/pull/67), which
 * ships in @cldmv/fix-headers v2.0.0. Once that release is installed its types
 * declare them and these entries are no longer consulted — drop them then.
 * @type {Record<string, string>}
 */
const PENDING_OPTIONS = {
	fixCreatedDate: "boolean",
	normalizeDateFormat: "boolean",
	strictCreatedDate: "boolean"
};

/**
 * Finds the installed @cldmv/fix-headers package root by resolving its entry
 * point and walking up to the package.json that names it.
 * @returns {string} Absolute path of the package root.
 */
function fixHeadersRoot() {
	let dir = path.dirname(fileURLToPath(import.meta.resolve("@cldmv/fix-headers")));
	while (dir !== path.dirname(dir)) {
		const manifest = path.join(dir, "package.json");
		if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === "@cldmv/fix-headers") return dir;
		dir = path.dirname(dir);
	}
	throw new Error("could not locate the installed @cldmv/fix-headers package root");
}

/**
 * Reads the top-level properties of the FixHeadersOptions typedef.
 * @returns {Map<string, string>} Option name → declared type text (first line only for multi-line types).
 */
function publishedOptions() {
	const typedef = path.join(fixHeadersRoot(), "types", "src", "core", "fix-headers.d.mts");
	const source = readFileSync(typedef, "utf8");
	const block = source.match(/export type FixHeadersOptions = \{\n([\s\S]*?)\n\};/);
	if (!block) throw new Error(`FixHeadersOptions typedef not found in ${typedef}`);
	const options = new Map();
	for (const line of block[1].split("\n")) {
		const prop = line.match(/^ {4}(\w+)\?: (.+?);?$/);
		if (prop) options.set(prop[1], prop[2]);
	}
	return options;
}

/**
 * Whether a JSON value satisfies one member of a declared TypeScript type.
 * Complex members (object literals, generics) are checked by shape only.
 * @param {unknown} value - The configured value.
 * @param {string} member - One union member of the declared type.
 * @returns {boolean} True when the value fits the member.
 */
function fitsMember(value, member) {
	const type = member.trim();
	if (type === "boolean" || type === "string" || type === "number") return typeof value === type;
	if (type === "null") return value === null;
	if (type === "string[]") return Array.isArray(value) && value.every((item) => typeof item === "string");
	if (type.startsWith("Array<")) return Array.isArray(value);
	if (type.startsWith("Record<")) return typeof value === "object" && value !== null && !Array.isArray(value);
	return false;
}

/**
 * Whether a JSON value satisfies a declared type, splitting simple unions.
 * @param {unknown} value - The configured value.
 * @param {string} type - The declared type text.
 * @returns {boolean} True when the value fits.
 */
function fitsType(value, type) {
	// A multi-line declaration (`Array<string | {`, `Record<string, {`) is judged by its head only.
	if (type.includes("<")) return fitsMember(value, type);
	return type.split("|").some((member) => fitsMember(value, member));
}

const config = /** @type {Record<string, unknown>} */ (readJson("fix-headers.json"));
const options = publishedOptions();

describe("fix-headers.json", () => {
	it("reads option names from the installed @cldmv/fix-headers types", () => {
		expect(options.size).toBeGreaterThan(10);
		expect(options.has("includeFolders")).toBe(true);
	});

	it.each(Object.keys(config))("%s is a fix-headers option", (key) => {
		expect(options.has(key) || Object.hasOwn(PENDING_OPTIONS, key), `unknown fix-headers option "${key}"`).toBe(true);
	});

	it.each(Object.entries(config))("%s has the type fix-headers declares", (key, value) => {
		const type = options.get(key) ?? PENDING_OPTIONS[key];
		expect(fitsType(value, type), `${key}: ${JSON.stringify(value)} is not ${type}`).toBe(true);
	});

	it("does not set per-run options that belong on the command line", () => {
		for (const key of ["cwd", "input", "dryRun", "check", "configFile", "sampleOutput"]) {
			expect(Object.hasOwn(config, key), `${key} is per-run, not a shared default`).toBe(false);
		}
	});
});
