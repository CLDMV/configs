#!/usr/bin/env node
/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /bin/cldmv-configs.mjs
 *	@Date: 2026-10-11T12:45:33-07:00 (1791747933)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T12:45:43-07:00 (1791747943)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview cldmv-configs: adopt the shared @cldmv/configs files in a repository (`init`), report drift (`check`) and refresh the
 * managed region of `.prettierignore` (`sync`). Plain ESM, Node built-ins only.
 *
 * Exit codes: 0 ok, 1 drift or problems found, 2 usage or I/O error.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shippedPackage = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const shippedIgnore = readFileSync(path.join(packageRoot, "prettierignore"), "utf8");

const OPEN_PREFIX = "# >>> @cldmv/configs prettierignore";
const OPEN_PATTERN = /^# >>> @cldmv\/configs prettierignore(?: v(\S+))?(.*)$/;
const CLOSE_LINE = "# <<< @cldmv/configs prettierignore";

/** The stub files `init` creates and `check` verifies: path, content and the specifier the stub must still reference. */
const STUBS = [
	{
		file: ".configs/fix-headers.json",
		content: '{\n\t"extends": "@cldmv/configs/fix-headers.json"\n}\n',
		reference: /["'][^"']*configs\/(?:[^"'/]+\/)*fix-headers\.json["']/
	},
	{
		file: ".configs/prettier.config.mjs",
		content: 'import base from "@cldmv/configs/prettier.json" with { type: "json" };\n\nexport default base;\n',
		reference: /@cldmv\/configs\/prettier\.json/
	},
	{
		file: ".configs/eslint.config.mjs",
		content: 'import base from "@cldmv/configs/eslint.config.mjs";\n\nexport default [...base];\n',
		reference: /@cldmv\/configs\/eslint\.config\.mjs/
	},
	{
		file: ".configs/vitest.config.mjs",
		content:
			'import { defineConfig, mergeConfig } from "vitest/config";\nimport base from "@cldmv/configs/vitest.config.mjs";\n\n' +
			"// Adjust coverage.include to this repository's source folders.\n" +
			'export default mergeConfig(base, defineConfig({ test: { coverage: { include: ["src/**"] } } }));\n',
		reference: /@cldmv\/configs\/vitest\.config\.mjs/
	}
];

/** The standard npm scripts: name, command, and the stub file the command must reference. */
const SCRIPTS = [
	{ name: "format", command: "prettier --config .configs/prettier.config.mjs --write .", stub: ".configs/prettier.config.mjs" },
	{ name: "format:check", command: "prettier --config .configs/prettier.config.mjs --check .", stub: ".configs/prettier.config.mjs" },
	{ name: "lint", command: "eslint --config .configs/eslint.config.mjs .", stub: ".configs/eslint.config.mjs" },
	{ name: "lint:fix", command: "eslint --config .configs/eslint.config.mjs . --fix", stub: ".configs/eslint.config.mjs" },
	{ name: "fix:headers", command: "fix-headers --config .configs/fix-headers.json", stub: ".configs/fix-headers.json" },
	{ name: "test", command: "vitest run --config .configs/vitest.config.mjs", stub: ".configs/vitest.config.mjs" },
	{ name: "coverage", command: "vitest run --coverage --config .configs/vitest.config.mjs", stub: ".configs/vitest.config.mjs" }
];

