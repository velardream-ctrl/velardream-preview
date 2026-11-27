import { termsVersion, privacyVersion } from "../registration-terms.mjs";
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
    assert.equal((await api("register", body)).status, 400);
    assert.equal((await api("register", { ...body, termsVersion, privacyVersion: "old", locale: "fi" })).status, 400);
    assert.equal((await api("register", { ...body, termsVersion, privacyVersion, locale: "fi" })).status, 201);
    const acceptance = await env.DB.prepare(
      "SELECT terms_version,privacy_version,language,accepted_at FROM registration_terms JOIN accounts ON account_id=id WHERE email=?",
    ).bind(body.email).first();
    assert.equal(acceptance.terms_version, termsVersion);
    assert.equal(acceptance.privacy_version, privacyVersion);
    assert.equal(acceptance.language, "fi");
    assert.ok(acceptance.accepted_at > 0);
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
  const feeInput = { labour: 4000, reimbursement: 500, processing: 200 };
  assert.equal((await api("admin/customer-fee-preview", feeInput, p)).status, 403);
  const estimate = await api("admin/customer-fee-preview", feeInput, customer);
  assert.deepEqual(await estimate.json(), {
    currency: "EUR", labour: 4000, reimbursement: 500, serviceFee: 600,
    customerTotal: 5100, helperTotal: 4500, estimatedPlatformMargin: 400,
  });
  assert.equal((await api("admin/customer-fee-preview", {
    ...feeInput, labour: -1,
  }, customer)).status, 400);
  const free = await api("admin/customer-fee-preview", { ...feeInput, labour: 0 }, customer);
  assert.equal((await free.json()).serviceFee, 0);
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
            languages: ["fi", "ru"],
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
  const locations = await (await api("locations")).json();
  assert.equal(locations.length, 108);
  assert.equal(new Set(locations.map(({ id }) => id)).size, 108);
  for (const id of ["FI-091", "FI-167", "FI-260", "FI-638"])
    assert.ok(locations.some((location) => location.id === id));
  assert.ok(locations.every(({ country, timezone }) =>
    country === "FI" && timezone === "Europe/Helsinki"));
  for (const city of ["Ilomantsi", "Unknown"]) {
    assert.equal((await api("profile", {
      alias: "Demo 1", city, category: 3, available: true, schedule,
    }, p)).status, 400);
    assert.equal((await api("search", { ...order, city }, customer)).status, 400);
    assert.equal((await api("orders", { ...order, city }, customer)).status, 400);
  }
  assert.equal((await (await api("me", null, p)).json()).city, "Kitee");
  const languageProfile = { alias: "Demo 1", city: "Kitee", category: 3, available: true, schedule };
  assert.equal((await api("profile", { ...languageProfile, languages: ["uk"] }, p)).status, 400);
  assert.equal((await api("profile", { ...languageProfile, languages: ["fi", "fi"] }, p)).status, 400);
  assert.equal((await api("profile", languageProfile, p)).status, 200);
  assert.deepEqual(JSON.parse((await (await api("me", null, p)).json()).languages), ["fi", "ru"]);

  const make = async () =>
    (await (await api("orders", order, customer)).json()).id;
  const id = await make();
  const inbox = async (actor) => (await api("inbox", null, actor)).json();
  assert.deepEqual(await inbox(p), { unread: 1, items: [{ order_id: id, seen: null }] });
  assert.deepEqual(await inbox(customer), { unread: 0, items: [] });
  assert.equal((await api("offers/view", { id }, customer)).status, 404);
  assert.equal((await api("offers/view", { id }, p)).status, 200);
  assert.equal((await inbox(p)).unread, 0);
  assert.equal((await inbox(q)).unread, 1);
  const race = await Promise.all([p, q].map((c) => api("claim", { id }, c)));
  assert.deepEqual(race.map((x) => x.status).sort(), [200, 409]);
  const winner = race[0].status === 200 ? p : q;
  assert.equal((await api("claim", { id: await make() }, winner)).status, 409);
  const loser = winner === p ? q : p;
  assert.ok(!(await inbox(loser)).items.some((item) => item.order_id === id));
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
  const shifted = await (await api("orders", { ...later, start: later.start + 7200000,
    end: later.end + 7200000, audience: "all", kind: "planned", target: 2 }, customer)).json();
  assert.ok((await inbox(p)).items.some(item => item.order_id === shifted.id));
  assert.ok(!(await inbox(q)).items.some(item => item.order_id === shifted.id));
  assert.equal((await api("profile", { ...languageProfile, available: false }, p)).status, 200);
  assert.ok(!(await inbox(p)).items.some(item => item.order_id === shifted.id));
  assert.equal((await api("profile", languageProfile, p)).status, 200);
  assert.equal((await api("cancel", { id: shifted.id }, customer)).status, 200);
  assert.ok(!(await inbox(p)).items.some(item => item.order_id === shifted.id));
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
    "rating",
    "rating_count",
    "user",
  ]);
  const confirm = (topic, actor, id = invoice.id, answer = "yes") =>
    api("confirm", { id, topic, answer }, actor);
  const rate = (stars, actor = customer) => api("rating", { id: invoice.id, stars }, actor);
  assert.equal((await rate(5)).status, 403);
  assert.equal((await confirm("completion", q)).status, 403);
  assert.equal((await confirm("completion", p)).status, 200);
  let report = async () => (await api("admin/report", null, customer)).json();
  assert.equal((await report()).entries.length, 0);
  assert.equal((await confirm("completion", customer)).status, 200);
  assert.equal((await confirm("completion", customer)).status, 200);
  assert.equal((await rate(5, p)).status, 403);
  assert.equal((await rate(6)).status, 400);
  assert.equal((await rate(5)).status, 201);
  assert.equal((await rate(5)).status, 200);
  assert.equal((await rate(4)).status, 409);
  const ranked = await (await api("search", {
    ...order, start: order.start + 86400000, end: order.end + 86400000,
  }, customer)).json();
  assert.equal(ranked[0].user, 2);
  assert.equal(ranked[0].rating, 5);
  assert.equal(ranked[0].rating_count, 1);
  assert.equal(ranked[1].rating_count, 0);
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
