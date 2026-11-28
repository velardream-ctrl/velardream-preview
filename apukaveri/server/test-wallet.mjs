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
  if (!post || !["/api/wallet/topup", "/api/wallet/withdraw", "/api/wallet/pay"].includes(path)) return;
  if (path.endsWith("/pay")) {
    if (!Number.isSafeInteger(body.id)) return json({}, 400);
    const ref = "payment-" + body.id;
    const previous = await sql(
      "SELECT account FROM test_wallet_entries WHERE ref=?", ref,
    ).first();
    if (previous) return json({}, previous.account === user.id ? 200 : 403);
    const result = await sql(
      "INSERT INTO test_wallet_entries(account,order_id,kind,cents,ref) SELECT customer,id,'payment',-(labour+reimbursement),? FROM orders WHERE id=? AND customer=? AND provider IS NOT NULL AND cancelled=0 AND model='online' AND labour+reimbursement>0 AND NOT EXISTS(SELECT 1 FROM confirmations WHERE order_id=orders.id) ON CONFLICT(ref) DO NOTHING",
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
