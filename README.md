# @cldmv/configs

**@cldmv/configs** is the single source of CLDMV's shared tool configurations. Every CLDMV repository runs the same tools with the same house settings; instead of copying those settings into each repository, where the copies drift apart, the canonical versions live here as shared config files that each repository extends.

A repository points its tool at the shared file and keeps only its own overrides locally. When a house setting changes, it changes here once, and every repository picks it up on its next update.

Most of the configs are plain JSON (`fix-headers.json`, `prettier.json`) and one is a plain ignore list (`prettierignore`). Two are small ES modules, because ESLint and Vitest configs are code: `eslint.config.mjs` exports the flat config as an array and imports the ESLint plugins it needs, and `vitest.config.mjs` exports a plain settings object with no imports. The package therefore has real dependencies: the six ESLint plugin packages that `eslint.config.mjs` imports (`@eslint/js`, `@eslint/json`, `@eslint/markdown`, `@eslint/css`, `@cldmv/eslint-plugin-jsonv` and `globals`) are regular `dependencies`, and `eslint`, `vitest` and `@cldmv/prettier-plugin-jsonv` are optional peers that only matter to repositories using the matching config. It also ships a small command-line tool, `cldmv-configs`, that adopts the configs in a repository and detects drift (see [CLI](#cli)). It ships the config files, the CLI, this README, the license and `package.json`, and nothing else.

[![npm version]][npm_version_url] [![npm downloads]][npm_downloads_url] [![Last commit]][last_commit_url] [![npm last update]][npm_last_update_url] [![coverage]][coverage_url]

[![Contributors]][contributors_url] [![Sponsor shinrai]][sponsor_url]

---

## ✨ What's New

### Latest: v1.3.0 (October 2026)

- **Four new shared configs** — `prettier.json` (CLDMV's house formatting: tabs, 140 columns, preserved quote props and prose wrapping, the jsonv parser for `.jsonv` files), `prettierignore` (the paths every repository keeps out of Prettier), `eslint.config.mjs` (the fleet's flat ESLint config as an array to spread) and `vitest.config.mjs` (a base settings object to merge). Use them as `@cldmv/configs/prettier.json`, `@cldmv/configs/prettierignore`, `@cldmv/configs/eslint.config.mjs` and `@cldmv/configs/vitest.config.mjs`. This repository now lints, formats and tests itself with the files it publishes.
- **`cldmv-configs` CLI** — `npx cldmv-configs init` creates the `.configs/` stubs, `.prettierignore` and standard npm scripts without overwriting anything, `check` reports drift (exit `1`) for CI and fleet sweeps, and `sync` refreshes the managed block of `.prettierignore` while leaving the repository's own lines alone. It serves workspace monorepos too: `--workspaces` runs any command in every package (pnpm and npm workspaces), `--ignore-file` moves the ignore block (for example to `.configs/.prettierignore`), `--scripts prettier` names the Prettier scripts `prettier:write` and `prettier:check` (and `check` accepts both naming pairs), and `check` flags a package that imports `@cldmv/configs` without depending on it, which pnpm requires per package.
- **The package gains dependencies** — the six ESLint plugin packages that `eslint.config.mjs` imports are now regular `dependencies`; `eslint`, `vitest` (4 or 5) and `@cldmv/prettier-plugin-jsonv` are optional peers. `fix-headers.json` is unchanged.
- [View full v1.3.0 Changelog](https://github.com/CLDMV/configs/blob/master/docs/changelog/v1/v1.3.0.md)

### Recent Releases

- **v1.2.5** (October 2026) — dev-tooling refresh only: `eslint` 10.12.0, the jsonv plugins and `@cldmv/vitest-runner` 1.5.2 in this repository's dev dependencies (#24, #25); `fix-headers.json` unchanged ([Changelog](https://github.com/CLDMV/configs/blob/master/docs/changelog/v1/v1.2.5.md))
- **v1.2.4** (October 2026) — the shared `fix-headers.json` sets `forceLastModifiedAuthorUpdate` to `false`, so `@Last modified by` changes only when a file's content was edited; needs fix-headers 2.2.0 or later (#20) ([Changelog](https://github.com/CLDMV/configs/blob/master/docs/changelog/v1/v1.2.4.md))
- **v1.2.3** (October 2026) — the shared `fix-headers.json` keeps an existing `@Author` (`forceAuthorUpdate: false`, #16), and the repository's own headers are restamped under fix-headers 2.1.4 (#12) ([Changelog](https://github.com/CLDMV/configs/blob/master/docs/changelog/v1/v1.2.3.md))
- **v1.2.2** (October 2026) — the CI `✅ Required PR Check` mirror job runs on every path instead of being skipped on in-repo PRs (#10) ([Changelog](https://github.com/CLDMV/configs/blob/master/docs/changelog/v1/v1.2.2.md))

📚 **For complete version history, see [docs/changelog/](https://github.com/CLDMV/configs/tree/master/docs/changelog/) and the [GitHub Releases](https://github.com/CLDMV/configs/releases).**

---

## 🚀 Key Features

- **One source of truth** — each house setting is defined once, here, instead of in a copy per repository.
- **Plain files, almost no code** — JSON for fix-headers and Prettier, a plain list for the Prettier ignore, and two small modules for ESLint and Vitest. The ESLint plugins the base imports are the package's only dependencies; `eslint`, `vitest` and the jsonv Prettier plugin are optional peers.
- **Two ways to consume it** — by package specifier through `package.json` `exports` (`@cldmv/configs/fix-headers.json`, `@cldmv/configs/prettier.json`, `@cldmv/configs/eslint.config.mjs`, ...), or by a raw GitHub URL pinned to a release tag.
- **One command to adopt, one to audit** — `npx cldmv-configs init` creates the stubs and scripts, `check` reports drift for CI, `sync` refreshes the ignore list.
- **Local overrides** — a repository's own config extends the shared file and overrides only the keys that are genuinely specific to it.
- **Tested** — the suite checks that every exported file parses, that every `exports` entry ships, that the settings are ones the tool accepts, and that `npm pack` publishes exactly the intended files.

---

## 📦 Installation

### Requirements

- A tool that can extend a shared config. For fix-headers that is **v2.0.0 or later**: `extends` arrives in [CLDMV/fix-headers#88](https://github.com/CLDMV/fix-headers/pull/88), and several of the options this config sets (`fixCreatedDate`, `normalizeDateFormat`, `strictCreatedDate`) in [CLDMV/fix-headers#67](https://github.com/CLDMV/fix-headers/pull/67). Older releases cannot resolve `extends` and ignore those options. Use **v2.2.0 or later** for the author rules: from 2.2.0, `@Last modified by` changes only when a file's content was edited ([CLDMV/fix-headers#128](https://github.com/CLDMV/fix-headers/pull/128)).
- For `prettier.json`, **Prettier 3** with a config file that can import JSON (`prettier.config.mjs`). Repositories that format `.jsonv` files also install [`@cldmv/prettier-plugin-jsonv`](https://github.com/CLDMV/prettier-plugin-jsonv), an optional peer dependency of this package.
- For `eslint.config.mjs`, **ESLint 10** (`eslint/config` supplies `defineConfig`, and the `@eslint/js` it uses requires ESLint 10) and a flat config file that can import an ES module.
- For `vitest.config.mjs`, **Vitest 4 or 5** (the `peerDependencies` range is `^4.0.0 || ^5.0.0`; the base uses only options both versions accept) and a Vitest config file that can import an ES module. Coverage with the `v8` provider also needs `@vitest/coverage-v8` at the Vitest version.
- A Node.js release that can `import` JSON with `with { type: "json" }`.

### Install

Install the package as a devDependency next to the tool it configures:

```sh
npm install --save-dev @cldmv/configs@latest @cldmv/fix-headers@latest prettier@latest eslint@latest vitest@latest @vitest/coverage-v8@latest
```

Install only the tools whose config the repository uses. `@cldmv/configs` itself brings the ESLint plugins that `eslint.config.mjs` imports; they are its dependencies, so nothing else needs installing for ESLint.

A repository that formats `.jsonv` files also installs the jsonv plugin, the optional peer dependency that `prettier.json` loads:

```sh
npm install --save-dev @cldmv/prettier-plugin-jsonv@latest
```

---

## 🚀 Quick Start

### CLI

`cldmv-configs` is the adoption path. Run it from the root of the repository after installing the package:

```sh
npx cldmv-configs init
```

`init` creates, only where the file is missing and never overwriting, `.configs/fix-headers.json`, `.configs/prettier.config.mjs`, `.configs/eslint.config.mjs`, `.configs/vitest.config.mjs` and `.prettierignore`, then adds the standard npm scripts (`format`, `format:check`, `lint`, `lint:fix`, `fix:headers`, `test`, `coverage`) to `package.json`. An existing file or script is reported as `kept` and never changed. `package.json` keeps its indentation and key order, but it is re-serialized when scripts are added, so an inline array such as `"files": ["a", "b"]` is expanded until `npm run format` collapses it again. Every created, added and kept item is printed. `--dry-run` prints the same list and writes nothing.

| Command               | What it does                                                                                                                                                                                                                                                                                                                                                              | Exit codes                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `cldmv-configs init`  | Creates the missing stubs and `.prettierignore`, and adds the missing standard scripts                                                                                                                                                                                                                                                                                    | `0` ok, `2` usage or I/O error                                             |
| `cldmv-configs check` | Reports drift without writing: each stub exists and still references the `@cldmv/configs` base, the `.prettierignore` managed block matches the shipped one, and `@cldmv/configs` is installed where a stub imports it (these are problems), and each standard script exists and references its stub (these are warnings). It never judges the repository's own additions | `0` ok, `1` problems (or warnings with `--strict`), `2` usage or I/O error |
| `cldmv-configs sync`  | Rewrites only the managed block of `.prettierignore` from the shipped file, leaving every byte outside the markers alone. It refuses (exit `1`, with a diff) when the file has no markers                                                                                                                                                                                 | `0` ok, `1` refused, `2` usage or I/O error                                |

Every command takes `--help`, and `--json` prints a machine-readable summary instead of plain lines. `check` is meant for CI and fleet sweeps: it exits `1` on drift and prints one line per item. `sync` is for the ignore list only; the stubs extend the shared files at run time, so a new release needs no sync for them.

```sh
npx cldmv-configs check            # CI: exit 1 on drift
npx cldmv-configs check --strict   # also fail on missing or detached scripts
npx cldmv-configs sync --dry-run   # preview the ignore-list refresh
```

`init` takes `--scripts prettier` to name the Prettier scripts `prettier:write` and `prettier:check` instead of `format` and `format:check`; `check` accepts either pair as equivalent. `--ignore-file <path>` moves the managed ignore block (see [Prettier ignore](#prettier-ignore)). `check` also reports, as a problem, a package whose `.configs/` stub imports `@cldmv/configs` while the package does not depend on it, and prints the install command (the CLI never installs anything). In a workspace, `--workspaces` runs any command in every package; see [Monorepos](#-monorepos).

The sections below show what `init` creates and how to set each tool up by hand.

### fix-headers

`npx cldmv-configs init` creates `.configs/fix-headers.json` and the `fix:headers` script. To do it by hand, create the repository's own config, `.configs/fix-headers.json`, extending the shared file:

```json
{
	"extends": "@cldmv/configs/fix-headers.json"
}
```

Add an npm script that runs fix-headers against it:

```json
{
	"scripts": {
		"fix:headers": "fix-headers --config .configs/fix-headers.json"
	}
}
```

Preview the first run before writing anything, then apply it:

```sh
npx fix-headers --config .configs/fix-headers.json --dry-run --diff --verbose
npm run fix:headers
```

A first run rewrites many headers across the repository, so land it when no open pull request touches the same files.

### Prettier

`npx cldmv-configs init` creates `.configs/prettier.config.mjs`, `.prettierignore` and the `format` scripts. To do it by hand, create the repository's own config, `.configs/prettier.config.mjs`, re-exporting the shared file:

```js
import base from "@cldmv/configs/prettier.json" with { type: "json" };

export default base;
```

Point the npm scripts at it:

```json
{
	"scripts": {
		"format": "prettier --config .configs/prettier.config.mjs --write .",
		"format:check": "prettier --config .configs/prettier.config.mjs --check ."
	}
}
```

Copy the shared ignore list to `.prettierignore` as described in [Prettier ignore](#prettier-ignore) below.

`prettier.json` loads `@cldmv/prettier-plugin-jsonv`, so a repository that formats `.jsonv` files installs that plugin alongside this package. A repository with no `.jsonv` files does not need the plugin: spread the base and drop `plugins` and the jsonv override.

```js
import base from "@cldmv/configs/prettier.json" with { type: "json" };

export default {
	...base,
	plugins: [],
	overrides: base.overrides.filter((entry) => entry.files !== "*.jsonv")
};
```

Preview the first run before writing anything, then apply it. A first run can reformat many files, so land it when no open pull request touches the same files.

```sh
npx prettier --config .configs/prettier.config.mjs --check .
npm run format
```

### Prettier ignore

Prettier has no way to extend another ignore file, so the shared list lives in a managed block inside the repository's own `.prettierignore`. `npx cldmv-configs init` creates the file with the block; `npx cldmv-configs sync` refreshes it later. The file looks like this:

```text
# >>> @cldmv/configs prettierignore v1.3.0 — managed block, do not edit between the markers; run `npx cldmv-configs sync` to refresh
…the shared ignore lines, each group with a one-line reason…
# <<< @cldmv/configs prettierignore
# Repo-specific ignores go below this line; they survive every sync. Use `!path` to re-include something the managed block ignores.
```

The rule is simple: everything between the two marker lines belongs to the package and is replaced on every `sync`; everything outside them belongs to the repository and is never touched. Add the repository's own paths below the closing marker, and use `!path` there to re-include something the block ignores. The version in the opening marker is the package version at the time of the sync. `check` compares the block text (not the version) with the shipped block and exits `1` if they differ, so an edit inside the markers is caught. Because `.prettierignore` is a normal file in the repository, Prettier and editors that format on save read it with no flags.

A `.prettierignore` that already exists without markers is never rewritten: `sync` refuses, prints the diff between the file and the shipped block, and exits `1`. Add the two marker lines around the shared lines (or rename the file and run `init`, then move the repository's own lines below the closing marker), then sync again. This repository keeps its `.prettierignore` the same way, and a test checks that its managed block equals the shipped one.

The managed block can live somewhere other than `.prettierignore`: `--ignore-file .configs/.prettierignore` makes `init`, `check` and `sync` use that path, and `init` then writes the Prettier scripts with `--ignore-path .gitignore --ignore-path .configs/.prettierignore`. Prettier resolves the patterns relative to the ignore file's folder and still matches `dist/` at the repository root.

The alternative, for a repository with no ignore rules of its own that does not need editor support, is to point Prettier at the installed file in the npm scripts. `--ignore-path` replaces Prettier's defaults, so `.gitignore` is passed explicitly as well:

```json
{
	"scripts": {
		"format": "prettier --config .configs/prettier.config.mjs --ignore-path .gitignore --ignore-path node_modules/@cldmv/configs/prettierignore --write .",
		"format:check": "prettier --config .configs/prettier.config.mjs --ignore-path .gitignore --ignore-path node_modules/@cldmv/configs/prettierignore --check ."
	}
}
```

Editors that run Prettier do not see this form, so they ignore nothing from the shared list.

### ESLint

`npx cldmv-configs init` creates `.configs/eslint.config.mjs` and the `lint` scripts. To do it by hand, create the repository's own config, `.configs/eslint.config.mjs`, spreading the shared array and appending the repository's own blocks:

```js
import base from "@cldmv/configs/eslint.config.mjs";

export default [
	...base,
	{
		files: ["src/**/*.mjs"],
		rules: { "no-console": "warn" }
	}
];
```

Add the npm scripts:

```json
{
	"scripts": {
		"lint": "eslint --config .configs/eslint.config.mjs .",
		"lint:fix": "eslint --config .configs/eslint.config.mjs . --fix"
	}
}
```

A repository that needs an extra ignore (a generated folder, a `bin/` output) adds a block with only `ignores`: `{ ignores: ["bin/**"] }`. The base ignores `.configs/**`, so the config files themselves are not linted.

### Vitest

`npx cldmv-configs init` creates `.configs/vitest.config.mjs` and the `test` and `coverage` scripts. To do it by hand, create the repository's own config, `.configs/vitest.config.mjs`, merging its settings over the shared base:

```js
import { defineConfig, mergeConfig } from "vitest/config";
import base from "@cldmv/configs/vitest.config.mjs";

export default mergeConfig(
	base,
	defineConfig({
		test: {
			coverage: { include: ["src/**"] }
		}
	})
);
```

Run Vitest with `--config .configs/vitest.config.mjs`. `mergeConfig` concatenates arrays, so a repository's `include` or `coverage.reporter` adds to the base entries instead of replacing them.

---

## 📋 Configs

| File                                     | Tool                                                         | Specifier                          | What it sets                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [`fix-headers.json`](fix-headers.json)   | [`@cldmv/fix-headers`](https://github.com/CLDMV/fix-headers) | `@cldmv/configs/fix-headers.json`  | CLDMV's standard file-header options: author and company identity, copyright range, and the created-date checks                        |
| [`prettier.json`](prettier.json)         | [`prettier`](https://prettier.io)                            | `@cldmv/configs/prettier.json`     | CLDMV's house formatting: tabs, a 140-column width, preserved quote props and prose wrapping, and the jsonv plugin                     |
| [`prettierignore`](prettierignore)       | [`prettier`](https://prettier.io)                            | `@cldmv/configs/prettierignore`    | The paths every repository keeps out of Prettier: dependencies, build output, scratch folders, lockfiles, minified files and YAML      |
| [`eslint.config.mjs`](eslint.config.mjs) | [`eslint`](https://eslint.org)                               | `@cldmv/configs/eslint.config.mjs` | CLDMV's flat ESLint config as an array: JavaScript, JSON, jsonv, Markdown and CSS blocks, house `no-unused-vars` pattern, test globals |
| [`vitest.config.mjs`](vitest.config.mjs) | [`vitest`](https://vitest.dev)                               | `@cldmv/configs/vitest.config.mjs` | CLDMV's base Vitest settings as a plain object: test file pattern, node environment, v8 coverage and its reporters                     |

Each file is exposed through `package.json` `exports`, so it resolves by its specifier from any project that installs the package, and is also reachable by URL straight from this repository. The two `.mjs` files are ES modules and `eslint.config.mjs` imports the ESLint plugins from the package's dependencies, so use them through the installed package; the raw-URL form only suits the plain-data files.

---

## 🧾 fix-headers.json

```json
{
	"includeFolders": ["."],
	"useGpgSignerAuthor": true,
	"company": "CLDMV",
	"companyName": "Catalyzed Motivation Inc.",
	"copyrightStartYear": 2013,
	"forceAuthorUpdate": false,
	"forceLastModifiedAuthorUpdate": false,
	"fixCreatedDate": true,
	"normalizeDateFormat": true,
	"strictCreatedDate": true,
	"margin": 1
}
```

| Option                          | Value                         | Effect                                                                                                                                                       |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `includeFolders`                | `["."]`                       | Scan the whole project; ignore files (`.gitignore` and everything else git honours) still exclude what they list                                             |
| `useGpgSignerAuthor`            | `true`                        | Take the `@Author` name from the user ID of the OpenPGP key git signs commits with                                                                           |
| `company`                       | `"CLDMV"`                     | Write `@Author` as `Name <CLDMV>`                                                                                                                            |
| `companyName`                   | `"Catalyzed Motivation Inc."` | The copyright holder in `@Copyright`. fix-headers v2 has no built-in holder and otherwise reads it from the manifest author (`CLDMV`)                        |
| `copyrightStartYear`            | `2013`                        | The first year of the `@Copyright` range, for every file                                                                                                     |
| `forceAuthorUpdate`             | `false`                       | Never rewrite an existing `@Author` / `@Email`; they record who created the file. A missing value is still filled in                                         |
| `forceLastModifiedAuthorUpdate` | `false`                       | `@Last modified by` follows real edits: it changes only when a file's content was edited, not when fix-headers only rewrites the header (fix-headers 2.2.0+) |
| `fixCreatedDate`                | `true`                        | Move an existing `@Date` back to the oldest of itself, the file's first git commit and its filesystem creation time                                          |
| `normalizeDateFormat`           | `true`                        | Write every header date in the git `%aI` form (`2026-03-01T17:59:32-08:00`)                                                                                  |
| `strictCreatedDate`             | `true`                        | With `--check`, fail on an `@Date` later than the file's first commit or creation time instead of only warning                                               |
| `margin`                        | `1`                           | One blank line between the header and the file's next content. The fix-headers default is two, which prettier collapses to one                               |

An existing `@Author` is never rewritten: it records who created the file, and this config sets `forceAuthorUpdate` to `false` explicitly so the decision is visible and wins over anything earlier in an `extends` chain. A repository can turn it on in its own config for a one-off migration of old author names.

`@Last modified by` records the last person to edit the file. With fix-headers 2.2.0 or later it changes only when the file's content was edited; a run that only rewrites the header (date format, spacing, a corrected `@Date`) updates `@Last modified time` but keeps `@Last modified by`. This config therefore sets `forceLastModifiedAuthorUpdate` to `false` as well. With fix-headers before 2.2.0 that setting keeps the existing `@Last modified by` on every run, so upgrade fix-headers alongside this config.

The full description of every option is in the [fix-headers README](https://github.com/CLDMV/fix-headers#readme).

### Using it by URL

Without installing the package, `extends` can point at the raw file in this repository. fix-headers fetches a URL on every run, with no local cache, so pin the URL to a release tag; the settings then change only when the repository moves to a newer tag:

```json
{
	"extends": "https://raw.githubusercontent.com/CLDMV/configs/v1.1.0/fix-headers.json"
}
```

Release tags follow the package version (`vX.Y.Z`); the [releases page](https://github.com/CLDMV/configs/releases) lists them. A URL on `master` instead of a tag always follows the latest shipped settings, which is rarely what a repository wants.

### Overriding keys

A key set in the repository's own `.configs/fix-headers.json` overrides the same key from the shared file, and every key it leaves out keeps the shared value. Plain objects merge key by key; arrays and scalars replace. A repository that should only scan its source, tests and root files, for example:

```json
{
	"extends": "@cldmv/configs/fix-headers.json",
	"includeFolders": ["src", "tests", { "path": ".", "recursive": false }],
	"excludeFolders": ["tests/fixtures"]
}
```

Keep overrides to what is genuinely specific to the repository. A setting every repository would want belongs in the shared file.

---

## 🎨 prettier.json

```json
{
	"useTabs": true,
	"tabWidth": 2,
	"printWidth": 140,
	"trailingComma": "none",
	"quoteProps": "preserve",
	"bracketSpacing": true,
	"overrides": [
		{
			"files": "*.xml",
			"options": {
				"printWidth": 300
			}
		},
		{
			"files": "*.md",
			"options": {
				"proseWrap": "preserve"
			}
		},
		{
			"files": "*.jsonv",
			"options": {
				"parser": "jsonv"
			}
		}
	],
	"plugins": ["@cldmv/prettier-plugin-jsonv"]
}
```

| Option                    | Value                              | Effect                                                                                                                        |
| ------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `useTabs`                 | `true`                             | Indent with tabs                                                                                                              |
| `tabWidth`                | `2`                                | A tab counts as two columns when Prettier measures line width                                                                 |
| `printWidth`              | `140`                              | Wrap lines at 140 columns instead of the default 80, which keeps short call chains and object literals on one line            |
| `trailingComma`           | `"none"`                           | No trailing commas in multi-line literals, calls or parameter lists                                                           |
| `quoteProps`              | `"preserve"`                       | Leave object-key quoting as written, so keys that must be quoted (HTTP headers, JSON-like data) can sit next to unquoted ones |
| `bracketSpacing`          | `true`                             | Spaces inside object braces: `{ a: 1 }`                                                                                       |
| `overrides` for `*.xml`   | `printWidth: 300`                  | XML is wrapped at 300 columns; its markup does not wrap readably at 140                                                       |
| `overrides` for `*.md`    | `proseWrap: "preserve"`            | Markdown paragraphs are never re-flowed: one paragraph per line, so a one-word edit stays a one-line diff                     |
| `overrides` for `*.jsonv` | `parser: "jsonv"`                  | Parse `.jsonv` files with the jsonv plugin's parser                                                                           |
| `plugins`                 | `["@cldmv/prettier-plugin-jsonv"]` | Load the jsonv plugin, which provides that parser. An optional peer dependency of this package                                |

YAML is not configured here. CI workflow files are four-space indented by convention and YAML forbids tabs, so repositories keep `*.yml` and `*.yaml` out of Prettier with the shared [`prettierignore`](#-prettierignore) rather than have it reindent every workflow.

### The jsonv plugin is optional

Prettier fails to start when a config names a plugin it cannot load, so a repository that extends `prettier.json` without installing `@cldmv/prettier-plugin-jsonv` gets an error naming the plugin. The package declares the plugin as an optional peer dependency (`peerDependenciesMeta`), so npm does not install it for you and does not warn when it is absent. Install it in repositories that format `.jsonv` files, or drop `plugins` and the `*.jsonv` override as shown in [Prettier](#prettier) under Quick Start.

### Overriding options

The repository's own `.configs/prettier.config.mjs` is plain JavaScript, so it can spread the shared object and override any key. `overrides` and `plugins` are arrays, and a spread replaces them rather than merging, so list every entry you want to keep:

```js
import base from "@cldmv/configs/prettier.json" with { type: "json" };

export default {
	...base,
	printWidth: 120,
	overrides: [...base.overrides, { files: "*.html", options: { printWidth: 200 } }]
};
```

This repository uses the file the same way: its `.configs/prettier.config.mjs` re-exports `../prettier.json`, so the repository is formatted by the exact file it publishes.

---

## 🙈 prettierignore

```text
node_modules/
dist/
build/
coverage/
tmp/
trash/
package-lock.json
pnpm-lock.yaml
*.min.*
*.yml
*.yaml
```

The file in the repository carries a one-line comment above each group; the list above is the patterns only. The shared lines sit between the opening and closing managed-block markers described under [Prettier ignore](#prettier-ignore).

| Pattern                               | Why it is ignored                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `node_modules/`                       | Installed dependencies                                                                                                                  |
| `dist/`, `build/`, `coverage/`        | Build and test output, not hand-authored                                                                                                |
| `tmp/`, `trash/`                      | Scratch and discarded work                                                                                                              |
| `package-lock.json`, `pnpm-lock.yaml` | Generated by the package manager                                                                                                        |
| `*.min.*`                             | Minified or compact generated files of any extension (`*.min.js`, `*.min.css`, `*.min.json`); name compact data files `<name>.min.json` |
| `*.yml`, `*.yaml`                     | CI workflow files are four-space indented and YAML forbids tabs, so Prettier at `tabWidth` 2 would reindent every workflow              |

After the closing marker the file ends with a note that repository-specific ignores go below it, where they survive every `sync`. See [Prettier ignore](#prettier-ignore) under Quick Start for the managed-block rule, `sync`, and the `--ignore-path` alternative.

---

## 🧹 eslint.config.mjs

The module default-exports an array of flat-config blocks built with `defineConfig` from `eslint/config`. Spread it into the repository's own array and append blocks after it, as in the [ESLint](#eslint) Quick Start.

| Block (files)                           | What it sets                                                                                                                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ignores                                 | `tmp/`, `trash/`, `node_modules/`, `dist/`, `build/`, `.git/`, `.configs/`, `.vscode/`, `coverage/`, minified files, `package-lock.json` and "copy" duplicates of files and folders                              |
| `**/*.{js,mjs,cjs}`                     | `@eslint/js` recommended, with `no-unused-vars` ignoring names that match `^(_\|___.*)$` (a lone `_`, or three or more leading underscores) for variables, arguments, caught errors and destructured array items |
| `**/*.js`                               | `sourceType: "commonjs"`; `.mjs` files stay ES modules                                                                                                                                                           |
| `**/*.{js,mjs,cjs}`                     | Node and browser globals (`globals.node` and `globals.browser`)                                                                                                                                                  |
| `tests/**/*.test.vitest.mjs`            | The Vitest globals `describe`, `it`, `test`, `expect`, `vi`, `beforeAll`, `beforeEach`, `afterAll` and `afterEach`                                                                                               |
| `**/*.json`, `**/*.jsonc`, `**/*.json5` | `@eslint/json` recommended, parsing each as JSON, JSONC or JSON5                                                                                                                                                 |
| `**/*.jsonv`                            | `@cldmv/eslint-plugin-jsonv` recommended, with `language: "jsonv/jsonv"`                                                                                                                                         |
| `**/*.md`                               | `@eslint/markdown` recommended on GitHub-flavoured Markdown, with `markdown/no-missing-label-refs` off because GitHub alerts such as `[!NOTE]` trip it                                                           |
| `**/*.css`                              | `@eslint/css` recommended                                                                                                                                                                                        |

There is no HTML block: linting HTML is specific to a few repositories, which add a block of their own. The ESLint plugins and `globals` are dependencies of this package, so a repository does not install them itself.

---

## 🧪 vitest.config.mjs

The module default-exports a plain object with no imports, so it needs nothing installed and can be merged into any Vitest config with `mergeConfig`, as in the [Vitest](#vitest) Quick Start.

```js
export default {
	test: {
		environment: "node",
		include: ["tests/**/*.test.vitest.{js,mjs,cjs}"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "json-summary", "lcov"],
			reportsDirectory: "coverage"
		}
	}
};
```

| Option                           | Value                                      | Effect                                                                                                                                                      |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test.environment`               | `"node"`                                   | Run tests in Node.js                                                                                                                                        |
| `test.include`                   | `["tests/**/*.test.vitest.{js,mjs,cjs}"]`  | Test files live under `tests/` and are named `*.test.vitest.<ext>`, the fleet-wide naming                                                                   |
| `test.coverage.provider`         | `"v8"`                                     | Measure coverage with V8's built-in collector (needs `@vitest/coverage-v8`)                                                                                 |
| `test.coverage.reporter`         | `["text", "json", "json-summary", "lcov"]` | Console table, the raw and summary JSON that CI's coverage badge and PR comment read (`coverage/coverage-summary.json`), and lcov for editors and uploaders |
| `test.coverage.reportsDirectory` | `"coverage"`                               | Write reports to `coverage/`, which `.gitignore` and the Prettier ignore already exclude                                                                    |

Vitest 4 and 5 are both supported (`peerDependencies.vitest` is `^4.0.0 || ^5.0.0`); the base was checked under 4.1 and 5.0.

A monorepo that already has a shared Vitest helper of its own (a workspace package, for example) should merge the base for the coverage provider and reporters and keep its own `test.include`. The base's `tests/**/*.test.vitest.{js,mjs,cjs}` glob would pull every test tier into one run, which is wrong when the repository splits tiers by directory (unit tests against docker-backed integration tests, say). `mergeConfig` concatenates `include`, so to keep only your own globs set them on the base copy instead of merging over it:

```js
import { defineConfig, mergeConfig } from "vitest/config";
import base from "@cldmv/configs/vitest.config.mjs";

const test = { ...base.test };
delete test.include;

export default mergeConfig({ ...base, test }, defineConfig({ test: { include: ["tests/unit/**/*.unit.test.vitest.mjs"] } }));
```

Coverage `include` and `exclude` globs, thresholds, `root`, timeouts and reporters are repository-specific and stay in the repository's own config. `mergeConfig` concatenates arrays, so a repository that lists its own `coverage.reporter` entries adds to these four.

---

## 🏢 Monorepos

The same three commands serve a single package and a workspace. With no flag they act on the current directory only. In a workspace root they print a hint and still run on the root alone; add `--workspaces` to cover every package.

```sh
npx cldmv-configs init --workspaces                  # every workspace package
npx cldmv-configs check --workspaces --root          # every package and the root
npx cldmv-configs sync --workspaces --dry-run        # preview the ignore-list refresh everywhere
```

**Finding the packages.** The globs come from `pnpm-workspace.yaml` (`packages:`) or, without that file, from `package.json` `workspaces` (an array, or `{ "packages": [...] }`). The matcher supports `*`, `**` (any depth, including none), trailing `/**` and `!` exclusions, never enters `node_modules`, and keeps only directories that have a `package.json`. The workspace root is added with `--root`. Each package gets its own `.configs/` stubs, ignore file and scripts, and the commands run in each directory in turn.

**Output.** One line per package, with the details of anything that is not `ok` or `kept` indented below it, then a summary line. Exit codes aggregate: any problem in any package makes the exit code `1`. `--json` nests the results per package (`packages[].path`, `.ok`, `.problems`, `.warnings`, `.results`).

**pnpm needs the dependency in every package.** The stubs import `@cldmv/configs`. npm hoists it from the workspace root, but pnpm's strict layout does not, so under pnpm (a `pnpm-lock.yaml` or `pnpm-workspace.yaml` is present) each package must list it itself. `check` reports a missing one as a problem and prints the command; `init` prints it as a hint. Neither runs an install. To add it everywhere at once:

```sh
pnpm add -D @cldmv/configs@latest -r
```

or for one package, `pnpm add -D @cldmv/configs@latest --filter @acme/api`. On npm, `check` accepts the dependency in the package or in the workspace root.

**Other options.**

| Option                 | Effect                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--ignore-file <path>` | Keep the managed ignore block somewhere other than `.prettierignore`, such as `.configs/.prettierignore`. `init` creates it there and writes the Prettier scripts with `--ignore-path .gitignore --ignore-path <path>` (`--ignore-path` replaces Prettier's defaults, so `.gitignore` is passed too); `check` and `sync` read it there |
| `--scripts <name>`     | `init` only: `fleet` (default) adds `format` and `format:check`, `prettier` adds `prettier:write` and `prettier:check`. A pair is never added when either of its names already exists, and `check` treats the two pairs as equivalent                                                                                                  |
| `--root`               | With `--workspaces`, also run in the workspace root                                                                                                                                                                                                                                                                                    |

**Worked example.** A pnpm workspace with two packages, `packages/api` (which already has a `test` script) and `packages/web`:

```text
acme/
├── pnpm-workspace.yaml     packages: ["packages/*"]
├── pnpm-lock.yaml
├── package.json
└── packages/
    ├── api/package.json    "scripts": { "test": "vitest run" }
    └── web/package.json
```

```text
$ npx cldmv-configs init --workspaces --scripts prettier
packages/api: created 5 file(s), added 6 script(s), kept 1
  created  .configs/fix-headers.json: created
  …
  added    prettier:write: prettier --config .configs/prettier.config.mjs --write .
  …
  hint     @cldmv/configs: not installed yet; install it (init never installs): pnpm add -D @cldmv/configs@latest --filter @acme/api
packages/web: created 5 file(s), added 7 script(s), kept 0
  …
2 package(s): 2 ok, 0 with problems (0 problem(s), 0 warning(s))
2 package(s) lack @cldmv/configs; to add it to every package at once: pnpm add -D @cldmv/configs@latest -r

$ npx cldmv-configs check --workspaces
packages/api: FAIL (1 problem(s), 1 warning(s))
  problem  @cldmv/configs: imported by a .configs/ stub but not in this package's dependencies (pnpm does not hoist it into packages); install it: pnpm add -D @cldmv/configs@latest --filter @acme/api
  warning  test: does not reference .configs/vitest.config.mjs
packages/web: FAIL (1 problem(s), 0 warning(s))
  problem  @cldmv/configs: imported by a .configs/ stub but not in this package's dependencies (pnpm does not hoist it into packages); install it: pnpm add -D @cldmv/configs@latest --filter @acme/web
2 package(s): 0 ok, 2 with problems (2 problem(s), 1 warning(s))
[exit 1]

$ pnpm add -D @cldmv/configs@latest -r
$ npx cldmv-configs check --workspaces
packages/api: ok (0 problem(s), 1 warning(s))
  warning  test: does not reference .configs/vitest.config.mjs
packages/web: ok (0 problem(s), 0 warning(s))
2 package(s): 2 ok, 0 with problems (0 problem(s), 1 warning(s))
[exit 0]
```

`api` keeps its own `test` script, so `check` warns that it does not reference the shared Vitest stub; the warning does not fail the check unless `--strict` is passed. A repository with its own shared Vitest helper, as in the [Vitest](#vitest) section, keeps its `test.include` and merges only the base's coverage settings.

---

## ➕ Adding a config

1. Add the file at the package root, named after the tool it configures (`<tool>.json`, or the filename the tool expects for an ESLint or Vitest module). Keep any imports it needs to a minimum, and add those packages to `dependencies`; add the tool itself as an optional peer.
2. List it in `package.json` `files` and expose it in `exports` under its own filename (`"./<tool>.json": "./<tool>.json"`).
3. Add it to `dist_paths` in `.github/workflows/bundle-size.yml`.
4. Add a row to the [Configs](#-configs) table and a section describing its keys.
5. Add tests under `tests/` that check the keys against what the tool accepts.
6. If consumers need a stub file or npm script for it, add them to the `STUBS` and `SCRIPTS` lists in `bin/cldmv-configs.mjs`, so `init` creates them and `check` verifies them.

The suite already checks that every exported JSON file parses, that every `exports` entry ships, and that `npm pack` publishes exactly the intended files. That last check lists those files explicitly, so a new config also goes into its expected list.

---

## 🔢 Versioning

Consumers pick up a changed default the next time they update, so a change to a shared value is a change in behavior for every repository that extends it.

- **Minor**: adding a config, or a key that only makes a tool stricter where it was silent.
- **Major**: changing or removing an existing value in a way that alters what the tool writes.
- **Patch**: documentation, tests and tooling with no change to any shipped file's settings.

---

## 🛠 Development

```sh
npm install
npm test            # the vitest suite, via @cldmv/vitest-runner
npm run coverage    # the suite with coverage
npm run lint        # eslint
npm run format      # prettier --write
npm run build:ci    # lint + format:check, as CI runs it
```

The repository follows the CLDMV v4 release flow: work branches off `next` and merges there, and `next` ships to `master` through a release PR that publishes to npm.

---

## 🤝 Contributing

Issues and pull requests are welcome. Branch from `next` with a conventional prefix (`feat/`, `fix/`, `docs/`, …); pushing the branch opens its pull request into `next` automatically.

[![Contributors]][contributors_url] [![Sponsor shinrai]][sponsor_url]

---

## 🔗 Links

- **npm**: [@cldmv/configs](https://www.npmjs.com/package/@cldmv/configs)
- **GitHub**: [CLDMV/configs](https://github.com/CLDMV/configs)
- **Issues**: [GitHub Issues](https://github.com/CLDMV/configs/issues)
- **Releases**: [GitHub Releases](https://github.com/CLDMV/configs/releases)
- **fix-headers**: [CLDMV/fix-headers](https://github.com/CLDMV/fix-headers)

---

## 📄 License

[![GitHub license]][github_license_url] [![npm license]][npm_license_url]

Apache-2.0 © Shinrai / CLDMV

[npm version]: https://img.shields.io/npm/v/%40cldmv%2Fconfigs.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_version_url]: https://www.npmjs.com/package/@cldmv/configs
[npm downloads]: https://img.shields.io/npm/dm/%40cldmv%2Fconfigs.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_downloads_url]: https://www.npmjs.com/package/@cldmv/configs
[last commit]: https://img.shields.io/github/last-commit/CLDMV/configs?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[last_commit_url]: https://github.com/CLDMV/configs/commits
[npm last update]: https://img.shields.io/npm/last-update/%40cldmv%2Fconfigs?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_last_update_url]: https://www.npmjs.com/package/@cldmv/configs
[coverage]: https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FCLDMV%2Fconfigs%2Fbadges%2Fcoverage.json&style=for-the-badge&logo=vitest&logoColor=white
[coverage_url]: https://github.com/CLDMV/configs/blob/badges/coverage.json
[contributors]: https://img.shields.io/github/contributors/CLDMV/configs.svg?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[contributors_url]: https://github.com/CLDMV/configs/graphs/contributors
[sponsor shinrai]: https://img.shields.io/github/sponsors/shinrai?style=for-the-badge&logo=githubsponsors&logoColor=white&labelColor=EA4AAA&label=Sponsor
[sponsor_url]: https://github.com/sponsors/shinrai
[github license]: https://img.shields.io/github/license/CLDMV/configs.svg?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[github_license_url]: https://github.com/CLDMV/configs/blob/HEAD/LICENSE
[npm license]: https://img.shields.io/npm/l/%40cldmv%2Fconfigs.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_license_url]: https://www.npmjs.com/package/@cldmv/configs
