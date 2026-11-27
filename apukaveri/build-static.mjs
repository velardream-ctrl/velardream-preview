import { copyFile, mkdir } from "node:fs/promises";

const root = new URL("./", import.meta.url);
const server = process.argv.includes("--server");
const output = new URL(server ? "./server-build/" : "./public-build/", root);
await mkdir(output, { recursive: true });
const files = [
  "index.html", "account.html", "dispatch.html", "availability.mjs",
  "location-select.mjs", "finnish-cities.mjs", "helper-profile.js", "logo.svg", "icon192.png", "icon512.png"
];
if (server) files.push(
  "sandbox.html", "sandbox.mjs", "admin.html", "owner.mjs",
  "profile-tools.mjs", "helsinki.mjs", "manifest.webmanifest", "sw.js"
);
await Promise.all(files.map(file => copyFile(new URL(file, root), new URL(file, output))));
