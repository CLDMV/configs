# @cldmv/configs

**@cldmv/configs** is the single source of CLDMV's shared tool configurations. Every CLDMV repository runs the same tools with the same house settings; instead of copying those settings into each repository, where the copies drift apart, the canonical versions live here as plain JSON files that each repository extends.

A repository points its tool at the shared file and keeps only its own overrides locally. When a house setting changes, it changes here once, and every repository picks it up on its next update.

The package has no runtime code and no dependencies. It ships the config files, this README, the license and `package.json`, and nothing else.

[![npm version]][npm_version_url] [![npm downloads]][npm_downloads_url] [![Last commit]][last_commit_url] [![npm last update]][npm_last_update_url] [![coverage]][coverage_url]

[![Contributors]][contributors_url] [![Sponsor shinrai]][sponsor_url]

---

## ✨ What's New

### Latest: v1.2.3 (October 2026)

- **Headers restamped under fix-headers 2.1.4** — the repository's own header pass now runs on `@cldmv/fix-headers` 2.1.4 and restamped 37 internal files: dates are written in ISO 8601 form, 23 `@Date` timestamps that did not match their written date (the Dependabot config and 22 workflows copied from the `CLDMV/.github` templates) were corrected, and each header gained the empty frame line inside its opening and closing. The published `fix-headers.json` and every shipped setting are unchanged (#12).
- [View full v1.2.3 Changelog](https://github.com/CLDMV/configs/blob/master/docs/changelog/v1/v1.2.3.md)

### Recent Releases

- **v1.2.2** (October 2026) — the CI `✅ Required PR Check` mirror job runs on every path instead of being skipped on in-repo PRs (#10) ([Changelog](https://github.com/CLDMV/configs/blob/master/docs/changelog/v1/v1.2.2.md))
- **v1.2.1** (October 2026) — a skipped PR run no longer satisfies the `✅ Required PR Check` ruleset (#8) ([Changelog](https://github.com/CLDMV/configs/blob/master/docs/changelog/v1/v1.2.1.md))
- **v1.2.0** (October 2026) — the shared `fix-headers.json` sets `margin: 1`, so fix-headers and Prettier agree on one blank line after a header; this changes fix-headers 2.1+ output for extending repositories (#7) ([Changelog](https://github.com/CLDMV/configs/blob/master/docs/changelog/v1/v1.2.0.md))
- **v1.1.1** (September 2026) — the README is rewritten in the CLDMV package style (#3) ([Changelog](https://github.com/CLDMV/configs/blob/master/docs/changelog/v1/v1.1.1.md))

📚 **For complete version history, see [docs/changelog/](https://github.com/CLDMV/configs/tree/master/docs/changelog/) and the [GitHub Releases](https://github.com/CLDMV/configs/releases).**

---

## 🚀 Key Features

- **One source of truth** — each house setting is defined once, here, instead of in a copy per repository.
- **Plain JSON** — no runtime code and no dependencies; the tool reads the file directly.
- **Two ways to consume it** — by package specifier through `package.json` `exports` (`@cldmv/configs/fix-headers.json`), or by a raw GitHub URL pinned to a release tag.
- **Local overrides** — a repository's own config extends the shared file and overrides only the keys that are genuinely specific to it.
- **Tested** — the suite checks that every exported file parses, that every `exports` entry ships, that the settings are ones the tool accepts, and that `npm pack` publishes exactly the intended files.

---

## 📦 Installation

### Requirements

- A tool that can extend a shared config. For fix-headers that is **v2.0.0 or later**: `extends` arrives in [CLDMV/fix-headers#88](https://github.com/CLDMV/fix-headers/pull/88), and several of the options this config sets (`fixCreatedDate`, `normalizeDateFormat`, `strictCreatedDate`) in [CLDMV/fix-headers#67](https://github.com/CLDMV/fix-headers/pull/67). Older releases cannot resolve `extends` and ignore those options.

### Install

Install the package as a devDependency next to the tool it configures:

```sh
npm install --save-dev @cldmv/configs@latest @cldmv/fix-headers@latest
```

---

## 🚀 Quick Start

Create the repository's own config, `.configs/fix-headers.json`, extending the shared file:

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

---

## 📋 Configs

| File                                   | Tool                                                         | Specifier                         | What it sets                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [`fix-headers.json`](fix-headers.json) | [`@cldmv/fix-headers`](https://github.com/CLDMV/fix-headers) | `@cldmv/configs/fix-headers.json` | CLDMV's standard file-header options: author and company identity, copyright range, and the created-date checks |

Each file is exposed through `package.json` `exports`, so it resolves by its specifier from any project that installs the package, and is also reachable by URL straight from this repository.

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
	"forceLastModifiedAuthorUpdate": true,
	"fixCreatedDate": true,
	"normalizeDateFormat": true,
	"strictCreatedDate": true,
	"margin": 1
}
```

| Option                          | Value                         | Effect                                                                                                                                |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `includeFolders`                | `["."]`                       | Scan the whole project; ignore files (`.gitignore` and everything else git honours) still exclude what they list                      |
| `useGpgSignerAuthor`            | `true`                        | Take the `@Author` name from the user ID of the OpenPGP key git signs commits with                                                    |
| `company`                       | `"CLDMV"`                     | Write `@Author` as `Name <CLDMV>`                                                                                                     |
| `companyName`                   | `"Catalyzed Motivation Inc."` | The copyright holder in `@Copyright`. fix-headers v2 has no built-in holder and otherwise reads it from the manifest author (`CLDMV`) |
| `copyrightStartYear`            | `2013`                        | The first year of the `@Copyright` range, for every file                                                                              |
| `forceAuthorUpdate`             | `false`                       | Never rewrite an existing `@Author` / `@Email`; they record who created the file. A missing value is still filled in                  |
| `forceLastModifiedAuthorUpdate` | `true`                        | Always rewrite `@Last modified by` to the detected values                                                                             |
| `fixCreatedDate`                | `true`                        | Move an existing `@Date` back to the oldest of itself, the file's first git commit and its filesystem creation time                   |
| `normalizeDateFormat`           | `true`                        | Write every header date in the git `%aI` form (`2026-03-01T17:59:32-08:00`)                                                           |
| `strictCreatedDate`             | `true`                        | With `--check`, fail on an `@Date` later than the file's first commit or creation time instead of only warning                        |
| `margin`                        | `1`                           | One blank line between the header and the file's next content. The fix-headers default is two, which prettier collapses to one        |

An existing `@Author` is never rewritten: it records who created the file, and this config sets `forceAuthorUpdate` to `false` explicitly so the decision is visible and wins over anything earlier in an `extends` chain. A repository can turn it on in its own config for a one-off migration of old author names.

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

## ➕ Adding a config

1. Add the file at the package root, named after the tool it configures (`<tool>.json`).
2. List it in `package.json` `files` and expose it in `exports` as `"./<tool>.json": "./<tool>.json"`.
3. Add it to `dist_paths` in `.github/workflows/bundle-size.yml`.
4. Add a row to the [Configs](#-configs) table and a section describing its keys.
5. Add tests under `tests/` that check the keys against what the tool accepts.

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
