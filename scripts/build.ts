import { promises as fs } from "node:fs";
import { join } from "node:path";
import * as esbuild from "esbuild";

const entrypoints: { dirName: string; baseFileName: string }[] = [
  { dirName: "main", baseFileName: "index" },
  { dirName: "main", baseFileName: "collector" },
  { dirName: "post", baseFileName: "index" },
];

try {
  await esbuild.build({
    entryPoints: entrypoints.map((e) =>
      join("src", e.dirName, `${e.baseFileName}.ts`),
    ),
    outdir: "dist",
    platform: "node",
    format: "esm",
    sourcemap: false,
    bundle: true,
    entryNames: "[dir]/[name].bundle",
    banner: {
      js: `import { createRequire } from 'module';const require = createRequire(import.meta.url);`,
    },
  });
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}

console.log("Build succeeded");
