/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /tests/cli.test.vitest.mjs
 *	@Date: 2026-10-11T12:46:39-07:00 (1791747999)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T13:10:36-07:00 (1791749436)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The cldmv-configs bin: `init` creates the stubs, `.prettierignore` and scripts without overwriting anything, `check` reports
 * drift without writing, `sync` rewrites only the managed block, and `--dry-run` and `--json` behave. Each test runs the bin against a
 * temporary consumer repository created under the repository's `tmp/`.
 */
import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { pkg, root } from "./helpers/package.mjs";

const bin = path.join(root, "bin", "cldmv-configs.mjs");
const scratch = path.join(root, "tmp", "cli-tests");
mkdirSync(scratch, { recursive: true });
const made = [];

/**
 * Creates a consumer repository containing a package.json.
 * @param {string} [manifest] - The package.json text.
 * @returns {string} The repository path.
 */
function consumer(
	manifest = '{\n\t"name": "consumer",\n\t"version": "1.0.0",\n\t"devDependencies": {\n\t\t"@cldmv/configs": "^1.3.0"\n\t}\n}\n'
) {
	const dir = mkdtempSync(path.join(scratch, "repo-"));
	made.push(dir);
	if (manifest !== null) writeFileSync(path.join(dir, "package.json"), manifest);
	return dir;
}

/**
 * Runs the bin in a directory.
 * @param {string} cwd - Working directory.
 * @param {...string} args - Command-line arguments.
 * @returns {{ status: number | null, stdout: string, stderr: string }} The result.
 */
