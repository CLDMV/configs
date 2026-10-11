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
 *	@Last modified time: 2026-10-11T13:10:36-07:00 (1791749436)
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
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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

/**
 * The standard npm scripts. `names` maps each naming convention to the script name `init` adds; `aliases` lists every name `check` accepts.
 * `fleet` uses `format` and `format:check`, `prettier` uses `prettier:write` and `prettier:check`.
 */
const SCRIPTS = [
	{
		key: "format",
		names: { fleet: "format", prettier: "prettier:write" },
		aliases: ["format", "prettier:write"],
		command: (ignoreFlags) => `prettier --config .configs/prettier.config.mjs${ignoreFlags} --write .`,
		stub: ".configs/prettier.config.mjs"
	},
	{
		key: "format:check",
		names: { fleet: "format:check", prettier: "prettier:check" },
		aliases: ["format:check", "prettier:check"],
		command: (ignoreFlags) => `prettier --config .configs/prettier.config.mjs${ignoreFlags} --check .`,
		stub: ".configs/prettier.config.mjs"
	},
	{
		key: "lint",
		names: { fleet: "lint", prettier: "lint" },
		aliases: ["lint"],
		command: () => "eslint --config .configs/eslint.config.mjs .",
		stub: ".configs/eslint.config.mjs"
	},
	{
		key: "lint:fix",
		names: { fleet: "lint:fix", prettier: "lint:fix" },
		aliases: ["lint:fix"],
		command: () => "eslint --config .configs/eslint.config.mjs . --fix",
		stub: ".configs/eslint.config.mjs"
	},
	{
		key: "fix:headers",
		names: { fleet: "fix:headers", prettier: "fix:headers" },
		aliases: ["fix:headers"],
		command: () => "fix-headers --config .configs/fix-headers.json",
		stub: ".configs/fix-headers.json"
	},
	{
		key: "test",
		names: { fleet: "test", prettier: "test" },
		aliases: ["test"],
		command: () => "vitest run --config .configs/vitest.config.mjs",
		stub: ".configs/vitest.config.mjs"
	},
	{
		key: "coverage",
		names: { fleet: "coverage", prettier: "coverage" },
		aliases: ["coverage"],
		command: () => "vitest run --coverage --config .configs/vitest.config.mjs",
		stub: ".configs/vitest.config.mjs"
	}
];

const DEFAULT_IGNORE_FILE = ".prettierignore";
const SHARED_OPTIONS =
	"  --workspaces        Run in every workspace package (pnpm-workspace.yaml `packages:` or package.json `workspaces`)\n  --root              With --workspaces, also run in the workspace root\n  --ignore-file <p>   Path of the managed Prettier ignore file (default .prettierignore, e.g. .configs/.prettierignore)\n  --json              Print a machine-readable summary (nested per package with --workspaces)";

