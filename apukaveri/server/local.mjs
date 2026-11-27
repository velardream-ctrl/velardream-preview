import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import worker from "./worker.mjs";
export function database(file = ":memory:") {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys=ON");
  const migrations = new URL("./migrations/", import.meta.url);
  db.exec("CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY)");
  for (const name of readdirSync(migrations)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (db.prepare("SELECT 1 FROM local_migrations WHERE name=?").get(name))
      continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      // A database from the initial RUN-005 revision already contains 0001.
      if (
        name !== "0001.sql" ||
        !db.prepare("SELECT 1 FROM sqlite_master WHERE name='accounts'").get()
      )
        db.exec(readFileSync(new URL(name, migrations), "utf8"));
      db.prepare("INSERT INTO local_migrations VALUES(?)").run(name);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return {
    prepare(query) {
      return {
        bind(...args) {
          const stmt = db.prepare(query);
          return {
            first: () => stmt.get(...args),
            all: () => ({ results: stmt.all(...args) }),
            run: () => {
              const r = stmt.run(...args);
              return {
                meta: {
                  changes: r.changes,
                  last_row_id: Number(r.lastInsertRowid),
                },
              };
            },
          };
        },
      };
    },
    batch(ops) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const out = ops.map((x) => x.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
if (import.meta.main) {
  const port = Number(process.env.PORT || 8787),
    origin = "http://127.0.0.1:" + port;
  const env = {
    MODE: "synthetic",
    DB: database(process.env.APUKAVERI_DB || ":memory:"),
    deliver: (email, purpose, code) =>
      console.log("TEST MAIL", email, purpose, code),
  };
  const files = {
    "/": "index.html",
    "/index.html": "index.html",
    "/helper-profile.js": "helper-profile.js",
    "/account.html": "account.html",
    "/account.webmanifest": "account.webmanifest",
    "/account-worker.js": "account-worker.js",
    "/dispatch.html": "dispatch.html",
    "/location-select.mjs": "location-select.mjs",
    "/finnish-cities.mjs": "finnish-cities.mjs",
    "/availability.mjs": "availability.mjs",
    "/sandbox.html": "sandbox.html",
    "/registration-terms.mjs": "registration-terms.mjs",
    "/sandbox.mjs": "sandbox.mjs",
    "/admin": "admin.html",
    "/owner.mjs": "owner.mjs",
    "/service-categories.mjs": "service-categories.mjs",
    "/profile-languages.mjs": "profile-languages.mjs",
    "/profile-tools.mjs": "profile-tools.mjs",
    "/helsinki.mjs": "helsinki.mjs",
    "/logo.svg": "logo.svg",
    "/manifest.webmanifest": "manifest.webmanifest",
    "/sw.js": "sw.js",
    "/icon192.png": "icon192.png",
    "/icon512.png": "icon512.png",
  };
  createServer(async (input, output) => {
    try {
      if (input.headers.host !== new URL(origin).host) {
        output.writeHead(403).end();
        return;
      }
      const path = new URL(input.url, origin).pathname;
      if (path.startsWith("/api/")) {
        let body = "";
        for await (const chunk of input) {
          body += chunk;
          if (body.length > 16384) {
            output.writeHead(413).end();
            return;
          }
        }
        const r = await worker.fetch(
          new Request(origin + input.url, {
            method: input.method,
            headers: input.headers,
            ...(body ? { body } : {}),
          }),
          env,
        );
        output.writeHead(r.status, Object.fromEntries(r.headers));
        output.end(await r.text());
        return;
      }
      if (path === "/admin") {
        const check = await worker.fetch(
          new Request(origin + "/api/admin", {
            headers: { cookie: input.headers.cookie || "" },
          }),
          env,
        );
        if (!check.ok) {
          output
            .writeHead(check.status, {
              "Cache-Control": "no-store",
              "Content-Type": "text/plain; charset=utf-8",
            })
            .end("Apukaveri · " + check.status);
          return;
        }
      }
      if (!Object.hasOwn(files, path)) {
        output.writeHead(404).end();
        return;
      }
      const file = files[path],
        type = file.endsWith(".html")
          ? "text/html"
          : file.endsWith(".png")
            ? "image/png"
            : file.endsWith(".webmanifest")
              ? "application/manifest+json"
              : file.endsWith(".svg")
                ? "image/svg+xml"
                : "text/javascript";
      output.writeHead(200, {
        "Content-Type": type + "; charset=utf-8",
        "Cache-Control": "no-store",
      });
      output.end(readFileSync(new URL("../" + file, import.meta.url)));
    } catch {
      output.writeHead(500).end();
    }
  }).listen(port, "127.0.0.1", () => console.log(origin + "/sandbox.html"));
}