function run(cwd, ...args) {
	const result = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" });
	return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const read = (dir, file) => readFileSync(path.join(dir, file), "utf8");
const FILES = [
	".configs/fix-headers.json",
	".configs/prettier.config.mjs",
	".configs/eslint.config.mjs",
	".configs/vitest.config.mjs",
	".prettierignore"
];
const SCRIPTS = ["format", "format:check", "lint", "lint:fix", "fix:headers", "test", "coverage"];

afterAll(() => {
	rmSync(scratch, { recursive: true, force: true });
});

describe("the bin file", () => {
	it("is listed in package.json bin and files, and shipped", () => {
		expect(pkg.bin).toEqual({ "cldmv-configs": "bin/cldmv-configs.mjs" });
		expect(pkg.files).toContain("bin/");
	});

	it("is executable, starts with a node shebang and parses", () => {
		accessSync(bin, constants.X_OK);
		expect(statSync(bin).mode & 0o111).not.toBe(0);
		expect(readFileSync(bin, "utf8").startsWith("#!/usr/bin/env node\n")).toBe(true);
		const syntax = spawnSync(process.execPath, ["--check", bin], { encoding: "utf8" });
		expect(syntax.status, syntax.stderr).toBe(0);
	});

	it("has no imports beyond Node built-ins", () => {
		const specifiers = [...readFileSync(bin, "utf8").matchAll(/^import .* from "([^"]+)";$/gm)].map((match) => match[1]);
		expect(specifiers.length).toBeGreaterThan(0);
		for (const specifier of specifiers) expect(specifier.startsWith("node:"), specifier).toBe(true);
	});
});

describe("usage", () => {
	const dir = consumer();

	it("prints help for the bin and every command with exit 0", () => {
		for (const args of [["--help"], ["init", "--help"], ["check", "--help"], ["sync", "--help"]]) {
			const result = run(dir, ...args);
			expect(result.status, args.join(" ")).toBe(0);
			expect(result.stdout).toContain("Usage:");
		}
	});

	it("exits 2 for an unknown command, an unknown option and no command", () => {
		expect(run(dir, "bogus").status).toBe(2);
		expect(run(dir, "init", "--bogus").status).toBe(2);
		expect(run(dir).status).toBe(2);
	});

	it("exits 2 when run outside a package", () => {
		const empty = consumer(null);
		expect(run(empty, "init").status).toBe(2);
		expect(run(empty, "check").status).toBe(2);
		expect(JSON.parse(run(empty, "init", "--json").stdout)).toMatchObject({ ok: false });
	});
});

describe("init", () => {
	it("creates every stub, the ignore file and the scripts, and a second run keeps all of it", () => {
		const dir = consumer();
		const first = run(dir, "init");
		expect(first.status, first.stderr).toBe(0);
		for (const file of FILES) expect(existsSync(path.join(dir, file)), file).toBe(true);
		expect(first.stdout).toContain("created  .configs/fix-headers.json");
		expect(first.stdout).toContain("added    lint:fix");
		const manifest = JSON.parse(read(dir, "package.json"));
		expect(Object.keys(manifest.scripts)).toEqual(SCRIPTS);
		expect(manifest.scripts.test).toBe("vitest run --config .configs/vitest.config.mjs");
		expect(read(dir, ".configs/fix-headers.json")).toBe('{\n\t"extends": "@cldmv/configs/fix-headers.json"\n}\n');
		expect(read(dir, ".configs/eslint.config.mjs")).toContain("export default [...base];");
		expect(read(dir, ".configs/vitest.config.mjs")).toContain("mergeConfig(base");

		const before = Object.fromEntries([...FILES, "package.json"].map((file) => [file, read(dir, file)]));
		const second = run(dir, "init");
		expect(second.status).toBe(0);
		expect(second.stdout).not.toMatch(/created|added/);
		expect(second.stdout).toContain("kept     .configs/eslint.config.mjs");
		expect(second.stdout).toContain("kept     format:check");
		for (const [file, content] of Object.entries(before)) expect(read(dir, file), file).toBe(content);
	});

	it("keeps an existing customized stub and script untouched, and adds the rest", () => {
		const dir = consumer(
			'{\n  "name": "x",\n  "scripts": {\n    "lint": "eslint src",\n    "test": "node --test"\n  },\n  "files": ["a", "b"]\n}\n'
		);
		mkdirSync(path.join(dir, ".configs"));
		writeFileSync(path.join(dir, ".configs/eslint.config.mjs"), "export default [];\n");
		const result = run(dir, "init");
		expect(result.status).toBe(0);
		expect(read(dir, ".configs/eslint.config.mjs")).toBe("export default [];\n");
		expect(result.stdout).toContain("kept     .configs/eslint.config.mjs");
		expect(result.stdout).toContain("kept     lint: already defined");
		const text = read(dir, "package.json");
		const manifest = JSON.parse(text);
		expect(manifest.scripts.lint).toBe("eslint src");
		expect(manifest.scripts.test).toBe("node --test");
		expect(manifest.scripts.format).toContain(".configs/prettier.config.mjs");
		expect(Object.keys(manifest.scripts).slice(0, 2)).toEqual(["lint", "test"]);
		expect(text.startsWith('{\n  "name"')).toBe(true);
		expect(text.endsWith("\n")).toBe(true);
		expect(text).toContain('\n    "format"');
	});

	it("writes nothing with --dry-run, and says what it would do", () => {
		const dir = consumer();
		const before = read(dir, "package.json");
		const result = run(dir, "init", "--dry-run");
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("would create .configs/fix-headers.json");
		expect(result.stdout).toContain("would add");
		expect(existsSync(path.join(dir, ".configs"))).toBe(false);
		expect(existsSync(path.join(dir, ".prettierignore"))).toBe(false);
		expect(read(dir, "package.json")).toBe(before);
	});

	it("prints a machine-readable summary with --json", () => {
		const dir = consumer();
		const summary = JSON.parse(run(dir, "init", "--json").stdout);
		expect(summary).toMatchObject({ command: "init", ok: true, dryRun: false });
		expect(summary.results.filter((result) => result.level === "created")).toHaveLength(FILES.length);
		expect(summary.results.filter((result) => result.level === "added")).toHaveLength(SCRIPTS.length);
	});

	it("leaves an existing .prettierignore without markers alone and says how to adopt the block", () => {
		const dir = consumer();
		writeFileSync(path.join(dir, ".prettierignore"), "out/\n");
		const result = run(dir, "init");
		expect(result.status).toBe(0);
		expect(read(dir, ".prettierignore")).toBe("out/\n");
		expect(result.stdout).toContain("without a managed block");
	});
});

describe("check", () => {
	it("is green right after init and writes nothing", () => {
		const dir = consumer();
		run(dir, "init");
		const before = Object.fromEntries([...FILES, "package.json"].map((file) => [file, read(dir, file)]));
		const result = run(dir, "check");
		expect(result.status, result.stdout).toBe(0);
		expect(result.stdout).toContain("0 problem(s), 0 warning(s)");
		for (const [file, content] of Object.entries(before)) expect(read(dir, file), file).toBe(content);
	});

	it("reports an edited managed block with exit 1", () => {
		const dir = consumer();
		run(dir, "init");
		writeFileSync(
			path.join(dir, ".prettierignore"),
			read(dir, ".prettierignore").replace("node_modules/\n", "node_modules/\nextra-ignored/\n")
		);
		const result = run(dir, "check");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain(`problem  .prettierignore: managed block was edited (marker says v${pkg.version})`);

		writeFileSync(
			path.join(dir, ".prettierignore"),
			read(dir, ".prettierignore").replace(`prettierignore v${pkg.version}`, "prettierignore v0.0.1")
		);
		const old = run(dir, "check");
		expect(old.status).toBe(1);
		expect(old.stdout).toContain(`managed block is from v0.0.1 or edited, package ships v${pkg.version}`);
	});

	it("reports a version-only difference as ok", () => {
		const dir = consumer();
		run(dir, "init");
		writeFileSync(
			path.join(dir, ".prettierignore"),
			read(dir, ".prettierignore").replace(`prettierignore v${pkg.version}`, "prettierignore v0.0.1")
		);
		const result = run(dir, "check");
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("marker says v0.0.1");
	});

	it("reports a missing or detached stub as a problem, and never judges the repository's own additions", () => {
		const dir = consumer();
		run(dir, "init");
		rmSync(path.join(dir, ".configs/fix-headers.json"));
		writeFileSync(path.join(dir, ".configs/eslint.config.mjs"), "export default [];\n");
		writeFileSync(path.join(dir, ".configs/vitest.config.mjs"), `${read(dir, ".configs/vitest.config.mjs")}export const extra = 1;\n`);
		const result = run(dir, "check");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("problem  .configs/fix-headers.json: missing");
		expect(result.stdout).toContain("problem  .configs/eslint.config.mjs: no longer references");
		expect(result.stdout).toContain("ok       .configs/vitest.config.mjs");
	});

	it("reports missing or detached scripts as warnings, and fails on them only with --strict", () => {
		const dir = consumer();
		run(dir, "init");
		const manifest = JSON.parse(read(dir, "package.json"));
		manifest.scripts.lint = "eslint .";
		manifest["scripts"]["format:check"] = "prettier --config .configs/prettier.config.mjs --check src";
		delete manifest.scripts.coverage;
		writeFileSync(path.join(dir, "package.json"), JSON.stringify(manifest, null, "\t"));
		const lax = run(dir, "check");
		expect(lax.status, lax.stdout).toBe(0);
		expect(lax.stdout).toContain("warning  lint: does not reference .configs/eslint.config.mjs");
		expect(lax.stdout).toContain("warning  coverage: missing");
		expect(lax.stdout).toContain("ok       format:check");
		expect(run(dir, "check", "--strict").status).toBe(1);
	});

	it("prints a machine-readable summary with --json", () => {
		const dir = consumer();
		const summary = JSON.parse(run(dir, "check", "--json").stdout);
		expect(summary).toMatchObject({ command: "check", ok: false });
		expect(summary.problems).toBeGreaterThan(0);
		expect(summary.results[0]).toMatchObject({ area: "file", level: "problem" });
	});
});

describe("sync", () => {
	it("restores the managed block while keeping every byte below the closing marker", () => {
		const dir = consumer();
		run(dir, "init");
		const ignore = path.join(dir, ".prettierignore");
		const tail = "\nlocal-output/\n!tmp/keep-me/\n# a repo comment\t with a tab\n";
		writeFileSync(ignore, `${read(dir, ".prettierignore")}${tail}`.replace("node_modules/\n", "node_modules/\nextra-ignored/\n"));
		expect(run(dir, "check").status).toBe(1);
		const result = run(dir, "sync");
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toContain("updated  .prettierignore");
		const after = read(dir, ".prettierignore");
		expect(after).not.toContain("extra-ignored/");
		expect(after.endsWith(tail)).toBe(true);
		expect(after.startsWith(`# >>> @cldmv/configs prettierignore v${pkg.version} —`)).toBe(true);
		expect(run(dir, "check").status).toBe(0);
		const again = run(dir, "sync");
		expect(again.stdout).toContain("kept     .prettierignore");
	});

	it("keeps lines above the opening marker untouched too", () => {
		const dir = consumer();
		run(dir, "init");
		const ignore = path.join(dir, ".prettierignore");
		writeFileSync(ignore, `# header\nfirst/\n${read(dir, ".prettierignore")}`.replace("dist/\n", ""));
		run(dir, "sync");
		const after = read(dir, ".prettierignore");
		expect(after.startsWith("# header\nfirst/\n# >>> ")).toBe(true);
		expect(after).toContain("\ndist/\n");
	});

	it("refuses a .prettierignore without markers, with a diff and exit 1, and writes nothing", () => {
		const dir = consumer();
		writeFileSync(path.join(dir, ".prettierignore"), "node_modules/\nout/\n");
		const result = run(dir, "sync");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("refusing to sync");
		expect(result.stdout).toContain("--- .prettierignore");
		expect(result.stdout).toContain("- out/");
		expect(result.stdout).toContain("+ dist/");
		expect(result.stdout).toContain("  node_modules/");
		expect(read(dir, ".prettierignore")).toBe("node_modules/\nout/\n");
	});

	it("refuses malformed markers", () => {
		const dir = consumer();
		run(dir, "init");
		writeFileSync(path.join(dir, ".prettierignore"), read(dir, ".prettierignore").replace("# <<< @cldmv/configs prettierignore\n", ""));
		const result = run(dir, "sync");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("expected exactly one opening and one closing marker");
	});

	it("creates the file when it is missing, and honours --dry-run", () => {
		const dir = consumer();
		const dry = run(dir, "sync", "--dry-run");
		expect(dry.status).toBe(0);
		expect(existsSync(path.join(dir, ".prettierignore"))).toBe(false);
		expect(run(dir, "sync").status).toBe(0);
		expect(existsSync(path.join(dir, ".prettierignore"))).toBe(true);

		const text = read(dir, ".prettierignore");
		writeFileSync(path.join(dir, ".prettierignore"), text.replace("node_modules/\n", "node_modules/\nextra/\n"));
		const edited = read(dir, ".prettierignore");
		expect(run(dir, "sync", "--dry-run").stdout).toContain("would update");
		expect(read(dir, ".prettierignore")).toBe(edited);
	});

	it("never touches the stubs or package.json", () => {
		const dir = consumer();
		run(dir, "init");
		const before = Object.fromEntries(
			FILES.slice(0, 4)
				.concat("package.json")
				.map((file) => [file, read(dir, file)])
		);
		writeFileSync(path.join(dir, ".prettierignore"), read(dir, ".prettierignore").replace("dist/\n", ""));
		run(dir, "sync");
		for (const [file, content] of Object.entries(before)) expect(read(dir, file), file).toBe(content);
	});

	it("prints a machine-readable summary with --json", () => {
		const dir = consumer();
		const summary = JSON.parse(run(dir, "sync", "--json").stdout);
		expect(summary).toMatchObject({ command: "sync", ok: true });
		expect(summary.results[0]).toMatchObject({ level: "created" });
	});
});

/**
 * Writes a file, creating its folders.
 * @param {string} dir - Base directory.
 * @param {string} file - Path relative to the base.
 * @param {string} content - File content.
 * @returns {void}
 */
function put(dir, file, content) {
	mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
	writeFileSync(path.join(dir, file), content);
}

/**
 * Creates a workspace root with two packages under `packages/`.
 * @param {"pnpm" | "npm"} manager - Which workspace manifest to write.
 * @returns {string} The workspace root.
 */
function workspace(manager) {
	const dir = mkdtempSync(path.join(scratch, "ws-"));
	made.push(dir);
	if (manager === "pnpm") {
		put(dir, "pnpm-workspace.yaml", 'packages:\n  - "packages/*"\n  - "!packages/skipped"\n');
		put(dir, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
		put(dir, "package.json", '{\n\t"name": "root",\n\t"private": true\n}\n');
	} else {
		put(dir, "package.json", '{\n\t"name": "root",\n\t"private": true,\n\t"workspaces": ["packages/*"]\n}\n');
	}
	put(dir, "packages/a/package.json", '{\n\t"name": "@x/a",\n\t"version": "1.0.0"\n}\n');
	put(dir, "packages/b/package.json", '{\n\t"name": "b",\n\t"version": "1.0.0"\n}\n');
	put(dir, "packages/skipped/package.json", '{\n\t"name": "skipped"\n}\n');
	put(dir, "packages/a/node_modules/dep/package.json", '{\n\t"name": "dep"\n}\n');
	return dir;
}

/**
 * Adds @cldmv/configs to a package.json in a workspace.
 * @param {string} dir - Workspace root.
 * @param {string} file - package.json path relative to the root.
 * @returns {void}
 */
function addDependency(dir, file) {
	const manifest = JSON.parse(read(dir, file));
	manifest.devDependencies = { "@cldmv/configs": "^1.3.0" };
	writeFileSync(path.join(dir, file), `${JSON.stringify(manifest, null, "\t")}\n`);
}

describe("workspaces: pnpm", () => {
	it("init --workspaces --scripts prettier creates the stubs and prettier-named scripts in every package", () => {
		const dir = workspace("pnpm");
		const result = run(dir, "init", "--workspaces", "--scripts", "prettier");
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toContain("packages/a: created 5 file(s), added 7 script(s), kept 0");
		expect(result.stdout).toContain("packages/b: created 5 file(s), added 7 script(s), kept 0");
		expect(result.stdout).toContain("2 package(s)");
		for (const pkgDir of ["packages/a", "packages/b"]) {
			for (const file of FILES) expect(existsSync(path.join(dir, pkgDir, file)), `${pkgDir}/${file}`).toBe(true);
			const scripts = JSON.parse(read(dir, `${pkgDir}/package.json`)).scripts;
			expect(Object.keys(scripts)).toEqual(["prettier:write", "prettier:check", "lint", "lint:fix", "fix:headers", "test", "coverage"]);
			expect(scripts).not.toHaveProperty("format");
			expect(scripts).not.toHaveProperty("format:check");
		}
		expect(existsSync(path.join(dir, "packages/skipped/.configs"))).toBe(false);
		expect(existsSync(path.join(dir, "packages/a/node_modules/dep/.configs"))).toBe(false);
		expect(existsSync(path.join(dir, ".configs"))).toBe(false);
		expect(result.stdout).toContain("pnpm add -D @cldmv/configs@latest -r");
	});

	it("a second init --workspaces keeps everything, and --root adds the root", () => {
		const dir = workspace("pnpm");
		run(dir, "init", "--workspaces");
		const before = read(dir, "packages/a/package.json");
		const again = run(dir, "init", "--workspaces");
		expect(again.stdout).toContain("packages/a: created 0 file(s), added 0 script(s), kept 12");
		expect(read(dir, "packages/a/package.json")).toBe(before);
		const withRoot = run(dir, "init", "--workspaces", "--root");
		expect(withRoot.stdout).toContain(".: created 5 file(s)");
		expect(existsSync(path.join(dir, ".configs/eslint.config.mjs"))).toBe(true);
	});

	it("check --workspaces reports the missing per-package devDependency with the install command, and passes once it is added", () => {
		const dir = workspace("pnpm");
		run(dir, "init", "--workspaces", "--scripts", "prettier");
		addDependency(dir, "package.json");
		const failing = run(dir, "check", "--workspaces");
		expect(failing.status, failing.stdout).toBe(1);
		expect(failing.stdout).toContain("packages/a: FAIL (1 problem(s), 0 warning(s))");
		expect(failing.stdout).toContain("pnpm add -D @cldmv/configs@latest --filter @x/a");
		expect(failing.stdout).toContain("pnpm add -D @cldmv/configs@latest --filter b");
		expect(failing.stdout).toContain("pnpm does not hoist it into packages");
		expect(failing.stdout).toContain("2 package(s): 0 ok, 2 with problems");
		expect(failing.stdout).toContain("pnpm add -D @cldmv/configs@latest -r");

		addDependency(dir, "packages/a/package.json");
		expect(run(dir, "check", "--workspaces").status).toBe(1);
		addDependency(dir, "packages/b/package.json");
		const passing = run(dir, "check", "--workspaces");
		expect(passing.status, passing.stdout).toBe(0);
		expect(passing.stdout).toContain("packages/a: ok (0 problem(s), 0 warning(s))");
		expect(passing.stdout).toContain("2 package(s): 2 ok, 0 with problems");
	});

	it("--json with --workspaces nests the results per package", () => {
		const dir = workspace("pnpm");
		run(dir, "init", "--workspaces");
		const summary = JSON.parse(run(dir, "check", "--workspaces", "--json").stdout);
		expect(summary).toMatchObject({ command: "check", workspaces: true, ok: false, packages: expect.any(Array), failed: 2 });
		expect(summary.packages.map((entry) => entry.path)).toEqual(["packages/a", "packages/b"]);
		expect(summary.packages[0].results.some((result) => result.area === "dependency" && result.level === "problem")).toBe(true);
	});

	it("exits 1 when any package has a problem, and sync --workspaces refreshes each package's ignore block", () => {
		const dir = workspace("pnpm");
		run(dir, "init", "--workspaces");
		for (const name of ["a", "b"]) addDependency(dir, `packages/${name}/package.json`);
		writeFileSync(path.join(dir, "packages/b/.prettierignore"), read(dir, "packages/b/.prettierignore").replace("dist/\n", ""));
		const drift = run(dir, "check", "--workspaces");
		expect(drift.status).toBe(1);
		expect(drift.stdout).toContain("packages/a: ok");
		expect(drift.stdout).toContain("packages/b: FAIL");
		expect(run(dir, "sync", "--workspaces", "--dry-run").stdout).toContain("would update");
		expect(run(dir, "sync", "--workspaces").status).toBe(0);
		expect(run(dir, "check", "--workspaces").status).toBe(0);
	});

	it("hints about --workspaces in a workspace root and still runs on the root only", () => {
		const dir = workspace("pnpm");
		const result = run(dir, "check");
		expect(result.stderr).toContain("hint:");
		expect(result.stderr).toContain("--workspaces");
		expect(result.stdout).toContain("problem  .configs/fix-headers.json: missing");
		expect(existsSync(path.join(dir, "packages/a/.configs"))).toBe(false);
	});

	it("flags a pnpm package that lacks @cldmv/configs even in single-package mode", () => {
		const dir = consumer('{\n\t"name": "solo"\n}\n');
		writeFileSync(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
		run(dir, "init");
		const result = run(dir, "check");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("pnpm add -D @cldmv/configs@latest");
	});
});

describe("workspaces: npm", () => {
	it("accepts a root dependency, because npm hoists it", () => {
		const dir = workspace("npm");
		const init = run(dir, "init", "--workspaces");
		expect(init.status, init.stderr).toBe(0);
		expect(init.stdout).toContain("packages/skipped: created 5 file(s)");
		const failing = run(dir, "check", "--workspaces");
		expect(failing.status).toBe(1);
		expect(failing.stdout).toContain("npm install --save-dev @cldmv/configs@latest -w @x/a");
		addDependency(dir, "package.json");
		const passing = run(dir, "check", "--workspaces");
		expect(passing.status, passing.stdout).toBe(0);
	});

	it("reads the workspaces object form and recursive globs, skipping node_modules", () => {
		const dir = mkdtempSync(path.join(scratch, "ws-"));
		made.push(dir);
		put(dir, "package.json", '{\n\t"name": "root",\n\t"workspaces": { "packages": ["libs/**"] }\n}\n');
		put(dir, "libs/one/package.json", '{\n\t"name": "one"\n}\n');
		put(dir, "libs/group/two/package.json", '{\n\t"name": "two"\n}\n');
		put(dir, "libs/one/node_modules/x/package.json", '{\n\t"name": "x"\n}\n');
		const summary = JSON.parse(run(dir, "check", "--workspaces", "--json").stdout);
		expect(summary.packages.map((entry) => entry.path)).toEqual(["libs/group/two", "libs/one"]);
	});
});

describe("workspace and option errors", () => {
	it("exits 2 for --workspaces outside a workspace, --root alone and bad option values", () => {
		const dir = consumer();
		expect(run(dir, "check", "--workspaces").status).toBe(2);
		expect(run(dir, "check", "--root").status).toBe(2);
		expect(run(dir, "init", "--scripts", "bogus").status).toBe(2);
		expect(run(dir, "check", "--scripts", "prettier").status).toBe(2);
		expect(run(dir, "init", "--ignore-file").status).toBe(2);
		expect(run(dir, "init", "--ignore-file", "../outside").status).toBe(2);
	});

	it("documents the new options in every command's help", () => {
		for (const command of ["init", "check", "sync"]) {
			const help = run(consumer(), command, "--help").stdout;
			expect(help).toContain("--workspaces");
			expect(help).toContain("--ignore-file");
		}
		expect(run(consumer(), "init", "--help").stdout).toContain("--scripts");
	});
});

describe("--ignore-file", () => {
	const nested = ".configs/.prettierignore";

	it("round-trips through init, check and sync, and the Prettier scripts pass --ignore-path", () => {
		const dir = consumer();
		const init = run(dir, "init", "--ignore-file", nested);
		expect(init.status, init.stderr).toBe(0);
		expect(existsSync(path.join(dir, nested))).toBe(true);
		expect(existsSync(path.join(dir, ".prettierignore"))).toBe(false);
		const scripts = JSON.parse(read(dir, "package.json")).scripts;
		expect(scripts.format).toBe(
			`prettier --config .configs/prettier.config.mjs --ignore-path .gitignore --ignore-path ${nested} --write .`
		);
		expect(scripts["format:check"]).toBe(
			`prettier --config .configs/prettier.config.mjs --ignore-path .gitignore --ignore-path ${nested} --check .`
		);

		expect(run(dir, "check", "--ignore-file", nested).status).toBe(0);
		expect(run(dir, "check").status).toBe(1);

		const tail = "\nlocal/\n!tmp/keep/\n";
		writeFileSync(path.join(dir, nested), `${read(dir, nested).replace("dist/\n", "")}${tail}`);
		expect(run(dir, "check", "--ignore-file", nested).status).toBe(1);
		const sync = run(dir, "sync", "--ignore-file", nested);
		expect(sync.status, sync.stdout).toBe(0);
		expect(read(dir, nested).endsWith(tail)).toBe(true);
		expect(run(dir, "check", "--ignore-file", nested).status).toBe(0);
	});

	it("keeps the default scripts free of --ignore-path", () => {
		const dir = consumer();
		run(dir, "init");
		expect(JSON.parse(read(dir, "package.json")).scripts.format).toBe("prettier --config .configs/prettier.config.mjs --write .");
	});

	it("applies to every package with --workspaces", () => {
		const dir = workspace("pnpm");
		run(dir, "init", "--workspaces", "--ignore-file", nested);
		expect(existsSync(path.join(dir, "packages/a", nested))).toBe(true);
		expect(existsSync(path.join(dir, "packages/b", nested))).toBe(true);
	});
});

describe("script aliases", () => {
	it("check accepts format:check and prettier:check as equivalent", () => {
		const dir = workspace("npm");
		addDependency(dir, "package.json");
		run(dir, "init", "--workspaces");
		const manifest = JSON.parse(read(dir, "packages/b/package.json"));
		manifest.scripts = Object.fromEntries(
			Object.entries(manifest.scripts).map(([name, value]) => [
				name === "format" ? "prettier:write" : name === "format:check" ? "prettier:check" : name,
				value
			])
		);
		writeFileSync(path.join(dir, "packages/b/package.json"), `${JSON.stringify(manifest, null, "\t")}\n`);
		const result = run(dir, "check", "--workspaces", "--strict");
		expect(result.status, result.stdout).toBe(0);
		expect(result.stdout).toContain("packages/a: ok (0 problem(s), 0 warning(s))");
		expect(result.stdout).toContain("packages/b: ok (0 problem(s), 0 warning(s))");
	});

	it("init never adds the other convention's names when one is present", () => {
		const dir = consumer(
			'{\n\t"name": "x",\n\t"scripts": {\n\t\t"prettier:write": "prettier --write .",\n\t\t"format:check": "prettier --check ."\n\t}\n}\n'
		);
		const result = run(dir, "init", "--scripts", "prettier");
		expect(result.status).toBe(0);
		const scripts = JSON.parse(read(dir, "package.json")).scripts;
		expect(scripts).not.toHaveProperty("format");
		expect(scripts).not.toHaveProperty("prettier:check");
		expect(scripts["prettier:write"]).toBe("prettier --write .");
		expect(result.stdout).toContain("kept     prettier:write: already defined");
		expect(result.stdout).toContain("kept     format:check: already defined");
	});

	it("check warns about a detached alias the same way as the fleet name", () => {
		const dir = consumer(
			'{\n\t"name": "x",\n\t"devDependencies": { "@cldmv/configs": "^1.3.0" },\n\t"scripts": {\n\t\t"prettier:write": "prettier --write ."\n\t}\n}\n'
		);
		run(dir, "init");
		const result = run(dir, "check");
		expect(result.stdout).toContain("warning  prettier:write: does not reference .configs/prettier.config.mjs");
	});
});
