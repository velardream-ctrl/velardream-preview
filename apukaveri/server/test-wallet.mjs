// Synthetic credits only. This module does not contact payment providers.
export async function testWallet(path, post, body, user, sql, json) {
  if (path === "/api/wallet" && !post) {
    const balance = await sql(
      "SELECT COALESCE(sum(cents),0) cents FROM test_wallet_entries WHERE account=?",
      user.id,
    ).first();
    const entries = await sql(
      "SELECT order_id,kind,cents,created FROM test_wallet_entries WHERE account=? ORDER BY id DESC LIMIT 20",
      user.id,
    ).all();
    return json({ balance: balance.cents, entries: entries.results });
  }
  if (path === "/api/payment/reserve" && post) {
    if (!Number.isSafeInteger(body.id)) return json({}, 400);
    const result = await sql(
      `INSERT INTO test_card_payments(order_id,cents,expires)
       SELECT id,labour+reimbursement+fee,unixepoch()+604800 FROM orders
       WHERE id=? AND customer=? AND provider IS NOT NULL AND cancelled=0 AND model='online'
         AND labour+reimbursement>0 AND end<= (unixepoch()+518400)*1000
         AND NOT EXISTS(SELECT 1 FROM test_wallet_entries WHERE ref='payment-'||orders.id)
         AND NOT EXISTS(SELECT 1 FROM confirmations WHERE order_id=orders.id AND (answer='dispute' OR actor=orders.customer))
       ON CONFLICT(order_id) DO UPDATE SET expires=excluded.expires
       WHERE status='reserved' AND expires<=unixepoch()`,
      body.id, user.id,
    ).run();
    const current = await sql(
      "SELECT status,expires FROM test_card_payments p JOIN orders o ON o.id=p.order_id WHERE o.id=? AND o.customer=?",
      body.id, user.id,
    ).first();
    return json({}, result.meta.changes || (current?.status === "reserved" &&
      current.expires > Date.now() / 1000) ? 200 : 409);
  }
  if (!post || !["/api/wallet/topup", "/api/wallet/withdraw", "/api/wallet/pay"].includes(path)) return;
  if (path.endsWith("/pay")) {
    if (!Number.isSafeInteger(body.id)) return json({}, 400);
    const ref = "payment-" + body.id;
    const previous = await sql(
      "SELECT account FROM test_wallet_entries WHERE ref=?", ref,
    ).first();
    if (previous) return json({}, previous.account === user.id ? 200 : 403);
    const result = await sql(
      "INSERT INTO test_wallet_entries(account,order_id,kind,cents,ref) SELECT customer,id,'payment',-(labour+reimbursement),? FROM orders WHERE id=? AND customer=? AND provider IS NOT NULL AND cancelled=0 AND model='online' AND labour+reimbursement>0 AND NOT EXISTS(SELECT 1 FROM confirmations WHERE order_id=orders.id) AND NOT EXISTS(SELECT 1 FROM test_card_payments WHERE order_id=orders.id) ON CONFLICT(ref) DO NOTHING",
      ref, body.id, user.id,
    ).run();
    if (result.meta.changes) return json({}, 200);
    const existing = await sql("SELECT account FROM test_wallet_entries WHERE ref=?", ref).first();
    return json({}, existing?.account === user.id ? 200 : 409);
  }
  if (!Number.isSafeInteger(body.cents) || body.cents < 1 || body.cents > 100000 ||
      typeof body.ref !== "string" || !/^[a-f0-9-]{36}$/.test(body.ref)) {
    return json({}, 400);
  }
  const kind = path.endsWith("/topup") ? "topup" : "withdrawal";
  const cents = kind === "topup" ? body.cents : -body.cents;
  const ref = user.id + "-" + body.ref;
  const previous = await sql("SELECT kind,cents FROM test_wallet_entries WHERE ref=?", ref).first();
  if (previous) return json({}, previous.kind === kind && previous.cents === cents ? 200 : 409);
  await sql(
    "INSERT INTO test_wallet_entries(account,kind,cents,ref) VALUES(?,?,?,?) ON CONFLICT(ref) DO NOTHING",
    user.id, kind, cents, ref,
  ).run();
  const stored = await sql("SELECT kind,cents FROM test_wallet_entries WHERE ref=?", ref).first();
  return json({}, stored?.kind === kind && stored.cents === cents ? 200 : 409);
}
