import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs";
import path from "node:path";

const SOURCE_ROOT = "packs/_source";
const PACKS_ROOT = "packs";

const mode = process.argv[2];
if (!["build", "extract"].includes(mode)) {
  console.error("Usage: node tools/packs.mjs <build|extract>");
  process.exit(1);
}

const packs = fs.readdirSync(SOURCE_ROOT, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name);

for (const pack of packs) {
  const source = path.join(SOURCE_ROOT, pack);
  const compiled = path.join(PACKS_ROOT, pack);
  if (mode === "build") {
    await compilePack(source, compiled, { log: true });
  } else {
    await extractPack(compiled, source, { log: true });
  }
}