const HELP = {
	main: `cldmv-configs ${shippedPackage.version}: adopt the shared @cldmv/configs files and detect drift.

Usage: cldmv-configs <command> [options]

Commands:
  init     Create the missing .configs/ stubs, the Prettier ignore file and standard npm scripts (never overwrites)
  check    Report drift from the shared configs without writing anything
  sync     Refresh the managed block of the Prettier ignore file from the shipped file

Options:
  -h, --help   Show help (also after a command: cldmv-configs init --help)
  --workspaces Run the command in every workspace package instead of only the current directory

Exit codes: 0 ok, 1 drift or problems found, 2 usage or I/O error.
Run from the root of the repository (or of the workspace) to configure.`,
	init: `Usage: cldmv-configs init [--dry-run] [--scripts fleet|prettier] [--workspaces [--root]] [--ignore-file <path>] [--json]

Creates, only when missing, in the current directory (or in every workspace package with --workspaces):
  .configs/fix-headers.json  .configs/prettier.config.mjs  .configs/eslint.config.mjs  .configs/vitest.config.mjs  and the Prettier ignore file
and adds to package.json scripts, never changing an existing key:
  format  format:check  lint  lint:fix  fix:headers  test  coverage
With --scripts prettier the Prettier scripts are named prettier:write and prettier:check instead of format and format:check.
A script is never added when either name of its pair already exists. With a non-default --ignore-file the Prettier scripts pass
--ignore-path .gitignore --ignore-path <path>.

Options:
  --dry-run           Print what would change and write nothing
  --scripts <name>    Script naming convention: fleet (default) or prettier
${SHARED_OPTIONS}`,
	check: `Usage: cldmv-configs check [--strict] [--workspaces [--root]] [--ignore-file <path>] [--json]

Reports, without writing:
  - each .configs/ stub exists and still references the @cldmv/configs base (problem if not)
  - the Prettier ignore file's managed block is present and matches the shipped block (problem if not)
  - @cldmv/configs is a dependency where a stub imports it (problem if not; under pnpm it must be in the package itself)
  - each standard npm script exists and references its .configs/ stub (warning if not); format = prettier:write and
    format:check = prettier:check are accepted as equivalent

Options:
  --strict            Exit 1 on warnings too
${SHARED_OPTIONS}

Exit 1 when a problem is found (or a warning with --strict).`,
	sync: `Usage: cldmv-configs sync [--dry-run] [--workspaces [--root]] [--ignore-file <path>] [--json]

Rewrites only the managed block of the Prettier ignore file (between the "# >>> @cldmv/configs prettierignore" and
"# <<< @cldmv/configs prettierignore" lines) from the shipped file; everything outside the markers is left byte-for-byte.
Creates the file when it is missing. Refuses (exit 1, with a diff) when the file has no markers.

Options:
  --dry-run           Print what would change and write nothing
${SHARED_OPTIONS}`
};

/** Raised for bad usage or an unusable working directory; the CLI exits 2. */
class UsageError extends Error {}

const VALUE_OPTIONS = new Set(["--ignore-file", "--scripts"]);

/**
 * Splits argv into a command, boolean flags and `--name value` options.
 * @param {string[]} argv - Arguments after the script name.
 * @returns {{ command: string | undefined, flags: Set<string>, values: Record<string, string> }} The parsed command line.
 */
function parseArgs(argv) {
	const flags = new Set();
	const values = {};
	let command;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const [name, inline] = arg.startsWith("--")
			? [arg.slice(0, arg.includes("=") ? arg.indexOf("=") : undefined), arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : undefined]
			: [arg, undefined];
		if (VALUE_OPTIONS.has(name)) {
			const value = inline ?? argv[(index += 1)];
			if (value === undefined || value.startsWith("-")) throw new UsageError(`${name} needs a value`);
			values[name] = value;
		} else if (arg.startsWith("-")) flags.add(arg === "-h" ? "--help" : arg);
		else if (command === undefined) command = arg;
		else throw new UsageError(`unexpected argument "${arg}"`);
	}
	return { command, flags, values };
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
 * @typedef {{ dryRun: boolean, scripts: "fleet" | "prettier", ignoreFile: string, workspaceRoot: string, label: string }} Env
 */

/** The `--ignore-path` flags the Prettier scripts need when the ignore file is not the default one. */
const ignoreFlagsFor = (ignoreFile) => (ignoreFile === DEFAULT_IGNORE_FILE ? "" : ` --ignore-path .gitignore --ignore-path ${ignoreFile}`);

/**
 * Whether the package manager is pnpm for this package (a pnpm lockfile or workspace file at the workspace root or in the package).
 * @param {string} dir - Package directory.
 * @param {Env} env - Run settings.
 * @returns {boolean} True under pnpm.
 */
const usesPnpm = (dir, env) =>
	[env.workspaceRoot, dir].some(
		(where) => existsSync(path.join(where, "pnpm-lock.yaml")) || existsSync(path.join(where, "pnpm-workspace.yaml"))
	);

/**
 * The command that installs @cldmv/configs for a package.
 * @param {string} dir - Package directory.
 * @param {Env} env - Run settings.
 * @param {Record<string, any>} data - The package's package.json.
 * @returns {string} A shell command.
 */
