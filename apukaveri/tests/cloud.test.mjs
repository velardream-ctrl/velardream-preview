import assert from "node:assert/strict";
import test from "node:test";
import cloud from "../server/cloud.mjs";
import { database } from "../server/local.mjs";

test("local Cloudflare entry serves the sandbox and protects owner assets", async () => {
  const calls = [];
  const env = {
    MODE: "synthetic",
    DB: database(),
    ASSETS: {
      fetch(request) {
        const path = new URL(request.url).pathname;
        calls.push(path);
        return new Response(path);
      },
    },
  };
  const local = (path, headers) =>
    cloud.fetch(new Request("http://localhost" + path, { headers }), env);

  assert.equal(await (await local("/")).text(), "/index.html");
  assert.equal(await (await local("/sandbox.html")).text(), "/sandbox.html");
  assert.equal((await (await local("/api/categories")).json()).length, 18);
  assert.ok([401, 403].includes((await local("/admin")).status));
  assert.equal((await local("/admin.html")).status, 404);
  assert.equal((await local("/%61dmin.html")).status, 404);
  assert.equal((await cloud.fetch(new Request("https://example.invalid/"), env)).status, 403);
  assert.deepEqual(calls, ["/index.html", "/sandbox.html"]);

  const session = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const hash = Buffer.from(await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(session),
  )).toString("hex");
  await env.DB.prepare("INSERT INTO accounts(email,password,owner) VALUES(?,?,1)")
    .bind("demo-owner@example.invalid", "test fixture").run();
  await env.DB.prepare("INSERT INTO tokens(hash,user,purpose,expires) VALUES(?,1,'session',?)")
    .bind(hash, Date.now() + 60000).run();
  const owner = await local("/admin", { Cookie: "ak_session=" + session });
  assert.equal(await owner.text(), "/admin.html");
  assert.equal(owner.headers.get("Cache-Control"), "private, no-store");
});
