import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";

const root = new URL("./", import.meta.url);
const server = process.argv.includes("--server");
const output = new URL(server ? "./server-build/" : "./public-build/", root);
await mkdir(output, { recursive: true });
const files = [
  "index.html", "location-select.mjs", "finnish-cities.mjs", "logo.svg", "icon192.png", "icon512.png"
];
if (server) files.push(
  "account.html", "dispatch.html", "availability.mjs", "helper-profile.js",
  "sandbox.html", "sandbox.mjs", "admin.html", "owner.mjs",
  "profile-tools.mjs", "helsinki.mjs", "manifest.webmanifest", "sw.js"
);
await Promise.all(files.map(file => copyFile(new URL(file, root), new URL(file, output))));
if (!server) {
  const retired = ["account.html", "dispatch.html", "availability.mjs", "helper-profile.js"];
  await Promise.all(retired.map(file => rm(new URL(file, output), { force: true })));
  await writeFile(new URL("_redirects", output),
    "/account.html / 302\n/account / 302\n/dispatch.html / 302\n/dispatch / 302\n");
}
