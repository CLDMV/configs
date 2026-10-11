/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /tests/vitest-config.test.vitest.mjs
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
 * @fileoverview vitest.config.mjs exports a plain base config object with the
 * fleet-common settings, merges cleanly under a repository's own config, and is
 * what this repository's own Vitest config builds on.
 */
import { describe, expect, it } from "vitest";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "@cldmv/configs/vitest.config.mjs";
import local from "../.configs/vitest.config.mjs";

describe("vitest.config.mjs", () => {
	it("is a plain object, not a function or a repository-bound config", () => {
		expect(base).toBeTypeOf("object");
		expect(Array.isArray(base)).toBe(false);
		expect(base).not.toHaveProperty("root");
	});

	it("includes the fleet's test file pattern", () => {
		expect(base.test.include).toEqual(["tests/**/*.test.vitest.{js,mjs,cjs}"]);
	});

	it("measures coverage with v8 and writes the summary and lcov reports to coverage/", () => {
		expect(base.test.coverage).toMatchObject({ provider: "v8", reportsDirectory: "coverage" });
		expect(base.test.coverage.reporter).toEqual(expect.arrayContaining(["text", "json-summary", "lcov"]));
	});

	it("leaves coverage include globs and thresholds to the repository", () => {
		expect(base.test.coverage).not.toHaveProperty("include");
		expect(base.test.coverage).not.toHaveProperty("exclude");
		expect(base.test.coverage).not.toHaveProperty("thresholds");
	});

	it("keeps the base settings when a repository merges its own coverage include", () => {
		const merged = mergeConfig(base, defineConfig({ test: { coverage: { include: ["src/**"] } } }));
		expect(merged.test.coverage).toMatchObject({ provider: "v8", include: ["src/**"], reportsDirectory: "coverage" });
		expect(merged.test.include).toEqual(base.test.include);
	});

	it("is what this repository's own config builds on", () => {
		expect(local.test.include).toEqual(base.test.include);
		expect(local.test.coverage.provider).toBe("v8");
		expect(local.test.coverage.reporter).toEqual(expect.arrayContaining(base.test.coverage.reporter));
	});
});
