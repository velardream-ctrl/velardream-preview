import assert from "node:assert/strict";
import test from "node:test";
import cloud from "../server/cloud.mjs";
import { database } from "../server/local.mjs";
import { password } from "../server/worker.mjs";

test("closed pilot checks Access authentication before serving assets or API", async (t) => {
  const algorithm = { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: Uint8Array.of(1, 0, 1), hash: "SHA-256" };
  const keys = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"]);
  const jwk = { ...await crypto.subtle.exportKey("jwk", keys.publicKey), kid: "test-key" };
  const issuer = "https://apukaveri-test.cloudflareaccess.com";
  const audience = "a".repeat(64);
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, issuer + "/cdn-cgi/access/certs");
    return Response.json({ keys: [jwk] });
  });
  const env = {
    MODE: "closed-pilot", PILOT_HOST: "pilot.example.invalid",
    ACCESS_ISSUER: issuer, ACCESS_AUDIENCE: audience, DB: database(),
    ASSETS: { fetch: async (request) => new Response(new URL(request.url).pathname) },
  };
  const email = "demo-owner@example.invalid";
  const fixturePassword = "synthetic password for tests";
  await env.DB.prepare("INSERT INTO accounts(email,password,verified,owner) VALUES(?,?,1,1)")
    .bind(email, await password(fixturePassword, crypto.randomUUID())).run();
  async function token(claims = {}) {
    const encode = data => Buffer.from(JSON.stringify(data)).toString("base64url");
    const value = encode({ alg: "RS256", kid: jwk.kid }) + "." + encode({
      aud: [audience], iss: issuer, type: "app", email: "owner@example.invalid",
      exp: Math.floor(Date.now() / 1000) + 60, ...claims,
    });
    const signature = await crypto.subtle.sign(algorithm, keys.privateKey, new TextEncoder().encode(value));
    return value + "." + Buffer.from(signature).toString("base64url");
  }
  const origin = "https://" + env.PILOT_HOST;
  const request = (path, assertion, { cookie = "", body } = {}) => cloud.fetch(
    new Request(origin + path, {
      headers: { ...(assertion ? { "Cf-Access-Jwt-Assertion": assertion } : {}),
        Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    }), env,
  );
  assert.equal((await request("/")).status, 403);
  assert.equal((await request("/api/categories")).status, 403);
  assert.equal((await request("/", await token({ aud: ["other"] }))).status, 403);
  assert.equal((await request("/", await token({ exp: 1 }))).status, 403);
  const valid = await token();
  assert.equal((await request("/", valid.slice(0, valid.lastIndexOf(".") + 1) + "AAAA")).status, 403);
  const page = await request("/", valid);
  assert.equal(await page.text(), "/sandbox.html");
  assert.equal(page.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await request("/api/register", valid, { body: {} })).status, 404);
  assert.equal((await request("/admin.html", valid)).status, 404);
  assert.equal((await request("/sw.js", valid)).status, 404);
  assert.equal((await request("/admin", valid)).status, 401);
  const login = await request("/api/login", valid, { body: { email, password: fixturePassword } });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("Set-Cookie"), /; Secure/);
  const cookie = login.headers.get("Set-Cookie").split(";")[0];
  assert.equal(await (await request("/admin", valid, { cookie })).text(), "/admin.html");
  assert.equal((await request("/admin", null, { cookie })).status, 403);
});
