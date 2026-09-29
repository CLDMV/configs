/**
 *	@Project: @cldmv/configs
 *	@Filename: /tests/configs.test.vitest.mjs
 *	@Date: 2026-09-28 21:23:38 -07:00 (1790655818)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 21:25:59 -07:00 (1790655959)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Every JSON config the package publishes parses to a plain object.
 */
import { describe, expect, it } from "vitest";
import { pkg, publishedConfigs, readJson } from "./helpers/package.mjs";

describe("published configs", () => {
	it("publishes at least the fix-headers config", () => {
		expect(publishedConfigs).toContain("fix-headers.json");
	});

	it.each(publishedConfigs)("%s parses to a plain JSON object", (file) => {
		const value = readJson(file);
		expect(value).toBeTypeOf("object");
		expect(value).not.toBeNull();
		expect(Array.isArray(value)).toBe(false);
		expect(Object.keys(value).length).toBeGreaterThan(0);
	});

	it("exports every JSON config listed in files", () => {
		const shippedJson = pkg.files.filter((/** @type {string} */ entry) => entry.endsWith(".json"));
		expect([...shippedJson].sort()).toEqual([...publishedConfigs].sort());
	});
});
