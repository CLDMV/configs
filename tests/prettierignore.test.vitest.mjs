/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /tests/prettierignore.test.vitest.mjs
 *	@Date: 2026-10-11T12:30:57-07:00 (1791747057)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T12:47:00-07:00 (1791748020)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The prettierignore file lists the paths every CLDMV repository
 * keeps out of Prettier inside a managed block, and this repository's own
 * `.prettierignore` carries the same block.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pkg, root } from "./helpers/package.mjs";

const lines = readFileSync(path.join(root, "prettierignore"), "utf8").split("\n");
const CLOSE = "# <<< @cldmv/configs prettierignore";

/**
 * The managed block, from the opening marker to the closing marker, with the opening marker's version removed.
 * @param {string[]} fileLines - Lines of a prettierignore file.
 * @returns {string[]} The block lines.
 */
function managedBlock(fileLines) {
	const open = fileLines.findIndex((line) => line.startsWith("# >>> @cldmv/configs prettierignore"));
	const close = fileLines.indexOf(CLOSE);
	return fileLines.slice(open, close + 1).map((line, index) => (index === 0 ? line.replace(/ v\S+ —/, " —") : line));
}

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

	it("wraps the shared lines in the managed-block markers and ends with the repo-specific note", () => {
		const content = lines.filter((line) => line !== "");
		expect(content[0]).toMatch(
			/^# >>> @cldmv\/configs prettierignore — managed block, do not edit between the markers; run `npx cldmv-configs sync` to refresh$/
		);
		expect(content.filter((line) => line === CLOSE)).toHaveLength(1);
		expect(content.at(-2)).toBe(CLOSE);
		expect(content.at(-1)).toMatch(/^# Repo-specific ignores go below this line; they survive every sync\. Use `!path` to re-include/);
	});

	it("has a managed region in this repository's own .prettierignore that equals the shipped block", () => {
		const own = readFileSync(path.join(root, ".prettierignore"), "utf8").split("\n");
		expect(managedBlock(own)).toEqual(managedBlock(lines));
		expect(managedBlock(own).length).toBeGreaterThan(10);
	});

	it("is picked up by Prettier's defaults, with no ignore flags in the format scripts", () => {
		expect(pkg.scripts.format).not.toContain("--ignore-path");
		expect(pkg.scripts["format:check"]).not.toContain("--ignore-path");
	});
});