function installCommand(dir, env, data) {
	const inWorkspace = path.resolve(dir) !== path.resolve(env.workspaceRoot);
	const name = data.name ?? env.label;
	if (usesPnpm(dir, env)) {
		if (inWorkspace) return `pnpm add -D @cldmv/configs@latest --filter ${name}`;
		return `pnpm add -D @cldmv/configs@latest${existsSync(path.join(dir, "pnpm-workspace.yaml")) ? " -w" : ""}`;
	}
	return `npm install --save-dev @cldmv/configs@latest${inWorkspace ? ` -w ${name}` : ""}`;
}

/**
 * Whether a package.json lists @cldmv/configs as a dependency.
 * @param {Record<string, any>} data - Parsed package.json.
 * @returns {boolean} True when listed.
 */
const hasConfigsDependency = (data) => Boolean(data.devDependencies?.["@cldmv/configs"] ?? data.dependencies?.["@cldmv/configs"]);

/**
 * Reads the workspace root's package.json when there is one.
 * @param {Env} env - Run settings.
 * @returns {Record<string, any>} The parsed manifest or an empty object.
 */
function readRootManifest(env) {
	try {
		return JSON.parse(readFileSync(path.join(env.workspaceRoot, "package.json"), "utf8"));
	} catch {
		return {};
	}
}

/**
 * Creates the missing stubs, ignore file and standard scripts.
 * @param {string} dir - Package directory.
 * @param {Env} env - Run settings.
 * @returns {{ results: Result[], ok: boolean }} What was created, added or kept.
 */
