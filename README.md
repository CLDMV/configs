# @cldmv/configs

[![npm version](https://img.shields.io/npm/v/@cldmv/configs.svg)](https://www.npmjs.com/package/@cldmv/configs) [![License](https://img.shields.io/github/license/CLDMV/configs.svg)](LICENSE)

Shared tool configurations for CLDMV repositories.

Every CLDMV repository runs the same tools with the same house settings. Rather than copy those settings into each repo, where the copies drift apart, the canonical versions live here as plain JSON files. A repo points its tool at the shared file and keeps only its own overrides locally.

The package has no runtime code and no dependencies. It ships the config files, this README, the license and `package.json`, nothing else.

## Configs

| File                                   | Tool                                                         | Specifier                         | What it sets                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [`fix-headers.json`](fix-headers.json) | [`@cldmv/fix-headers`](https://github.com/CLDMV/fix-headers) | `@cldmv/configs/fix-headers.json` | CLDMV's standard file-header options: author and company identity, copyright range, and the created-date checks |

Each file is exposed through `package.json` `exports`, so it resolves by its specifier from any project that installs the package, and is also reachable by URL straight from this repository.

## fix-headers.json

```json
{
	"includeFolders": ["."],
	"useGpgSignerAuthor": true,
	"company": "CLDMV",
	"companyName": "Catalyzed Motivation Inc.",
	"copyrightStartYear": 2013,
	"forceAuthorUpdate": true,
	"forceLastModifiedAuthorUpdate": true,
	"fixCreatedDate": true,
	"normalizeDateFormat": true,
	"strictCreatedDate": true
}
```

| Option                          | Value                         | Effect                                                                                                              |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `includeFolders`                | `["."]`                       | Scan the whole project; ignore files (`.gitignore` and friends) still exclude what they list                        |
| `useGpgSignerAuthor`            | `true`                        | Take the `@Author` name from the user ID of the OpenPGP key git signs commits with                                  |
| `company`                       | `"CLDMV"`                     | Write `@Author` as `Name <CLDMV>`                                                                                   |
| `companyName`                   | `"Catalyzed Motivation Inc."` | The copyright holder in `@Copyright`                                                                                |
| `copyrightStartYear`            | `2013`                        | The first year of the `@Copyright` range                                                                            |
| `forceAuthorUpdate`             | `true`                        | Always rewrite `@Author` / `@Email` to the detected values                                                          |
| `forceLastModifiedAuthorUpdate` | `true`                        | Always rewrite `@Last modified by` to the detected values                                                           |
| `fixCreatedDate`                | `true`                        | Move an existing `@Date` back to the oldest of itself, the file's first git commit and its filesystem creation time |
| `normalizeDateFormat`           | `true`                        | Write every header date in the git `%aI` form (`2026-03-01T17:59:32-08:00`)                                         |
| `strictCreatedDate`             | `true`                        | With `--check`, fail on a `@Date` later than the file's first commit or creation time instead of only warning       |

The full description of every option is in the [fix-headers README](https://github.com/CLDMV/fix-headers#readme). `fixCreatedDate`, `normalizeDateFormat` and `strictCreatedDate` arrive in fix-headers v2.0.0 ([CLDMV/fix-headers#67](https://github.com/CLDMV/fix-headers/pull/67)); older releases ignore them.

### Using it from npm

Install the package as a devDependency next to fix-headers:

```sh
npm install --save-dev @cldmv/configs@latest @cldmv/fix-headers@latest
```

Then extend the shared file from the repo's own config, `.configs/fix-headers.json`:

```json
{
	"extends": "@cldmv/configs/fix-headers.json"
}
```

and run fix-headers against that file, normally through an npm script:

```json
{
	"scripts": {
		"fix:headers": "fix-headers --config .configs/fix-headers.json"
	}
}
```

Resolving `extends` by package specifier needs a fix-headers release with `extends` support, which is being built in [CLDMV/fix-headers#87](https://github.com/CLDMV/fix-headers/issues/87).

### Using it by URL

Without installing the package, `extends` can point at the raw file in this repository. Pin the URL to a release tag so the settings only change when the repo chooses to move to a newer tag:

```json
{
	"extends": "https://raw.githubusercontent.com/CLDMV/configs/v1.0.0/fix-headers.json"
}
```

Release tags follow the package version (`vX.Y.Z`); the [releases page](https://github.com/CLDMV/configs/releases) lists them. A URL on `master` instead of a tag always follows the latest shipped settings, which is rarely what a repo wants.

### Overriding keys

A key set in the repo's own `.configs/fix-headers.json` overrides the same key from the shared file, and every key it leaves out keeps the shared value. A repo that should only scan its source and scripts, for example:

```json
{
	"extends": "@cldmv/configs/fix-headers.json",
	"includeFolders": ["src", "scripts", { "path": ".", "recursive": false }]
}
```

Keep overrides to what is genuinely specific to the repo. A setting every repo would want belongs in the shared file.

## Adding a config

1. Add the file at the package root, named after the tool it configures (`<tool>.json`).
2. List it in `package.json` `files` and expose it in `exports` as `"./<tool>.json": "./<tool>.json"`.
3. Add it to `dist_paths` in `.github/workflows/bundle-size.yml`.
4. Add a row to the table above and a section describing its keys.
5. Add tests under `tests/` that check the keys against what the tool accepts.

The suite already checks that every exported JSON file parses, that every `exports` entry ships, and that `npm pack` publishes exactly the intended files; the last check lists those files explicitly, so a new config also goes into its expected list.

## Versioning

Consumers pick up a changed default the next time they update, so a change to a shared value is a change in behavior for every repo that extends it. Adding a config or a key that only makes a tool stricter where it was already silent is a minor release; changing or removing an existing value that alters what the tool writes is treated as breaking.

## Development

```sh
npm install
npm test            # the vitest suite, via @cldmv/vitest-runner
npm run coverage    # the suite with coverage
npm run lint        # eslint
npm run format      # prettier --write
npm run build:ci    # lint + format:check, as CI runs it
```

The repo follows the CLDMV v4 release flow: work branches off `next` and merges there, and `next` ships to `master` through a release PR that publishes to npm.

## License

[Apache-2.0](LICENSE)
