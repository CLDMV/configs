/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /tests/package.test.vitest.mjs
 *	@Date: 2026-09-28T21:23:59-07:00 (1790655839)
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
 * @fileoverview The package manifest publishes exactly the intended files and
 * every `exports` entry resolves to a file that ships.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pkg, root } from "./helpers/package.mjs";

/** Every file the published tarball should contain, and nothing else. */
const INTENDED_FILES = ["LICENSE", "README.md", "fix-headers.json", "package.json"];

/**
 * Lists the files `npm pack` would publish, without running lifecycle scripts.
 * @returns {string[]} Sorted paths relative to the package root.
 */
function packedFiles() {
	const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
		cwd: root,
		encoding: "utf8",
		shell: process.platform === "win32"
	});
	if (result.status !== 0) throw new Error(`npm pack --dry-run failed (${result.status}): ${result.stderr}`);
	// npm <= 11 prints an array of pack reports; npm 12 keys the report by package name.
	const parsed = JSON.parse(result.stdout);
	const report = Array.isArray(parsed) ? parsed[0] : parsed[pkg.name];
	return report.files.map((/** @type {{ path: string }} */ file) => file.path).sort();
}

const shipped = packedFiles();

describe("package contents", () => {
	it("npm pack contains exactly the intended files", () => {
		expect(shipped).toEqual([...INTENDED_FILES].sort());
	});

	it("has no runtime dependencies", () => {
		expect(pkg.dependencies).toBeUndefined();
		expect(pkg.peerDependencies).toBeUndefined();
		expect(pkg.optionalDependencies).toBeUndefined();
	});
});

describe("exports", () => {
	const entries = Object.entries(pkg.exports);

	it("exposes the fix-headers config and package.json", () => {
		expect(pkg.exports).toMatchObject({
			"./fix-headers.json": "./fix-headers.json",
			"./package.json": "./package.json"
		});
	});

	it.each(entries)("%s targets a file that ships", (_subpath, target) => {
		const rel = /** @type {string} */ (target).replace(/^\.\//, "");
		expect(existsSync(path.join(root, rel))).toBe(true);
		expect(shipped).toContain(rel);
	});

	it.each(entries)("%s resolves through the package name", (subpath, target) => {
		const specifier = `${pkg.name}/${subpath.replace(/^\.\//, "")}`;
		expect(fileURLToPath(import.meta.resolve(specifier))).toBe(path.join(root, /** @type {string} */ (target)));
	});

	it("imports fix-headers.json as a JSON module by its public specifier", async () => {
		const mod = await import("@cldmv/configs/fix-headers.json", { with: { type: "json" } });
		expect(mod.default).toMatchObject({ company: "CLDMV", includeFolders: ["."] });
	});
});
