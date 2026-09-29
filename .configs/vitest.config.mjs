/**
 *	@Project: @cldmv/configs
 *	@Filename: /.configs/vitest.config.mjs
 *	@Date: 2026-09-28 21:22:58 -07:00 (1790655778)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 21:25:47 -07:00 (1790655947)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Anchor the project root to the package directory so include/exclude work no
// matter what cwd vitest is invoked from.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig({
	root,
	test: {
		include: ["tests/**/*.test.vitest.mjs"],
		exclude: ["node_modules"],
		environment: "node",
		testTimeout: 30000,
		reporters: ["dot"],
		coverage: {
			provider: "v8",
			// The package ships JSON data only — no executable source — so coverage
			// has nothing of the package's own to measure. The suite validates the
			// shipped files directly (parse, option names, exports, pack contents).
			include: ["*.mjs"],
			exclude: ["tests/**", ".configs/**", ".githooks/**"],
			reporter: ["text", "html", "json-summary", "json"]
		}
	}
});
