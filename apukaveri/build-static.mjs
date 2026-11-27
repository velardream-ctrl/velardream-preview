import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";

const root = new URL("./", import.meta.url);
const server = process.argv.includes("--server");
const output = new URL(server ? "./server-build/" : "./public-build/", root);
await mkdir(output, { recursive: true });
const files = [
  "index.html", "account.html", "account.webmanifest", "account-worker.js", "profile-tools.mjs", "availability.mjs", "helper-profile.js", "location-select.mjs", "finnish-cities.mjs", "logo.svg", "icon192.png", "icon512.png"
];
if (server) files.push(
  "dispatch.html",
  "sandbox.html", "sandbox.mjs", "admin.html", "owner.mjs",
  "helsinki.mjs", "manifest.webmanifest", "sw.js"
);
await Promise.all(files.map(file => copyFile(new URL(file, root), new URL(file, output))));
if (!server) {
  const retired = ["dispatch.html"];
  await Promise.all(retired.map(file => rm(new URL(file, output), { force: true })));
  await writeFile(new URL("_redirects", output),
    "/dispatch.html / 302\n/dispatch / 302\n");
}
