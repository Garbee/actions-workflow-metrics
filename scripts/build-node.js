import { promises as fs } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const entrypoints = [
  { dirName: "main", baseFileName: "index" },
  { dirName: "main", baseFileName: "server" },
  { dirName: "post", baseFileName: "index" },
];

// Build all entry points
for (const entry of entrypoints) {
  const entryPath = join("src", entry.dirName, `${entry.baseFileName}.ts`);
  const outdir = join("dist", entry.dirName);
  const outfile = join(outdir, `${entry.baseFileName}.bundle.js`);

  await build({
    entryPoints: [entryPath],
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    outfile: outfile,
    sourcemap: "linked",
    packages: "bundle",
  });

  // Create wrapper file
  await fs.writeFile(
    join(outdir, `${entry.baseFileName}.js`),
    `process.setSourceMapsEnabled(true);
await import("./${entry.baseFileName}.bundle.js");
`,
  );

  // Fix source map paths
  const sourceMapPath = `${outfile}.map`;
  try {
    const sourceMap = JSON.parse(await fs.readFile(sourceMapPath, "utf-8"));
    sourceMap.sourceRoot = "../";
    await fs.writeFile(sourceMapPath, JSON.stringify(sourceMap));
  } catch (err) {
    console.warn(`Warning: Could not fix source map for ${sourceMapPath}`);
  }
}

console.log("Build succeeded");
