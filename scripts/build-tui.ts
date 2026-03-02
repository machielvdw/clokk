/**
 * Pre-compiles TUI .tsx/.ts files with Babel so they work in compiled binaries.
 *
 * The SolidJS Bun plugin (babel-preset-solid) runs JSX transforms at runtime,
 * which doesn't work in `bun build --compile`. This script runs the same
 * transforms ahead of time, outputting plain .js files to .build/tui/.
 */

import { transformAsync } from "@babel/core";
// @ts-expect-error - no types
import solid from "babel-preset-solid";
// @ts-expect-error - no types
import ts from "@babel/preset-typescript";
// @ts-expect-error - no types
import moduleResolver from "babel-plugin-module-resolver";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, relative, join } from "node:path";
import { Glob } from "bun";

const SRC_DIR = "src/tui";
const OUT_DIR = ".build/tui";

// Clean output directory
const { rmSync } = await import("node:fs");
rmSync(OUT_DIR, { recursive: true, force: true });

// Find all .ts and .tsx files
const glob = new Glob("**/*.{ts,tsx}");
const files: string[] = [];
for await (const file of glob.scan({ cwd: SRC_DIR })) {
  files.push(file);
}

console.log(`Pre-compiling ${files.length} TUI files...`);

for (const file of files) {
  const srcPath = join(SRC_DIR, file);
  const code = readFileSync(srcPath, "utf-8");

  // Skip index.ts — we generate a custom version below
  if (file === "index.ts") continue;

  const result = await transformAsync(code, {
    filename: srcPath,
    presets: [
      [solid, { moduleName: "@opentui/solid", generate: "universal" }],
      [ts, { isTSX: true, allExtensions: true }],
    ],
    plugins: [
      [
        moduleResolver,
        {
          alias: { "@": "./src" },
          resolvePath(sourcePath: string, currentFile: string) {
            if (!sourcePath.startsWith("@/")) return sourcePath;

            const resolved = sourcePath.replace("@/", "src/");
            const fromDir = dirname(currentFile);
            let rel = relative(fromDir, resolved);
            if (!rel.startsWith(".")) rel = "./" + rel;

            // Intra-TUI imports: rewrite to .js (the pre-compiled output)
            if (rel.match(/\.\//) && !rel.match(/\.\.\//)) {
              return rel.replace(/\.tsx?$/, ".js");
            }
            // Non-TUI imports: keep @/ alias so the bundler can resolve them
            return sourcePath;
          },
        },
      ],
    ],
  });

  if (!result?.code) {
    console.error(`Failed to transform ${file}`);
    process.exit(1);
  }

  // Rewrite extensions in the output:
  // - Intra-TUI imports (./xxx) → .js (point to pre-compiled files)
  // - Non-TUI relative imports (../core/xxx.ts) → @/core/xxx.ts (bundler resolves these)
  let output = result.code;
  output = output.replace(
    /(from\s+["'])(\.\.?\/.+?)(\.tsx?)(["'])/g,
    (_match, pre, path, ext, post) => {
      if (path.startsWith("./")) {
        // Intra-TUI: rewrite extension to .js
        return `${pre}${path}.js${post}`;
      }
      // Non-TUI relative (../core/, ../cli/, etc): convert back to @/ alias
      // ../core/errors.ts → @/core/errors.ts (from src/tui/ perspective)
      const aliased = path.replace(/^\.\.\//, "@/");
      return `${pre}${aliased}${ext}${post}`;
    },
  );

  const outPath = join(OUT_DIR, file.replace(/\.tsx?$/, ".js"));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output, "utf-8");
}

// Generate index.js — skips plugin registration, sets dylib path for compiled binary
const indexCode = `import { setRenderLibPath } from "@opentui/core";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";

// In compiled binary, the native lib is side-loaded to ~/.clokk/lib/
const libExt = process.platform === "darwin" ? "dylib" : "so";
const libPath = join(homedir(), ".clokk", "lib", \`libopentui.\${libExt}\`);
if (existsSync(libPath)) {
  setRenderLibPath(libPath);
}

export async function launchTui() {
  const { startApp } = await import("./render.js");
  await startApp();
}
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "index.js"), indexCode, "utf-8");

console.log(`Pre-compiled ${files.length} files to ${OUT_DIR}/`);
