/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /tests/eslint.test.vitest.mjs
 *	@Date: 2026-10-11T12:30:57-07:00 (1791747057)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T12:31:05-07:00 (1791747065)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview eslint.config.mjs exports the fleet's flat config as an array
 * with the expected blocks, and lints with the house rules.
 */
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import base, { withBrowserGlobals, withVitestGlobals } from "@cldmv/configs/eslint.config.mjs";

/**
 * Finds every block that declares the given language.
 * @param {string} language - A flat-config `language` id such as `json/json`.
 * @returns {Array<Record<string, any>>} The matching blocks.
 */
const blocksFor = (language) => base.filter((block) => block.language === language);

/**
 * Lints source text with the base config, or with the base plus extra blocks.
 * @param {string} text - Source to lint.
 * @param {string} filePath - Virtual file path, which decides the matching blocks.
 * @param {import("eslint").Linter.Config[]} [extra] - Blocks appended after the base.
 * @returns {Promise<import("eslint").Linter.LintMessage[]>} The messages.
 */
async function lint(text, filePath, extra = []) {
	const eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig: [...base, ...extra] });
	const [result] = await eslint.lintText(text, { filePath });
	return result.messages;
}

/**
 * Names the identifiers `no-undef` reported.
 * @param {import("eslint").Linter.LintMessage[]} messages - Lint messages.
 * @returns {string[]} The undefined names, in report order.
 */
const undefinedNames = (messages) =>
	messages.filter((message) => message.ruleId === "no-undef").map((message) => /'([^']+)'/.exec(message.message)?.[1]);

describe("eslint.config.mjs", () => {
	it("is an array so consumers can spread it", () => {
		expect(Array.isArray(base)).toBe(true);
		expect(base.length).toBeGreaterThan(5);
	});

	it("ignores dependencies, build output, coverage and scratch folders", () => {
		const ignores = base.find((block) => block.ignores && !block.files)?.ignores;
		for (const entry of ["node_modules/**", "dist/**", "coverage/**", "tmp/**"]) expect(ignores).toContain(entry);
	});

	it("lints the repository's own .configs/ files", async () => {
		const ignores = base.find((block) => block.ignores && !block.files)?.ignores;
		expect(ignores).not.toContain(".configs/**");
		const messages = await lint(
			'import base from "@cldmv/configs/eslint.config.mjs";\n\nexport default [];\n',
			".configs/eslint.config.mjs"
		);
		expect(messages.map((message) => message.message)).toEqual([expect.stringContaining("'base'")]);
	});

	it.each(["json/json", "json/jsonc", "json/json5", "jsonv/jsonv", "markdown/gfm", "css/css"])(
		"has a block for the %s language",
		(language) => {
			expect(blocksFor(language).length).toBeGreaterThan(0);
		}
	);

	it("has no HTML block", () => {
		expect(base.some((block) => String(block.language ?? "").startsWith("html/"))).toBe(false);
	});

	it("treats .js files as CommonJS", () => {
		const block = base.find((entry) => entry.languageOptions?.sourceType === "commonjs");
		expect(block?.files).toEqual(["**/*.js"]);
	});

	it("declares the Node globals for scripts, and no browser globals", () => {
		const block = base.find((entry) => entry.languageOptions?.globals?.process !== undefined);
		expect(block?.languageOptions.globals).toMatchObject({ process: expect.anything(), Buffer: expect.anything() });
		const declared = base.flatMap((entry) => Object.keys(entry.languageOptions?.globals ?? {}));
		for (const name of ["window", "document", "self", "name"]) expect(declared).not.toContain(name);
	});

	it("reports browser globals in a Node script", async () => {
		const messages = await lint("export default [process.env.HOME, window, self];\n", "src/sample.mjs");
		expect(undefinedNames(messages)).toEqual(["window", "self"]);
	});

	it("declares no Vitest globals, so a test must import them", async () => {
		expect(base.some((entry) => entry.languageOptions?.globals?.describe !== undefined)).toBe(false);
		const messages = await lint('describe("x", () => { it("y", () => expect(1).toBe(1)); });\n', "tests/sample.test.vitest.mjs");
		expect(undefinedNames(messages)).toEqual(["describe", "it", "expect"]);
	});

	describe("withBrowserGlobals()", () => {
		it("adds the browser globals to every script by default", async () => {
			const block = withBrowserGlobals();
			expect(block.files).toEqual(["**/*.{js,mjs,cjs}"]);
			expect(block.languageOptions.globals).toMatchObject({ window: expect.anything(), document: expect.anything() });
			expect(await lint("export default [window, document, process];\n", "src/sample.mjs", [block])).toEqual([]);
		});

		it("adds them only to the files it is given", async () => {
			const extra = [withBrowserGlobals(["src/browser/**/*.mjs"])];
			expect(await lint("export default window;\n", "src/browser/page.mjs", extra)).toEqual([]);
			expect(undefinedNames(await lint("export default window;\n", "src/server.mjs", extra))).toEqual(["window"]);
		});
	});

	describe("withVitestGlobals()", () => {
		it("declares the Vitest globals for *.test.vitest.mjs files by default", async () => {
			const block = withVitestGlobals();
			expect(block.files).toEqual(["tests/**/*.test.vitest.mjs"]);
			expect(Object.keys(block.languageOptions.globals).sort()).toEqual(
				["afterAll", "afterEach", "beforeAll", "beforeEach", "describe", "expect", "it", "test", "vi"].sort()
			);
			const messages = await lint('describe("x", () => { it("y", () => expect(1).toBe(1)); });\n', "tests/sample.test.vitest.mjs", [block]);
			expect(messages).toEqual([]);
		});

		it("declares them only for the files it is given, and read-only", async () => {
			const extra = [withVitestGlobals(["spec/**/*.mjs"])];
			expect(await lint("describe;\n", "spec/a.mjs", extra)).toEqual([]);
			expect(undefinedNames(await lint("describe;\n", "tests/a.test.vitest.mjs", extra))).toEqual(["describe"]);
			const messages = await lint("describe = 1;\n", "spec/a.mjs", extra);
			expect(messages.map((message) => message.ruleId)).toEqual(["no-global-assign"]);
		});
	});

	it("turns the markdown label-reference rule off", () => {
		// `extends` expands into several blocks; the override is the last one that sets the rule.
		const block = base.findLast((entry) => entry.rules?.["markdown/no-missing-label-refs"] !== undefined);
		expect(block?.rules["markdown/no-missing-label-refs"]).toBe("off");
	});

	it("reports an unused variable but not one named `_` or starting with three underscores", async () => {
		const messages = await lint(
			"const used = 1;\nconst _ = 2;\nconst ___skipped = 3;\nconst unused = 4;\nexport default used;\n",
			"sample.mjs"
		);
		expect(messages.map((message) => message.message)).toEqual([expect.stringContaining("'unused'")]);
	});

	it("lints JSON with the json plugin", async () => {
		const messages = await lint('{"a": 1, "a": 2}', "sample.json");
		expect(messages.some((message) => message.ruleId === "json/no-duplicate-keys")).toBe(true);
	});
});
