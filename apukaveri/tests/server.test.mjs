import { resolveHelsinki } from "../helsinki.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import worker, { covers } from "../server/worker.mjs";
import { database } from "../server/local.mjs";
test("Helsinki spring gap, repeated autumn hour, overrides and breaks", () => {
  assert.equal(resolveHelsinki("2026-03-29", "03:30"), null);
  assert.equal(
    resolveHelsinki("2026-10-25", "03:30", true) -
      resolveHelsinki("2026-10-25", "03:30"),
    3600000,
  );
  const sun = { weekly: { 0: [{ start: "03:00", end: "04:00" }] } };
  const check = (a, b) => covers(sun, Date.parse(a), Date.parse(b));
  assert(check("2026-10-25T00:00Z", "2026-10-25T02:00Z"));
  assert(!check("2026-03-29T00:00Z", "2026-03-29T02:00Z"));
  sun.overrides = { "2026-10-25": [] };
  assert(!check("2026-10-25T00:00Z", "2026-10-25T01:00Z"));
});
test("synthetic account, permissions, persistence, concurrent claims and reset", async () => {
  let mail;
  const env = {
    DB: database(),
    MODE: "synthetic",
    deliver: (e, p, c) => (mail = c),
  };
  const api = (path, data, cookie = "") =>
    worker.fetch(
      new Request("http://localhost/api/" + path, {
        method: data ? "POST" : "GET",
        headers: {
          Origin: "http://localhost",
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      }),
      env,
    );
  const password = "synthetic password only";
  async function signup(n) {
    const body = { email: "demo-" + n + "@example.invalid", password };
    assert.equal((await api("register", body)).status, 201);
    assert.equal((await api("login", body)).status, 401);
    assert.equal((await api("verify", { code: mail })).status, 200);
    assert.equal((await api("verify", { code: mail })).status, 400);
    return (await api("login", body)).headers.get("Set-Cookie").split(";")[0];
  }
  const [customer, p, q] = [await signup(1), await signup(2), await signup(3)];
  assert.equal((await api("admin", null, p)).status, 403);
  assert.equal((await api("me")).status, 401);
  env.DB.prepare("UPDATE accounts SET owner=1 WHERE id=1").bind().run();
  assert.equal((await api("admin", null, customer)).status, 200);
  const schedule = {
    weekly: Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [
        i,
        [{ start: "00:00", end: "24:00" }],
      ]),
    ),
  };
  for (const actor of [p, q])
    assert.equal(
      (
        await api(
          "profile",
          {
            alias: "Demo 1",
            city: "Kitee",
            category: 3,
            available: true,
            schedule,
          },
          actor,
        )
      ).status,
      200,
    );
  const start = Math.ceil(Date.now() / 60000) * 60000 + 3600000,
    order = {
      kind: "urgent",
      city: "Kitee",
      category: 3,
      start,
      end: start + 3600000,
    };
  assert.equal(
    (await api("orders", { ...order, category: 1 }, customer)).status,
    403,
  );
  const make = async () =>
    (await (await api("orders", order, customer)).json()).id;
  const id = await make();
  const race = await Promise.all([p, q].map((c) => api("claim", { id }, c)));
  assert.deepEqual(race.map((x) => x.status).sort(), [200, 409]);
  const winner = race[0].status === 200 ? p : q;
  assert.equal((await api("claim", { id: await make() }, winner)).status, 409);
  const later = {
    ...order,
    start: start + 7200000,
    end: start + 10800000,
    labour: 4000,
    reimbursement: 1255,
    audience: "favourites",
  };
  assert.equal(
    (await api("favourites", { helper: 2, enabled: true }, customer)).status,
    200,
  );
  const invoice = await (await api("orders", later, customer)).json();
  assert.deepEqual(
    [invoice.percent, invoice.fee, invoice.reimbursement],
    [15, 600, 1255],
  );
  assert.equal((await api("claim", { id: invoice.id }, q)).status, 409);
  assert.equal((await api("claim", { id: invoice.id }, p)).status, 200);
  const cat = { id: 3, fi: "Testi", ru: "Тест", en: "Test", commission: 8 };
  assert.equal((await api("admin/category", cat, p)).status, 403);
  assert.equal((await api("admin/category", cat, customer)).status, 200);
  const updated = (await (await api("categories")).json()).find(
    (c) => c.id === 3,
  );
  assert.deepEqual(
    [updated.fi, updated.ru, updated.en, updated.commission],
    ["Testi", "Тест", "Test", 8],
  );
  const quote = await (
    await api("orders", { ...later, audience: "all" }, customer)
  ).json();
  assert.equal(quote.fee, 320);
  assert.equal(
    (await api("orders", { ...later, category: 13 }, customer)).status,
    400,
  );
  const matches = await (await api("search", later, customer)).json();
  assert.deepEqual(
    matches.map((x) => x.user),
    [3],
  );
  assert.deepEqual(Object.keys(matches[0]).sort(), [
    "alias",
    "category",
    "city",
    "user",
  ]);
  const confirm = (topic, actor, id = invoice.id, answer = "yes") =>
    api("confirm", { id, topic, answer }, actor);
  assert.equal((await confirm("completion", q)).status, 403);
  assert.equal((await confirm("completion", p)).status, 200);
  let report = async () => (await api("admin/report", null, customer)).json();
  assert.equal((await report()).entries.length, 0);
  assert.equal((await confirm("completion", customer)).status, 200);
  assert.equal((await confirm("completion", customer)).status, 200);
  assert.equal((await report()).totals.accrual, 600);
  const entry = {
    id: invoice.id,
    kind: "fee_received",
    cents: 600,
    ref: "demo-receipt-1",
    reason: "=Test",
  };
  assert.equal((await api("admin/entry", entry, p)).status, 403);
  for (let i = 0; i < 2; i++)
    assert.equal((await api("admin/entry", entry, customer)).status, 200);
  assert.equal((await report()).totals.fee_received, 600);
  assert.equal(
    (await api("admin/entry", { ...entry, cents: 601 }, customer)).status,
    409,
  );
  assert.equal(
    (
      await api(
        "admin/entry",
        { ...entry, ref: "refund-001", kind: "refund", cents: 100 },
        customer,
      )
    ).status,
    200,
  );
  assert.match(
    await (await api("admin/export", null, customer)).text(),
    /"'=Test"/,
  );
  assert.equal(
    (await api("admin/policy", { rate: 10, split: true, cash: true }, customer))
      .status,
    200,
  );
  assert.equal(
    (
      await api(
        "admin/rate",
        { scope: "helper", subject: 3, rate: 5 },
        customer,
      )
    ).status,
    200,
  );
  const cash = await (
    await api(
      "orders",
      { ...later, audience: "all", target: 3, model: "cash" },
      customer,
    )
  ).json();
  assert.equal(cash.fee, 200);
  assert.equal((await api("claim", { id: cash.id }, q)).status, 200);
  for (const topic of ["cash", "completion"])
    for (const who of [customer, q])
      assert.equal((await confirm(topic, who, cash.id)).status, 200);
  assert.equal((await report()).totals.cash_due, 200);
  assert.equal((await report()).invoices[0].outstanding, 200);
  const cancelled = await make();
  assert.equal((await api("cancel", { id: cancelled }, customer)).status, 200);
  assert.equal((await api("claim", { id: cancelled }, q)).status, 409);
  await api("recover", { email: "demo-2@example.invalid" });
  assert.equal(
    (await api("reset", { code: mail, password: "replacement demo password" }))
      .status,
    200,
  );
  assert.equal((await api("me", null, p)).status, 401);
});
