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
import base from "@cldmv/configs/eslint.config.mjs";

/**
 * Finds every block that declares the given language.
 * @param {string} language - A flat-config `language` id such as `json/json`.
 * @returns {Array<Record<string, any>>} The matching blocks.
 */
const blocksFor = (language) => base.filter((block) => block.language === language);

/**
 * Lints source text with the base config alone.
 * @param {string} text - Source to lint.
 * @param {string} filePath - Virtual file path, which decides the matching blocks.
 * @returns {Promise<import("eslint").Linter.LintMessage[]>} The messages.
 */
async function lint(text, filePath) {
	const eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig: base });
	const [result] = await eslint.lintText(text, { filePath });
	return result.messages;
}

describe("eslint.config.mjs", () => {
	it("is an array so consumers can spread it", () => {
		expect(Array.isArray(base)).toBe(true);
		expect(base.length).toBeGreaterThan(5);
	});

	it("ignores dependencies, build output, coverage and scratch folders", () => {
		const ignores = base.find((block) => block.ignores && !block.files)?.ignores;
		for (const entry of ["node_modules/**", "dist/**", "coverage/**", "tmp/**"]) expect(ignores).toContain(entry);
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

	it("declares node and browser globals for scripts", () => {
		const block = base.find((entry) => entry.languageOptions?.globals?.process !== undefined);
		expect(block?.languageOptions.globals).toMatchObject({ process: expect.anything(), window: expect.anything() });
	});

	it("declares the vitest globals for *.test.vitest.mjs files", () => {
		const block = base.find((entry) => entry.files?.includes("tests/**/*.test.vitest.mjs"));
		expect(Object.keys(block?.languageOptions.globals).sort()).toEqual(
			["afterAll", "afterEach", "beforeAll", "beforeEach", "describe", "expect", "it", "test", "vi"].sort()
		);
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