function init(dir, env) {
	const manifest = readManifest(dir);
	/** @type {Result[]} */
	const results = [];
	const create = (relative, content) => {
		const target = path.join(dir, relative);
		if (existsSync(target)) return false;
		if (!env.dryRun) {
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
	const ignorePath = path.join(dir, env.ignoreFile);
	const hadIgnore = existsSync(ignorePath);
	const madeIgnore = create(env.ignoreFile, freshIgnore);
	const ignoreBlock = hadIgnore ? findBlock(readFileSync(ignorePath, "utf8").split("\n")) : null;
	const note =
		ignoreBlock && ignoreBlock.state !== "ok"
			? "already exists without a managed block; add the markers, then run `cldmv-configs sync`"
			: "already exists";
	results.push({ area: "file", name: env.ignoreFile, level: madeIgnore ? "created" : "kept", message: madeIgnore ? "created" : note });
	manifest.data.scripts ??= {};
	let changed = false;
	for (const script of SCRIPTS) {
		const existing = script.aliases.find((alias) => Object.hasOwn(manifest.data.scripts, alias));
		if (existing) {
			results.push({ area: "script", name: existing, level: "kept", message: "already defined" });
		} else {
			const name = script.names[env.scripts];
			const command = script.command(ignoreFlagsFor(env.ignoreFile));
			manifest.data.scripts[name] = command;
			changed = true;
			results.push({ area: "script", name, level: "added", message: command });
		}
	}
	if (changed && !env.dryRun) writeFileSync(manifest.file, `${JSON.stringify(manifest.data, null, manifest.indent)}\n`);
	if (!hasConfigsDependency(manifest.data) && !(!usesPnpm(dir, env) && hasConfigsDependency(readRootManifest(env)))) {
		results.push({
			area: "dependency",
			name: "@cldmv/configs",
			level: "hint",
			message: `not installed yet; install it (init never installs): ${installCommand(dir, env, manifest.data)}`
		});
	}
	return { results, ok: true };
}

/**
 * Reports drift from the shared configs without writing.
 * @param {string} dir - Package directory.
 * @param {Env} env - Run settings.
 * @returns {{ results: Result[], ok: boolean }} One result per check; `ok` is false when a problem was found.
 */
function check(dir, env) {
	const manifest = readManifest(dir);
	/** @type {Result[]} */
	const results = [];
	let importsConfigs = false;
	for (const stub of STUBS) {
		const target = path.join(dir, stub.file);
		if (!existsSync(target))
			results.push({ area: "file", name: stub.file, level: "problem", message: "missing; run `cldmv-configs init`" });
		else {
			const text = readFileSync(target, "utf8");
			importsConfigs ||= /@cldmv\/configs/.test(text);
			if (!stub.reference.test(text)) {
				results.push({ area: "file", name: stub.file, level: "problem", message: "no longer references the @cldmv/configs base" });
			} else results.push({ area: "file", name: stub.file, level: "ok", message: "references the @cldmv/configs base" });
		}
	}
	const name = env.ignoreFile;
	const ignorePath = path.join(dir, name);
	if (!existsSync(ignorePath)) {
		results.push({ area: "ignore", name, level: "problem", message: "missing; run `cldmv-configs init`" });
	} else {
		const lines = readFileSync(ignorePath, "utf8").split("\n");
		const block = findBlock(lines);
		if (block.state !== "ok") {
			results.push({
				area: "ignore",
				name,
				level: "problem",
				message: `managed block is absent (${block.reason}), package ships v${shippedPackage.version}; see \`cldmv-configs sync --help\``
			});
		} else if (blockText(lines, block).join("\n") !== shippedText.join("\n")) {
			results.push({
				area: "ignore",
				name,
				level: "problem",
				message:
					block.version === shippedPackage.version
						? `managed block was edited (marker says v${block.version}); run \`cldmv-configs sync\``
						: `managed block is from v${block.version ?? "unknown"} or edited, package ships v${shippedPackage.version}; run \`cldmv-configs sync\``
			});
		} else if (block.version !== shippedPackage.version) {
			results.push({
				area: "ignore",
				name,
				level: "ok",
				message: `managed block matches the shipped text (marker says v${block.version ?? "unknown"}, package is v${shippedPackage.version})`
			});
		} else results.push({ area: "ignore", name, level: "ok", message: `managed block matches v${shippedPackage.version}` });
	}
	if (importsConfigs) {
		const pnpm = usesPnpm(dir, env);
		const own = hasConfigsDependency(manifest.data);
		const viaRoot = !pnpm && hasConfigsDependency(readRootManifest(env));
		if (own) results.push({ area: "dependency", name: "@cldmv/configs", level: "ok", message: "listed in this package's dependencies" });
		else if (viaRoot)
			results.push({ area: "dependency", name: "@cldmv/configs", level: "ok", message: "listed in the workspace root's dependencies" });
		else {
			results.push({
				area: "dependency",
				name: "@cldmv/configs",
				level: "problem",
				message: `imported by a .configs/ stub but ${pnpm ? "not in this package's dependencies (pnpm does not hoist it into packages)" : "in no package.json"}; install it: ${installCommand(dir, env, manifest.data)}`
			});
		}
	}
	const scripts = manifest.data.scripts ?? {};
	for (const script of SCRIPTS) {
		const present = script.aliases.find((alias) => typeof scripts[alias] === "string");
		if (!present) {
			results.push({ area: "script", name: script.names[env.scripts], level: "warning", message: "missing; run `cldmv-configs init`" });
		} else if (!scripts[present].includes(script.stub)) {
			results.push({ area: "script", name: present, level: "warning", message: `does not reference ${script.stub}` });
		} else results.push({ area: "script", name: present, level: "ok", message: `references ${script.stub}` });
	}
	return { results, ok: !results.some((result) => result.level === "problem") };
}

/**
 * Rewrites the managed block of the Prettier ignore file from the shipped file.
 * @param {string} dir - Package directory.
 * @param {Env} env - Run settings.
 * @returns {{ results: Result[], ok: boolean, diff?: string[] }} The outcome; `ok` is false when the file has no usable markers.
 */
function sync(dir, env) {
	const name = env.ignoreFile;
	const target = path.join(dir, name);
	if (!existsSync(target)) {
		const fresh = shippedLines.map((line, index) => (index === shippedBlock.open ? versionedBlock()[0] : line)).join("\n");
		if (!env.dryRun) {
			mkdirSync(path.dirname(target), { recursive: true });
			writeFileSync(target, fresh);
		}
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
	if (!env.dryRun) writeFileSync(target, next);
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
 * Reads the workspace package globs declared in a directory.
 * @param {string} root - Workspace root.
 * @returns {string[] | null} The glob patterns, or null when the directory declares no workspace.
 */
function workspacePatterns(root) {
	const yamlFile = path.join(root, "pnpm-workspace.yaml");
	if (existsSync(yamlFile)) {
		const patterns = [];
		let inPackages = false;
		for (const raw of readFileSync(yamlFile, "utf8").split(/\r?\n/)) {
			const line = raw.replace(/\s+#.*$/, "");
			if (/^packages\s*:\s*$/.test(line)) inPackages = true;
			else if (/^packages\s*:\s*\[/.test(line)) {
				for (const item of line.slice(line.indexOf("[") + 1, line.lastIndexOf("]")).split(","))
					patterns.push(item.trim().replace(/^["']|["']$/g, ""));
				inPackages = false;
			} else if (inPackages && /^\s*-\s*/.test(line))
				patterns.push(
					line
						.replace(/^\s*-\s*/, "")
						.trim()
						.replace(/^["']|["']$/g, "")
				);
			else if (inPackages && /^\S/.test(line)) inPackages = false;
		}
		return patterns.filter(Boolean);
	}
	const manifestFile = path.join(root, "package.json");
	if (existsSync(manifestFile)) {
		try {
			const workspaces = JSON.parse(readFileSync(manifestFile, "utf8")).workspaces;
			if (Array.isArray(workspaces)) return workspaces;
			if (Array.isArray(workspaces?.packages)) return workspaces.packages;
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * Converts one glob path segment (`*` wildcards only) into a matcher.
 * @param {string} segment - A path segment without slashes.
 * @returns {RegExp} Matches a directory name.
 */
const segmentPattern = (segment) => new RegExp(`^${segment.replace(/[.+^${}()|[\]\\?]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);

/**
 * Lists the directories under a base that match glob segments. `**` matches any number of directory levels, including none; `node_modules` and
 * `.git` are never entered.
 * @param {string} base - Absolute directory to start from.
 * @param {string[]} segments - Remaining glob segments.
 * @param {Set<string>} found - Collects absolute directory paths.
 * @returns {void}
 */
function matchDirectories(base, segments, found) {
	if (segments.length === 0) {
		found.add(base);
		return;
	}
	const [head, ...rest] = segments;
	const children = () =>
		readdirSync(base, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git")
			.map((entry) => entry.name);
	if (head === "**") {
		matchDirectories(base, rest, found);
		for (const child of children()) matchDirectories(path.join(base, child), segments, found);
	} else if (head.includes("*")) {
		const pattern = segmentPattern(head);
		for (const child of children().filter((name) => pattern.test(name))) matchDirectories(path.join(base, child), rest, found);
	} else if (head !== "node_modules" && existsSync(path.join(base, head))) matchDirectories(path.join(base, head), rest, found);
}

/**
 * Finds the workspace packages: directories matching the declared globs (minus `!` exclusions) that have a package.json.
 * @param {string} root - Workspace root.
 * @param {boolean} includeRoot - Add the root itself.
 * @returns {Array<{ dir: string, label: string }>} Packages sorted by label.
 */
function discoverPackages(root, includeRoot) {
	const patterns = workspacePatterns(root);
	if (patterns === null)
		throw new UsageError('--workspaces needs a pnpm-workspace.yaml or a package.json with "workspaces" in the current directory');
	const collect = (list) => {
		const found = new Set();
		for (const pattern of list) {
			const segments = pattern
				.replace(/^\.\//, "")
				.replace(/\/+$/, "")
				.split("/")
				.filter((segment) => segment !== "" && segment !== ".");
			if (segments.length > 0) matchDirectories(root, segments, found);
		}
		return found;
	};
	const included = collect(patterns.filter((pattern) => !pattern.startsWith("!")));
	for (const excluded of collect(patterns.filter((pattern) => pattern.startsWith("!")).map((pattern) => pattern.slice(1))))
		included.delete(excluded);
	included.delete(root);
	const dirs = [...included].filter((dir) => existsSync(path.join(dir, "package.json")));
	const packages = dirs.map((dir) => ({ dir, label: path.relative(root, dir).split(path.sep).join("/") }));
	if (includeRoot && existsSync(path.join(root, "package.json"))) packages.push({ dir: root, label: "." });
	return packages.sort((a, b) => (a.label === "." ? -1 : b.label === "." ? 1 : a.label.localeCompare(b.label)));
}

/**
 * Runs one command in one package directory.
 * @param {string} command - init, check or sync.
 * @param {string} dir - Package directory.
 * @param {Env} env - Run settings.
 * @returns {{ results: Result[], ok: boolean, diff?: string[] }} The outcome.
 */
const runCommand = (command, dir, env) => (command === "init" ? init(dir, env) : command === "check" ? check(dir, env) : sync(dir, env));

const VERBS = { created: "create", added: "add", updated: "update" };

/**
 * Prints one package's results as plain lines.
 * @param {{ results: Result[], diff?: string[] }} outcome - The package outcome.
 * @param {Env} env - Run settings.
 * @param {string} indent - Prefix for each line.
 * @returns {void}
 */
function printResults(outcome, env, indent = "") {
	for (const result of outcome.results) {
		const label = env.dryRun && VERBS[result.level] ? `would ${VERBS[result.level]}` : result.level;
		console.log(`${indent}${label.padEnd(8)} ${result.name}: ${result.message}`);
	}
	if (outcome.diff) {
		console.log(`${indent}--- ${env.ignoreFile}\n${indent}+++ shipped managed block`);
		for (const line of outcome.diff) console.log(`${indent}${line}`);
	}
}

/**
 * Counts results by level.
 * @param {Result[]} results - Results to count.
 * @param {string} level - Level to count.
 * @returns {number} The count.
 */
const count = (results, level) => results.filter((result) => result.level === level).length;

/**
 * Entry point.
 * @param {string[]} argv - Arguments after the script name.
 * @returns {number} The exit code.
 */
function main(argv) {
	let json = false;
	try {
		const { command, flags, values } = parseArgs(argv);
		json = flags.has("--json");
		if (command === undefined || command === "help") {
			if (command === undefined && !flags.has("--help") && flags.size + Object.keys(values).length > 0) {
				throw new UsageError(`unknown option ${[...flags, ...Object.keys(values)][0]}`);
			}
			console.log(HELP.main);
			return command === undefined && !flags.has("--help") ? 2 : 0;
		}
		if (!Object.hasOwn(HELP, command) || command === "main") throw new UsageError(`unknown command "${command}"`);
		if (flags.has("--help")) {
			console.log(HELP[command]);
			return 0;
		}
		const allowed = new Set(["--json", "--help", "--workspaces", "--root", ...(command === "check" ? ["--strict"] : ["--dry-run"])]);
		for (const flag of flags) if (!allowed.has(flag)) throw new UsageError(`unknown option ${flag} for "${command}"`);
		const allowedValues = new Set(["--ignore-file", ...(command === "init" ? ["--scripts"] : [])]);
		for (const option of Object.keys(values))
			if (!allowedValues.has(option)) throw new UsageError(`unknown option ${option} for "${command}"`);
		const scripts = values["--scripts"] ?? "fleet";
		if (scripts !== "fleet" && scripts !== "prettier") throw new UsageError(`--scripts must be "fleet" or "prettier", not "${scripts}"`);
		const ignoreFile = (values["--ignore-file"] ?? DEFAULT_IGNORE_FILE).replace(/^\.\//, "");
		if (path.isAbsolute(ignoreFile) || ignoreFile.split("/").includes(".."))
			throw new UsageError("--ignore-file must be a path inside the package");
		const workspaces = flags.has("--workspaces");
		if (flags.has("--root") && !workspaces) throw new UsageError("--root only applies together with --workspaces");
		const dryRun = flags.has("--dry-run");
		const strict = flags.has("--strict");
		const cwd = process.cwd();
		/** @type {Env} */
		const base = { dryRun, scripts, ignoreFile, workspaceRoot: cwd, label: "." };

		if (!workspaces) {
			if (workspacePatterns(cwd) !== null) {
				console.error(
					"hint: this directory declares a workspace; running on the root package only. Add --workspaces to cover every package."
				);
			}
			const outcome = runCommand(command, cwd, base);
			const warnings = count(outcome.results, "warning");
			const problems = count(outcome.results, "problem");
			const failed = !outcome.ok || (strict && warnings > 0);
			if (json) {
				console.log(
					JSON.stringify({ command, ok: !failed, dryRun, problems, warnings, results: outcome.results, diff: outcome.diff }, null, 2)
				);
			} else {
				printResults(outcome, base);
				if (command === "check") console.log(`${problems} problem(s), ${warnings} warning(s)`);
			}
			return failed ? 1 : 0;
		}

		const packages = discoverPackages(cwd, flags.has("--root"));
		if (packages.length === 0) throw new UsageError("the workspace globs match no directory with a package.json");
		const outcomes = packages.map((pkg) => {
			const env = { ...base, label: pkg.label };
			const outcome = runCommand(command, pkg.dir, env);
			const failed = !outcome.ok || (strict && count(outcome.results, "warning") > 0);
			return {
				path: pkg.label,
				ok: !failed,
				problems: count(outcome.results, "problem"),
				warnings: count(outcome.results, "warning"),
				...outcome,
				failed
			};
		});
		const failedPackages = outcomes.filter((outcome) => outcome.failed).length;
		const totals = {
			packages: outcomes.length,
			failed: failedPackages,
			problems: outcomes.reduce((sum, o) => sum + o.problems, 0),
			warnings: outcomes.reduce((sum, o) => sum + o.warnings, 0)
		};
		if (json) {
			console.log(
				JSON.stringify(
					{
						command,
						workspaces: true,
						ok: failedPackages === 0,
						dryRun,
						...totals,
						packages: outcomes.map(({ path: where, ok, problems, warnings, results, diff }) => ({
							path: where,
							ok,
							problems,
							warnings,
							results,
							diff
						}))
					},
					null,
					2
				)
			);
		} else {
			for (const outcome of outcomes) {
				const created = count(outcome.results, "created");
				const added = count(outcome.results, "added");
				const updated = count(outcome.results, "updated");
				const summary =
					command === "check"
						? `${outcome.failed ? "FAIL" : "ok"} (${outcome.problems} problem(s), ${outcome.warnings} warning(s))`
						: command === "init"
							? `${dryRun ? "would create" : "created"} ${created} file(s), ${dryRun ? "would add" : "added"} ${added} script(s), kept ${count(outcome.results, "kept")}`
							: `${outcome.failed ? "FAIL" : "ok"} (${created ? "created" : updated ? "updated" : "unchanged"})`;
				console.log(`${outcome.path}: ${summary}`);
				const interesting = { ...outcome, results: outcome.results.filter((result) => !["ok", "kept"].includes(result.level)) };
				printResults(interesting, { ...base, label: outcome.path }, "  ");
			}
			console.log(
				`${totals.packages} package(s): ${totals.packages - failedPackages} ok, ${failedPackages} with problems (${totals.problems} problem(s), ${totals.warnings} warning(s))`
			);
			const missing = outcomes.filter((outcome) =>
				outcome.results.some((result) => result.area === "dependency" && ["problem", "hint"].includes(result.level))
			);
			if (missing.length > 0 && usesPnpm(cwd, base)) {
				console.log(
					`${missing.length} package(s) lack @cldmv/configs; to add it to every package at once: pnpm add -D @cldmv/configs@latest -r`
				);
			}
		}
		return failedPackages > 0 ? 1 : 0;
	} catch (error) {
		const message = error instanceof UsageError ? error.message : `${/** @type {Error} */ (error).message}`;
		if (json) console.log(JSON.stringify({ ok: false, error: message }));
		else console.error(`cldmv-configs: ${message}\nRun "cldmv-configs --help" for usage.`);
		return 2;
	}
}

process.exitCode = main(process.argv.slice(2));
