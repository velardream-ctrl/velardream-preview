import assert from "node:assert/strict";
import test from "node:test";
import cloud from "../server/cloud.mjs";
import { database } from "../server/local.mjs";
import { password } from "../server/worker.mjs";

test("closed pilot protects routes and supports orders in both owner roles", async (t) => {
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
  const [ownerEmail, customerEmail, helperEmail] = [
    "demo-owner@example.invalid", "demo-customer@example.invalid", "demo-helper@example.invalid",
  ];
  const fixturePassword = "synthetic password for tests";
  for (const [index, email] of [ownerEmail, customerEmail, helperEmail].entries()) {
    await env.DB.prepare("INSERT INTO accounts(email,password,verified,owner) VALUES(?,?,1,?)")
      .bind(email, await password(fixturePassword, crypto.randomUUID()), Number(index === 0)).run();
    await env.DB.prepare("INSERT INTO profiles(user) SELECT id FROM accounts WHERE email=?")
      .bind(email).run();
  }
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
  async function signIn(email) {
    const login = await request("/api/login", valid, { body: { email, password: fixturePassword } });
    assert.equal(login.status, 200);
    assert.match(login.headers.get("Set-Cookie"), /; Secure/);
    const cookie = login.headers.get("Set-Cookie").split(";")[0];
    return {
      cookie,
      send: (path, body) => request("/api/" + path, valid, { cookie, body }),
    };
  }
  const owner = await signIn(ownerEmail);
  const customer = await signIn(customerEmail);
  const helper = await signIn(helperEmail);
  assert.equal(await (await request("/admin", valid, { cookie: owner.cookie })).text(), "/admin.html");
  assert.equal((await request("/admin", null, { cookie: owner.cookie })).status, 403);
  assert.equal((await request("/admin", valid, { cookie: helper.cookie })).status, 403);
  assert.equal((await customer.send("admin/report")).status, 403);

  const schedule = {
    weekly: Object.fromEntries(Array.from({ length: 7 }, (_, day) =>
      [day, [{ start: "00:00", end: "24:00" }]],
    )),
  };
  for (const [actor, id] of [[owner, 1], [helper, 3]]) {
    const saved = await actor.send("profile", {
      alias: "Demo " + id, city: "Kitee", category: 3, schedule, available: true,
    });
    assert.equal(saved.status, 200);
  }

  const balance = async actor => (await (await actor.send("wallet")).json()).balance;
  for (const actor of [owner, customer]) {
    const topup = { cents: 4000, ref: crypto.randomUUID() };
    assert.equal((await actor.send("wallet/topup", topup)).status, 200);
    assert.equal((await actor.send("wallet/topup", topup)).status, 200);
    assert.equal(await balance(actor), 4000);
  }
  const base = Math.ceil(Date.now() / 60000) * 60000 + 3600000;
  for (const [index, [buyer, provider, target, outsider]] of [
    [owner, helper, 3, customer],
    [customer, owner, 1, helper],
  ].entries()) {
    const start = base + index * 7200000;
    const details = {
      kind: "planned", target, city: "Kitee", category: 3, start,
      end: start + 3600000, labour: 4000,
    };
    const booking = await buyer.send("orders", details);
    assert.equal(booking.status, 201);
    const { id, fee } = await booking.json();
    assert.equal(fee, 600);
    const inbox = await (await provider.send("inbox")).json();
    assert.ok(inbox.items.some(item => item.order_id === id && item.seen === null));
    assert.ok(!(await (await outsider.send("inbox")).json()).items.some(item => item.order_id === id));
    assert.equal((await outsider.send("claim", { id })).status, 409);
    assert.equal((await provider.send("claim", { id })).status, 200);
    assert.equal((await buyer.send("orders", details)).status, 409);
    assert.equal((await buyer.send("rating", { id, stars: 5 })).status, 403);
    assert.equal((await buyer.send("confirm", { id, topic: "completion", answer: "yes" })).status, 409);
    assert.equal((await outsider.send("wallet/pay", { id })).status, 409);
    assert.equal((await buyer.send("wallet/pay", { id })).status, 200);
    assert.equal((await buyer.send("wallet/pay", { id })).status, 200);
    assert.equal(await balance(buyer), 0);
    assert.equal(await balance(provider), 0);
    for (const actor of [provider, buyer]) {
      assert.equal((await actor.send("confirm", {
        id, topic: "completion", answer: "yes",
      })).status, 200);
    }
    assert.equal((await buyer.send("rating", { id, stars: 5 })).status, 201);
    const wallet = await (await provider.send("wallet")).json();
    assert.equal(wallet.balance, 3400);
    assert.equal(wallet.entries.filter(entry => entry.kind === "earning" && entry.order_id === id).length, 1);
  }
  const payout = { cents: 1000, ref: crypto.randomUUID() };
  assert.equal((await helper.send("wallet/withdraw", payout)).status, 200);
  assert.equal((await helper.send("wallet/withdraw", payout)).status, 200);
  assert.equal(await balance(helper), 2400);
  assert.equal((await helper.send("wallet/withdraw", { cents: 2500, ref: crypto.randomUUID() })).status, 409);

  const start = base + 14400000;
  const next = await (await helper.send("orders", {
    kind: "planned", target: 1, city: "Kitee", category: 3,
    start, end: start + 3600000, labour: 1000,
  })).json();
  assert.equal((await owner.send("claim", { id: next.id })).status, 200);
  assert.equal((await helper.send("wallet/pay", { id: next.id })).status, 200);
  assert.equal(await balance(helper), 1400);
  assert.equal((await owner.send("cancel", { id: next.id })).status, 200);
  assert.equal(await balance(helper), 2400);
  const report = await (await owner.send("admin/report")).json();
  assert.equal(report.orders.filter(order => order.completed).length, 2);
  assert.equal(report.totals.accrual, 1200);
  assert.equal(report.totals.payout, undefined);
});
