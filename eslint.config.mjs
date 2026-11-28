/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /eslint.config.mjs
 *	@Date: 2026-10-11T12:30:24-07:00 (1791747024)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T12:31:05-07:00 (1791747065)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import js from "@eslint/js";
import globals from "globals";
import json from "@eslint/json";
import jsonvPlugin from "@cldmv/eslint-plugin-jsonv";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";

/** The file globs the JavaScript blocks apply to. */
const SCRIPT_FILES = ["**/*.{js,mjs,cjs}"];

/** The Vitest test-file glob the fleet uses. */
const VITEST_FILES = ["tests/**/*.test.vitest.mjs"];

/** The globals Vitest defines when its config sets `test.globals: true`. */
const VITEST_GLOBALS = Object.freeze({
	afterAll: "readonly",
	afterEach: "readonly",
	beforeAll: "readonly",
	beforeEach: "readonly",
	describe: "readonly",
	expect: "readonly",
	it: "readonly",
	test: "readonly",
	vi: "readonly"
});

/**
 * An opt-in block that adds the browser globals (`window`, `document`, `self`, ...) to the given files. The base
 * declares only the Node globals, so a repository that ships browser code spreads this for that code's globs:
 * `export default [...base, withBrowserGlobals(["src/browser/**\/*.mjs"])];`
 * @param {string[]} [files] - The files that run in a browser. Defaults to every script file.
 * @returns {import("eslint").Linter.Config} The block.
 */
export function withBrowserGlobals(files = SCRIPT_FILES) {
	return { name: "cldmv/browser-globals", files, languageOptions: { globals: { ...globals.browser } } };
}

/**
 * An opt-in block that declares the Vitest globals for the given test files, for a repository whose Vitest config
 * sets `test.globals: true`. Without it a test must import `describe`, `it`, `expect` and the rest from `vitest`:
 * `export default [...base, withVitestGlobals()];`
 * @param {string[]} [files] - The test files. Defaults to `tests/**\/*.test.vitest.mjs`.
 * @returns {import("eslint").Linter.Config} The block.
 */
export function withVitestGlobals(files = VITEST_FILES) {
	return { name: "cldmv/vitest-globals", files, languageOptions: { globals: { ...VITEST_GLOBALS } } };
}

/**
 * CLDMV's base ESLint flat config, exported as an array so a repository spreads it and appends its own blocks:
 * `export default [...base, { files: [...], rules: {...} }];`
 *
 * Scripts get the Node globals only. Browser and Vitest globals are opt-in through `withBrowserGlobals()` and
 * `withVitestGlobals()`, and the repository's own `.configs/` files are linted like any other script.
 */
export default defineConfig([
	{
		ignores: [
			"tmp/**",
			"trash/**",
			"node_modules/**",
			"dist/**",
			"build/**",
			".git/**",
			".vscode/**",
			"coverage/**",
			"*.min.*",
			"**/package-lock.json",
			// Copy file patterns
			"*copy/",
			"*copy (*)/",
			"*copy */",
			"*copy.*",
			"*copy (*).*",
			"*copy *.*",
			"**/*copy/",
			"**/*copy (*)/",
			"**/*copy */",
			"**/*copy.*",
			"**/*copy (*).*",
			"**/*copy *.*"
		]
	},
	{
		files: SCRIPT_FILES,
		plugins: { js },
		extends: ["js/recommended"],
		rules: {
			"no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^(_|___.*)$",
					caughtErrorsIgnorePattern: "^(_|___.*)$",
					destructuredArrayIgnorePattern: "^(_|___.*)$",
					varsIgnorePattern: "^(_|___.*)$"
				}
			]
		}
	},
	{ files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
	{ files: SCRIPT_FILES, languageOptions: { globals: { ...globals.node } } },
	{ files: ["**/*.json"], plugins: { json }, language: "json/json", extends: ["json/recommended"] },
	{ files: ["**/*.jsonc"], plugins: { json }, language: "json/jsonc", extends: ["json/recommended"] },
	{ files: ["**/*.json5"], plugins: { json }, language: "json/json5", extends: ["json/recommended"] },
	{ files: ["**/*.jsonv"], plugins: { jsonv: jsonvPlugin }, language: "jsonv/jsonv", ...jsonvPlugin.configs.recommended },
	{
		files: ["**/*.md"],
		plugins: { markdown },
		language: "markdown/gfm",
		extends: ["markdown/recommended"],
		rules: {
			// GitHub alerts like [!NOTE]/[!WARNING] are valid but trip this rule.
			"markdown/no-missing-label-refs": "off"
		}
	},
	{ files: ["**/*.css"], plugins: { css }, language: "css/css", extends: ["css/recommended"] }
]);
