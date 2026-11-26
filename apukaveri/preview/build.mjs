// node preview/build.mjs /path/to/sql.js/dist/sql-asm.js /path/to/esbuild /path/to/output.html
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
const [sqlite, esbuild, out] = process.argv.slice(2);
if (!out) throw Error("Arguments: sql-asm.js, esbuild executable, output HTML");
const root = new URL("../", import.meta.url),
  read = (file) => readFileSync(new URL(file, root), "utf8");
const schema = readdirSync(new URL("server/migrations/", root))
  .sort()
  .map((name) => read("server/migrations/" + name))
  .join("\n");
const bundle = execFileSync(
  resolve(esbuild),
  [
    "server/worker.mjs",
    "--bundle",
    "--format=iife",
    "--global-name=ApukaveriWorker",
  ],
  { cwd: root, encoding: "utf8" },
);
const script = (source, module = false) =>
  "<script" +
  (module ? ' type="module"' : "") +
  ">" +
  source.replace(/<\/script/gi, "<\\/script") +
  "</script>";
let html = read("admin.html").replaceAll(
  "/logo.svg",
  "data:image/svg+xml;base64," +
    Buffer.from(read("logo.svg")).toString("base64"),
);
const license = readFileSync(resolve(dirname(sqlite), "../LICENSE"), "utf8");
html = html.replace(
  '<script type="module" src="/owner.mjs"></script>',
  () =>
    script(
      "/* sql.js license\n" + license + "\n*/\n" + readFileSync(sqlite, "utf8"),
    ) +
    script(bundle) +
    script("window.demoSchema=" + JSON.stringify(schema)) +
    script(read("preview/offline.mjs") + "\n" + read("owner.mjs"), true),
);
writeFileSync(out, html);
