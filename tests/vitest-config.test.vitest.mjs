/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /tests/vitest-config.test.vitest.mjs
 *	@Date: 2026-10-11T12:30:57-07:00 (1791747057)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T13:04:03-08:00 (1793567043)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview vitest.config.mjs exports a plain base config object with the
 * fleet-common settings, merges cleanly under a repository's own config, and is
 * what this repository's own Vitest config builds on. Its devCondition() helper
 * builds the `<pkg>-dev` condition settings and they reach Vitest's workers.
 */
import { afterEach, describe, expect, it } from "vitest";
import { defineConfig, mergeConfig } from "vitest/config";
import { defaultClientConditions, defaultServerConditions } from "vite";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import base, { devCondition, VITE_CLIENT_CONDITIONS, VITE_SERVER_CONDITIONS } from "@cldmv/configs/vitest.config.mjs";
import local from "../.configs/vitest.config.mjs";
import { root } from "./helpers/package.mjs";

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

	it("concatenates a repository's own include with the base glob, so a tiered repo drops the base include first", () => {
		const own = ["tests/unit/**/*.unit.test.vitest.mjs"];
		const merged = mergeConfig(base, defineConfig({ test: { include: own } }));
		expect(merged.test.include).toEqual([...base.test.include, ...own]);

		const test = { ...base.test };
		delete test.include;
		const tiered = mergeConfig({ ...base, test }, defineConfig({ test: { include: own } }));
		expect(tiered.test.include).toEqual(own);
		expect(tiered.test.coverage.provider).toBe("v8");
	});

	it("is what this repository's own config builds on", () => {
		expect(local.test.include).toEqual(base.test.include);
		expect(local.test.coverage.provider).toBe("v8");
		expect(local.test.coverage.reporter).toEqual(expect.arrayContaining(base.test.coverage.reporter));
	});
});

describe("devCondition()", () => {
	const dirs = [];

	/**
	 * Writes a package.json into a fresh temporary directory.
	 * @param {object} pkg - The package.json contents.
	 * @returns {string} The directory.
	 */
	function packageDir(pkg) {
		const dir = mkdtempSync(path.join(tmpdir(), "cldmv-configs-devcondition-"));
		dirs.push(dir);
		writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg));
		return dir;
	}

	afterEach(() => {
		for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
	});

	it("puts the condition ahead of Vite's client and server defaults and passes it to the workers", () => {
		expect(devCondition("pkg-dev")).toEqual({
			resolve: { conditions: ["pkg-dev", "module", "browser", "development|production"] },
			ssr: { resolve: { conditions: ["pkg-dev", "module", "node", "development|production"] } },
			test: { execArgv: ["--conditions=pkg-dev"] }
		});
		expect(devCondition({ name: "pkg-dev" })).toEqual(devCondition("pkg-dev"));
	});

	it("copies Vite's own default conditions", () => {
		expect(VITE_CLIENT_CONDITIONS).toEqual(defaultClientConditions);
		expect(VITE_SERVER_CONDITIONS).toEqual(defaultServerConditions);
	});

	it("reads the one -dev condition on the package's . export, from a path or a file URL", () => {
		const dir = packageDir({
			name: "@cldmv/eslint-plugin-jsonv",
			exports: { ".": { "eslint-plugin-jsonv-dev": { import: "./src/index.mjs" }, import: "./dist/index.mjs" } }
		});
		expect(devCondition({ root: dir }).test.execArgv).toEqual(["--conditions=eslint-plugin-jsonv-dev"]);
		expect(devCondition({ root: pathToFileURL(`${dir}/`) }).test.execArgv).toEqual(["--conditions=eslint-plugin-jsonv-dev"]);
	});

	it("reads a -dev condition from a sugared exports object with no . key", () => {
		const dir = packageDir({ name: "x", exports: { "x-dev": "./src/index.mjs", default: "./dist/index.mjs" } });
		expect(devCondition({ root: dir }).test.execArgv).toEqual(["--conditions=x-dev"]);
	});

	it("falls back to the unscoped package name plus -dev", () => {
		expect(devCondition({ root: packageDir({ name: "@cldmv/wisp", exports: "./dist/index.mjs" }) }).test.execArgv).toEqual([
			"--conditions=wisp-dev"
		]);
		expect(devCondition({ root: packageDir({ name: "plain" }) }).test.execArgv).toEqual(["--conditions=plain-dev"]);
	});

	it("defaults the root to the current directory", () => {
		const { name } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
		expect(process.cwd()).toBe(root);
		expect(devCondition().test.execArgv).toEqual([`--conditions=${name.split("/").pop()}-dev`]);
	});

	it("refuses to guess between several -dev conditions or without a name", () => {
		const several = packageDir({ name: "x", exports: { ".": { "a-dev": "./a.mjs", "b-dev": "./b.mjs" } } });
		expect(() => devCondition({ root: several })).toThrow(/several "-dev" conditions .*a-dev, b-dev/);
		expect(() => devCondition({ root: packageDir({}) })).toThrow(/no "-dev" export condition and no name/);
	});

	it("merges with the base config", () => {
		const merged = mergeConfig(base, devCondition("pkg-dev"));
		expect(merged.test.include).toEqual(base.test.include);
		expect(merged.test.execArgv).toEqual(["--conditions=pkg-dev"]);
		expect(merged.resolve.conditions[0]).toBe("pkg-dev");
	});

	it("reaches Vitest's worker processes", () => {
		const dir = mkdtempSync(path.join(root, "tmp", "devcondition-probe-"));
		dirs.push(dir);
		const out = path.join(dir, "argv.json");
		writeFileSync(
			path.join(dir, "probe.test.vitest.mjs"),
			`import { it } from "vitest";\nimport { writeFileSync } from "node:fs";\nit("probe", () => writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.execArgv)));\n`
		);
		writeFileSync(
			path.join(dir, "vitest.config.mjs"),
			`import { devCondition } from "@cldmv/configs/vitest.config.mjs";\nconst dc = devCondition("probe-dev");\nexport default { ...dc, root: ${JSON.stringify(dir)}, test: { ...dc.test, include: ["probe.test.vitest.mjs"] } };\n`
		);
		const vitest = path.join(root, "node_modules", "vitest", "vitest.mjs");
		const run = spawnSync(process.execPath, [vitest, "run", "--config", path.join(dir, "vitest.config.mjs")], {
			cwd: root,
			encoding: "utf8"
		});
		expect(run.status, run.stderr + run.stdout).toBe(0);
		expect(JSON.parse(readFileSync(out, "utf8"))).toContain("--conditions=probe-dev");
	});
});
