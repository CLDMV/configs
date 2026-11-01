/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /vitest.config.mjs
 *	@Date: 2026-10-11T12:30:24-07:00 (1791747024)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T13:04:03-08:00 (1793567043)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Vite's own default resolve conditions (`defaultClientConditions` / `defaultServerConditions`, Vite 6 and later). Setting
 * `resolve.conditions` replaces Vite's defaults instead of adding to them, so `devCondition()` puts them back after the package's
 * condition. They are copied here so this module needs nothing installed; a test checks them against the installed Vite.
 */
export const VITE_CLIENT_CONDITIONS = Object.freeze(["module", "browser", "development|production"]);
export const VITE_SERVER_CONDITIONS = Object.freeze(["module", "node", "development|production"]);

/**
 * Reads the `<pkg>-dev` condition name from a package.json: the one export condition ending in `-dev` on the "." export,
 * otherwise the unscoped package name plus `-dev`.
 * @param {string} root - Directory holding package.json.
 * @returns {string} The condition name.
 */
function conditionFromPackage(root) {
	const file = path.join(root, "package.json");
	const pkg = JSON.parse(readFileSync(file, "utf8"));
	const dot = pkg.exports && typeof pkg.exports === "object" ? (pkg.exports["."] ?? pkg.exports) : null;
	const fromExports = dot && typeof dot === "object" ? Object.keys(dot).filter((key) => key.endsWith("-dev")) : [];
	if (fromExports.length === 1) return fromExports[0];
	if (fromExports.length > 1) {
		throw new Error(`devCondition: ${file} has several "-dev" conditions on "." (${fromExports.join(", ")}); pass the name`);
	}
	if (typeof pkg.name !== "string" || pkg.name === "") {
		throw new Error(`devCondition: ${file} has no "-dev" export condition and no name; pass the condition name`);
	}
	return `${pkg.name.split("/").pop()}-dev`;
}

/**
 * Builds the Vitest settings that make a package's tests load `src/` through its `<pkg>-dev` export condition: Vite's client
 * and SSR resolvers get the condition ahead of Vite's defaults, and Vitest's worker processes get `--conditions=<name>`
 * through `test.execArgv`, so Node's own resolver (a `require()`, or anything loaded outside Vite) picks `src/` too. Merge
 * the result with `mergeConfig`. `test.nodeOptions` is not a Vitest option and does nothing; `test.execArgv` reaches the workers.
 *
 * @param {string | { name?: string, root?: string | URL }} [options] - The condition name, or where to read it from. With
 *   no name, it comes from `<root>/package.json` (default root: the current directory): the "." export's one `-dev`
 *   condition, otherwise the unscoped package name plus `-dev`.
 * @returns {{ resolve: { conditions: string[] }, ssr: { resolve: { conditions: string[] } }, test: { execArgv: string[] } }}
 *   A partial Vitest config.
 * @example
 * export default mergeConfig(base, mergeConfig(devCondition({ root: new URL("..", import.meta.url) }), defineConfig({ ... })));
 */
export function devCondition(options = {}) {
	const { name, root = process.cwd() } = typeof options === "string" ? { name: options } : options;
	const condition = name ?? conditionFromPackage(root instanceof URL ? fileURLToPath(root) : root);
	return {
		resolve: { conditions: [condition, ...VITE_CLIENT_CONDITIONS] },
		ssr: { resolve: { conditions: [condition, ...VITE_SERVER_CONDITIONS] } },
		test: { execArgv: [`--conditions=${condition}`] }
	};
}

/**
 * CLDMV's base Vitest config, exported as a plain object (no `defineConfig` call, no repository root) so a repository merges its own
 * settings over it with `mergeConfig`. Arrays such as `include` and `reporter` are concatenated by `mergeConfig`, not replaced.
 * Coverage `include` globs and thresholds are left to the repository.
 */
export default {
	test: {
		environment: "node",
		include: ["tests/**/*.test.vitest.{js,mjs,cjs}"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "json-summary", "lcov"],
			reportsDirectory: "coverage"
		}
	}
};
