import { promises as fs } from "node:fs";
import { join } from "node:path";
import * as esbuild from "esbuild";

const entrypoints: { dirName: string; baseFileName: string }[] = [
  { dirName: "main", baseFileName: "index" },
  { dirName: "main", baseFileName: "server" },
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
    sourcemap: "linked",
    bundle: true,
    entryNames: "[dir]/[name].bundle",
    external: ["net", "tls", "http", "https", "stream", "zlib"],
  });
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}

await Promise.all([
  // Create wrapper files that enable source maps before importing the bundle
  ...entrypoints.map(
    async (e) =>
      await fs.writeFile(
        join("dist", e.dirName, `${e.baseFileName}.js`),
        `process.setSourceMapsEnabled(true);
await import("./${e.baseFileName}.bundle.js");
`,
      ),
  ),

  // Fix source map paths by adding sourceRoot to correct the relative path resolution
  ...entrypoints.map(async (e) => {
    const sourceMapPath = join(
      "dist",
      e.dirName,
      `${e.baseFileName}.bundle.js.map`,
    );
    const sourceMap: { sourceRoot?: string } = JSON.parse(
      await fs.readFile(sourceMapPath, "utf-8"),
    );

    // Add sourceRoot to go up one more level from dist/[dir]/ to project root
    sourceMap.sourceRoot = "../";
    return await fs.writeFile(sourceMapPath, JSON.stringify(sourceMap));
  }),
]);
console.log("Build succeeded");
