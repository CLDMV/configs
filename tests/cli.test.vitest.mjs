/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /tests/cli.test.vitest.mjs
 *	@Date: 2026-10-11T12:46:39-07:00 (1791747999)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T12:46:58-07:00 (1791748018)
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
function consumer(manifest = '{\n\t"name": "consumer",\n\t"version": "1.0.0"\n}\n') {
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
