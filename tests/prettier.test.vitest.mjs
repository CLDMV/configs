/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /tests/prettier.test.vitest.mjs
 *	@Date: 2026-10-11T11:27:41-07:00 (1791743261)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T11:27:44-07:00 (1791743264)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview prettier.json only sets options that Prettier understands, with
 * the house values, and the optional jsonv plugin it names is the peer the
 * package declares.
 *
 * Option names are read from the installed Prettier (`getSupportInfo`), so the
 * check follows the release in use rather than a hand-maintained list.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import { pkg, readJson, root } from "./helpers/package.mjs";

const config = /** @type {Record<string, any>} */ (readJson("prettier.json"));
const { options: supported } = await prettier.getSupportInfo();
const optionNames = new Set(supported.map((/** @type {{ name: string }} */ option) => option.name));

describe("prettier.json", () => {
	it("reads option names from the installed Prettier", () => {
		expect(optionNames.has("printWidth")).toBe(true);
		expect(optionNames.has("proseWrap")).toBe(true);
	});

	it("sets the house formatting options", () => {
		expect(config).toMatchObject({
			useTabs: true,
			tabWidth: 2,
			printWidth: 140,
			trailingComma: "none",
			quoteProps: "preserve",
			bracketSpacing: true
		});
	});

	it.each(Object.keys(config).filter((key) => !["overrides", "plugins"].includes(key)))("%s is a Prettier option", (key) => {
		expect(optionNames.has(key), `unknown Prettier option "${key}"`).toBe(true);
	});

	it("only sets known top-level keys", () => {
		const structural = ["overrides", "plugins"];
		for (const key of Object.keys(config)) {
			expect(optionNames.has(key) || structural.includes(key), `unexpected key "${key}"`).toBe(true);
		}
	});

	it("overrides xml width, markdown prose wrapping and the jsonv parser", () => {
		const byFiles = Object.fromEntries(config.overrides.map((/** @type {{ files: string }} */ entry) => [entry.files, entry.options]));
		expect(byFiles).toEqual({
			"*.xml": { printWidth: 300 },
			"*.md": { proseWrap: "preserve" },
			"*.jsonv": { parser: "jsonv" }
		});
	});

	it("override options are Prettier options", () => {
		for (const entry of config.overrides) {
			for (const key of Object.keys(entry.options)) expect(optionNames.has(key), `unknown override option "${key}"`).toBe(true);
		}
	});

	it("loads the jsonv plugin, which the package declares as an optional peer", () => {
		expect(config.plugins).toEqual(["@cldmv/prettier-plugin-jsonv"]);
		for (const plugin of config.plugins) {
			expect(pkg.peerDependencies).toHaveProperty([plugin]);
			expect(pkg.peerDependenciesMeta[plugin]).toEqual({ optional: true });
		}
	});

	it("is what the repository's own Prettier config re-exports", async () => {
		const local = path.join(root, ".configs", "prettier.config.mjs");
		expect(existsSync(local)).toBe(true);
		const mod = await import(local);
		expect(mod.default).toEqual(config);
	});

	it("formats a sample with tabs and the configured width", async () => {
		const out = await prettier.format("function f() {\nreturn {a:1}\n}\n", { parser: "babel", ...config, plugins: [], overrides: [] });
		expect(out).toBe("function f() {\n\treturn { a: 1 };\n}\n");
	});
});
