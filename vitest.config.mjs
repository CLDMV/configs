/**
 *
 *	@Project: @cldmv/configs
 *	@Filename: /vitest.config.mjs
 *	@Date: 2026-10-11T12:30:24-07:00 (1791747024)
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
 * CLDMV's base Vitest config, exported as a plain object (no `defineConfig` call, no repository root) so a repository merges its own
 * settings over it with `mergeConfig`. Arrays such as `include` and `reporter` are concatenated by `mergeConfig`, not replaced.
 * Coverage `include` globs and thresholds are left to the repository.
 */
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