const HELP = {
	main: `cldmv-configs ${shippedPackage.version}: adopt the shared @cldmv/configs files and detect drift.

Usage: cldmv-configs <command> [options]

Commands:
  init     Create the missing .configs/ stubs, .prettierignore and standard npm scripts (never overwrites)
  check    Report drift from the shared configs without writing anything
  sync     Refresh the managed block of .prettierignore from the shipped file

Options:
  -h, --help   Show help (also after a command: cldmv-configs init --help)
  --json       Print a machine-readable summary instead of plain lines

Exit codes: 0 ok, 1 drift or problems found, 2 usage or I/O error.
Run from the root of the repository to configure.`,
	init: `Usage: cldmv-configs init [--dry-run] [--json]

Creates, only when missing, in the current directory:
  .configs/fix-headers.json  .configs/prettier.config.mjs  .configs/eslint.config.mjs  .configs/vitest.config.mjs  .prettierignore
and adds to package.json scripts, never changing an existing key:
  format  format:check  lint  lint:fix  fix:headers  test  coverage

Options:
  --dry-run   Print what would change and write nothing
  --json      Print a machine-readable summary`,
	check: `Usage: cldmv-configs check [--strict] [--json]

Reports, without writing:
  - each .configs/ stub exists and still references the @cldmv/configs base (problem if not)
  - the .prettierignore managed block is present and matches the shipped block (problem if not)
  - each standard npm script exists and references its .configs/ stub (warning if not)

Options:
  --strict   Exit 1 on warnings too
  --json     Print a machine-readable summary

Exit 1 when a problem is found (or a warning with --strict).`,
	sync: `Usage: cldmv-configs sync [--dry-run] [--json]

Rewrites only the managed block of .prettierignore (between the "# >>> @cldmv/configs prettierignore" and
"# <<< @cldmv/configs prettierignore" lines) from the shipped file; everything outside the markers is left byte-for-byte.
Creates .prettierignore when it is missing. Refuses (exit 1, with a diff) when the file has no markers.

Options:
  --dry-run   Print what would change and write nothing
  --json      Print a machine-readable summary`
};

/** Raised for bad usage or an unusable working directory; the CLI exits 2. */
class UsageError extends Error {}

/**
 * Splits argv into a command and flags.
 * @param {string[]} argv - Arguments after the script name.
 * @returns {{ command: string | undefined, flags: Set<string> }} The parsed command line.
 */
function parseArgs(argv) {
	const flags = new Set();
	let command;
	for (const arg of argv) {
		if (arg.startsWith("-")) flags.add(arg === "-h" ? "--help" : arg);
		else if (command === undefined) command = arg;
		else throw new UsageError(`unexpected argument "${arg}"`);
	}
	return { command, flags };
}

/**
 * Locates the managed block in a list of lines.
 * @param {string[]} lines - File lines (a trailing `\r` is tolerated).
 * @returns {{ state: "ok", open: number, close: number, version: string | null } | { state: "none" | "malformed", reason: string }} The block position or why there is none.
 */
function findBlock(lines) {
	const trimmed = lines.map((line) => line.trimEnd());
	const opens = trimmed.flatMap((line, index) => (OPEN_PATTERN.test(line) ? [index] : []));
	const closes = trimmed.flatMap((line, index) => (line === CLOSE_LINE ? [index] : []));
	if (opens.length === 0 && closes.length === 0) return { state: "none", reason: "no managed block markers found" };
	if (opens.length !== 1 || closes.length !== 1)
		return { state: "malformed", reason: "expected exactly one opening and one closing marker" };
	if (closes[0] < opens[0]) return { state: "malformed", reason: "the closing marker comes before the opening marker" };
	const version = trimmed[opens[0]].match(OPEN_PATTERN)?.[1] ?? null;
	return { state: "ok", open: opens[0], close: closes[0], version };
}

/**
 * The block's lines with trailing whitespace removed and the opening marker's version taken out, for comparison.
 * @param {string[]} lines - File lines.
 * @param {{ open: number, close: number }} block - Block position.
 * @returns {string[]} Normalized block lines.
 */
function blockText(lines, block) {
	return lines.slice(block.open, block.close + 1).map((line, index) => {
		const text = line.trimEnd();
		return index === 0 ? OPEN_PREFIX + (text.match(OPEN_PATTERN)?.[2] ?? "") : text;
	});
}

/** The shipped file's lines, its block position and normalized block text. */
const shippedLines = shippedIgnore.split("\n");
const shippedBlock = /** @type {{ state: "ok", open: number, close: number, version: string | null }} */ (findBlock(shippedLines));
if (shippedBlock.state !== "ok") throw new Error("the shipped prettierignore has no managed block");
const shippedText = blockText(shippedLines, shippedBlock);

