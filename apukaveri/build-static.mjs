import { copyFile, mkdir } from "node:fs/promises";

const root = new URL("./", import.meta.url);
const output = new URL("./public-build/", root);
await mkdir(output, { recursive: true });
const files = [
  "index.html", "account.html", "dispatch.html", "availability.mjs",
  "helper-profile.js", "logo.svg", "icon192.png", "icon512.png"
];
await Promise.all(files.map(file => copyFile(new URL(file, root), new URL(file, output))));
