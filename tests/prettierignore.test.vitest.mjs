/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /tests/prettierignore.test.vitest.mjs
 *	@Date: 2026-10-11T12:30:57-07:00 (1791747057)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T12:35:47-07:00 (1791747347)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The prettierignore file lists the paths every CLDMV repository
 * keeps out of Prettier, ends with the marker for repository-specific paths,
 * and is what this repository's own format scripts use.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pkg, root } from "./helpers/package.mjs";

const lines = readFileSync(path.join(root, "prettierignore"), "utf8").split("\n");
const patterns = lines.filter((line) => line.trim() !== "" && !line.startsWith("#"));

describe("prettierignore", () => {
	it("lists the common ignored paths, in order", () => {
		expect(patterns).toEqual([
			"node_modules/",
			"dist/",
			"build/",
			"coverage/",
			"tmp/",
			"trash/",
			"package-lock.json",
			"pnpm-lock.yaml",
			"*.min.*",
			"*.yml",
			"*.yaml"
		]);
	});

	it("explains every group with a comment directly above it", () => {
		for (const pattern of patterns) {
			let at = lines.indexOf(pattern);
			// Walk up through the group's own lines to the comment that opens it.
			while (at > 0 && lines[at].trim() !== "" && !lines[at].startsWith("#")) at -= 1;
			expect(lines[at].startsWith("#"), `${pattern} has no comment above it`).toBe(true);
		}
	});

	it("gives the reason for ignoring YAML", () => {
		expect(lines.some((line) => line.startsWith("#") && line.includes("YAML") && line.includes("tabs"))).toBe(true);
	});

	it("ends with the marker line for repository-specific paths", () => {
		expect(lines.filter((line) => line !== "").at(-1)).toBe("# --- repository-specific paths below this line ---");
	});

	it("is the start of this repository's own .prettierignore, so editors see the same list", () => {
		const shipped = readFileSync(path.join(root, "prettierignore"), "utf8");
		const own = readFileSync(path.join(root, ".prettierignore"), "utf8");
		expect(own.startsWith(shipped)).toBe(true);
	});

	it("is picked up by Prettier's defaults, with no ignore flags in the format scripts", () => {
		expect(pkg.scripts.format).not.toContain("--ignore-path");
		expect(pkg.scripts["format:check"]).not.toContain("--ignore-path");
	});
});