/**
 * The shipped block as it is written into a file: the opening marker carries the package version.
 * @returns {string[]} Block lines.
 */
function versionedBlock() {
	return shippedText.map((line, index) => (index === 0 ? line.replace(OPEN_PREFIX, `${OPEN_PREFIX} v${shippedPackage.version}`) : line));
}

/**
 * Line diff of two arrays by longest common subsequence.
 * @param {string[]} before - Lines of the file.
 * @param {string[]} after - Lines of the shipped block.
 * @returns {string[]} Diff lines prefixed with "- ", "+ " or "  ".
 */
function diffLines(before, after) {
	const table = Array.from({ length: before.length + 1 }, () => new Array(after.length + 1).fill(0));
	for (let i = before.length - 1; i >= 0; i -= 1) {
		for (let j = after.length - 1; j >= 0; j -= 1) {
			table[i][j] = before[i] === after[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
		}
	}
	const out = [];
	let i = 0;
	let j = 0;
	while (i < before.length && j < after.length) {
		if (before[i] === after[j]) {
			out.push(`  ${before[i]}`);
			i += 1;
			j += 1;
		} else if (table[i + 1][j] >= table[i][j + 1]) {
			out.push(`- ${before[i]}`);
			i += 1;
		} else {
			out.push(`+ ${after[j]}`);
			j += 1;
		}
	}
	for (; i < before.length; i += 1) out.push(`- ${before[i]}`);
	for (; j < after.length; j += 1) out.push(`+ ${after[j]}`);
	return out;
}

/**
 * Reads and parses the consumer's package.json, remembering its indentation.
 * @param {string} cwd - Consumer repository root.
 * @returns {{ file: string, data: Record<string, any>, indent: string }} The manifest.
 */
function readManifest(cwd) {
	const file = path.join(cwd, "package.json");
	if (!existsSync(file)) throw new UsageError("no package.json in the current directory; run from the root of the repository");
	const text = readFileSync(file, "utf8");
	let data;
	try {
		data = JSON.parse(text);
	} catch (error) {
		throw new UsageError(`package.json is not valid JSON: ${/** @type {Error} */ (error).message}`);
	}
	const indent = text.match(/^([ \t]+)"/m)?.[1] ?? "\t";
	return { file, data, indent };
}

/**
 * @typedef {{ area: string, name: string, level: string, message: string }} Result
 */

/**
 * Creates the missing stubs, `.prettierignore` and standard scripts.
 * @param {string} cwd - Consumer repository root.
 * @param {boolean} dryRun - Write nothing when true.
 * @returns {{ results: Result[], ok: boolean }} What was created, added or kept.
 */
function init(cwd, dryRun) {
	const manifest = readManifest(cwd);
	/** @type {Result[]} */
	const results = [];
	const create = (relative, content) => {
		const target = path.join(cwd, relative);
		if (existsSync(target)) return false;
		if (!dryRun) {
			mkdirSync(path.dirname(target), { recursive: true });
			writeFileSync(target, content);
		}
		return true;
	};
	for (const stub of STUBS) {
		const made = create(stub.file, stub.content);
		results.push({ area: "file", name: stub.file, level: made ? "created" : "kept", message: made ? "created" : "already exists" });
	}
	const freshIgnore = [...shippedLines].map((line, index) => (index === shippedBlock.open ? versionedBlock()[0] : line)).join("\n");
	const ignorePath = path.join(cwd, ".prettierignore");
	const hadIgnore = existsSync(ignorePath);
	const madeIgnore = create(".prettierignore", freshIgnore);
	const ignoreBlock = hadIgnore ? findBlock(readFileSync(ignorePath, "utf8").split("\n")) : null;
	const note =
		ignoreBlock && ignoreBlock.state !== "ok"
			? "already exists without a managed block; add the markers, then run `cldmv-configs sync`"
			: "already exists";
	results.push({ area: "file", name: ".prettierignore", level: madeIgnore ? "created" : "kept", message: madeIgnore ? "created" : note });
	manifest.data.scripts ??= {};
	let changed = false;
	for (const script of SCRIPTS) {
		if (Object.hasOwn(manifest.data.scripts, script.name)) {
			results.push({ area: "script", name: script.name, level: "kept", message: "already defined" });
		} else {
			manifest.data.scripts[script.name] = script.command;
			changed = true;
			results.push({ area: "script", name: script.name, level: "added", message: script.command });
		}
	}
	if (changed && !dryRun) writeFileSync(manifest.file, `${JSON.stringify(manifest.data, null, manifest.indent)}\n`);
	return { results, ok: true };
}

/**
 * Reports drift from the shared configs without writing.
 * @param {string} cwd - Consumer repository root.
 * @returns {{ results: Result[], ok: boolean }} One result per check; `ok` is false when a problem was found.
 */
function check(cwd) {
	const manifest = readManifest(cwd);
	/** @type {Result[]} */
	const results = [];
	for (const stub of STUBS) {
		const target = path.join(cwd, stub.file);
		if (!existsSync(target))
			results.push({ area: "file", name: stub.file, level: "problem", message: "missing; run `cldmv-configs init`" });
		else if (!stub.reference.test(readFileSync(target, "utf8"))) {
			results.push({ area: "file", name: stub.file, level: "problem", message: "no longer references the @cldmv/configs base" });
		} else results.push({ area: "file", name: stub.file, level: "ok", message: "references the @cldmv/configs base" });
	}
	const ignorePath = path.join(cwd, ".prettierignore");
	if (!existsSync(ignorePath)) {
		results.push({ area: "ignore", name: ".prettierignore", level: "problem", message: "missing; run `cldmv-configs init`" });
	} else {
		const lines = readFileSync(ignorePath, "utf8").split("\n");
		const block = findBlock(lines);
		if (block.state !== "ok") {
			results.push({
				area: "ignore",
				name: ".prettierignore",
				level: "problem",
				message: `managed block is absent (${block.reason}), package ships v${shippedPackage.version}; see \`cldmv-configs sync --help\``
			});
		} else if (blockText(lines, block).join("\n") !== shippedText.join("\n")) {
			results.push({
				area: "ignore",
				name: ".prettierignore",
				level: "problem",
				message:
					block.version === shippedPackage.version
						? `managed block was edited (marker says v${block.version}); run \`cldmv-configs sync\``
						: `managed block is from v${block.version ?? "unknown"} or edited, package ships v${shippedPackage.version}; run \`cldmv-configs sync\``
			});
		} else if (block.version !== shippedPackage.version) {
			results.push({
				area: "ignore",
				name: ".prettierignore",
				level: "ok",
				message: `managed block matches the shipped text (marker says v${block.version ?? "unknown"}, package is v${shippedPackage.version})`
			});
		} else
			results.push({ area: "ignore", name: ".prettierignore", level: "ok", message: `managed block matches v${shippedPackage.version}` });
	}
	const scripts = manifest.data.scripts ?? {};
	for (const script of SCRIPTS) {
		const value = scripts[script.name];
		if (typeof value !== "string")
			results.push({ area: "script", name: script.name, level: "warning", message: "missing; run `cldmv-configs init`" });
		else if (!value.includes(script.stub))
			results.push({ area: "script", name: script.name, level: "warning", message: `does not reference ${script.stub}` });
		else results.push({ area: "script", name: script.name, level: "ok", message: `references ${script.stub}` });
	}
	return { results, ok: !results.some((result) => result.level === "problem") };
}

/**
 * Rewrites the managed block of `.prettierignore` from the shipped file.
 * @param {string} cwd - Consumer repository root.
 * @param {boolean} dryRun - Write nothing when true.
 * @returns {{ results: Result[], ok: boolean, diff?: string[] }} The outcome; `ok` is false when the file has no usable markers.
 */
function sync(cwd, dryRun) {
	const target = path.join(cwd, ".prettierignore");
	const name = ".prettierignore";
	if (!existsSync(target)) {
		const fresh = shippedLines.map((line, index) => (index === shippedBlock.open ? versionedBlock()[0] : line)).join("\n");
		if (!dryRun) writeFileSync(target, fresh);
		return { results: [{ area: "ignore", name, level: "created", message: `created from v${shippedPackage.version}` }], ok: true };
	}
	const text = readFileSync(target, "utf8");
	const lines = text.split("\n");
	const block = findBlock(lines);
	if (block.state !== "ok") {
		const fileLines = lines.map((line) => line.trimEnd());
		while (fileLines.at(-1) === "") fileLines.pop();
		return {
			results: [
				{
					area: "ignore",
					name,
					level: "problem",
					message: `refusing to sync: ${block.reason}. Add the markers around the shared lines (or rename the file and run \`cldmv-configs init\`), then sync again`
				}
			],
			ok: false,
			diff: diffLines(fileLines, shippedText)
		};
	}
	const eol = text.includes("\r\n") ? "\r" : "";
	const next = [...lines.slice(0, block.open), ...versionedBlock().map((line) => line + eol), ...lines.slice(block.close + 1)].join("\n");
	if (next === text)
		return {
			results: [{ area: "ignore", name, level: "kept", message: `managed block already matches v${shippedPackage.version}` }],
			ok: true
		};
	if (!dryRun) writeFileSync(target, next);
	return {
		results: [
			{
				area: "ignore",
				name,
				level: "updated",
				message:
					block.version === shippedPackage.version
						? `managed block restored to the shipped v${shippedPackage.version} text`
						: `managed block rewritten from ${block.version ? `v${block.version}` : "an unversioned block"} to v${shippedPackage.version}`
			}
		],
		ok: true
	};
}

/**
 * Entry point.
 * @param {string[]} argv - Arguments after the script name.
 * @returns {number} The exit code.
 */
function main(argv) {
	let json = false;
	try {
		const { command, flags } = parseArgs(argv);
		json = flags.has("--json");
		if (command === undefined || command === "help") {
			if (command === undefined && !flags.has("--help") && flags.size > 0) throw new UsageError(`unknown option ${[...flags][0]}`);
			console.log(HELP.main);
			return command === undefined && !flags.has("--help") ? 2 : 0;
		}
		if (!Object.hasOwn(HELP, command) || command === "main") throw new UsageError(`unknown command "${command}"`);
		if (flags.has("--help")) {
			console.log(HELP[command]);
			return 0;
		}
		const allowed = new Set(["--json", "--help", ...(command === "check" ? ["--strict"] : ["--dry-run"])]);
		for (const flag of flags) if (!allowed.has(flag)) throw new UsageError(`unknown option ${flag} for "${command}"`);
		const dryRun = flags.has("--dry-run");
		const cwd = process.cwd();
		const outcome = command === "init" ? init(cwd, dryRun) : command === "check" ? check(cwd) : sync(cwd, dryRun);
		const warnings = outcome.results.filter((result) => result.level === "warning").length;
		const problems = outcome.results.filter((result) => result.level === "problem").length;
		const failed = !outcome.ok || (flags.has("--strict") && warnings > 0);
		if (json) {
			console.log(
				JSON.stringify({ command, ok: !failed, dryRun, problems, warnings, results: outcome.results, diff: outcome.diff }, null, 2)
			);
		} else {
			const verb = { created: "create", added: "add", updated: "update" };
			for (const result of outcome.results) {
				const label = dryRun && verb[result.level] ? `would ${verb[result.level]}` : result.level;
				console.log(`${label.padEnd(8)} ${result.name}: ${result.message}`);
			}
			if (outcome.diff) {
				console.log("--- .prettierignore\n+++ shipped managed block");
				for (const line of outcome.diff) console.log(line);
			}
			if (command === "check") console.log(`${problems} problem(s), ${warnings} warning(s)`);
		}
		return failed ? 1 : 0;
	} catch (error) {
		const message = error instanceof UsageError ? error.message : `${/** @type {Error} */ (error).message}`;
		if (json) console.log(JSON.stringify({ ok: false, error: message }));
		else console.error(`cldmv-configs: ${message}\nRun "cldmv-configs --help" for usage.`);
		return 2;
	}
}

process.exitCode = main(process.argv.slice(2));
