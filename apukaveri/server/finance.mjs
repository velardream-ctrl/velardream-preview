// Owner-only reporting, synthetic adjustments and independent party attestations.
export async function finance(path, post, b, user, sql, db, json, url, requireTestPayment) {
  if (path === "/api/confirm" && post) {
    if (
      !["completion", "cash"].includes(b.topic) ||
      !["yes", "dispute"].includes(b.answer)
    )
      return json({}, 400);
    const order = await sql(
      "SELECT * FROM orders WHERE cancelled=0 AND id=? AND provider IS NOT NULL AND (customer=? OR provider=?)",
      b.id,
      user.id,
      user.id,
    ).first();
    if (!order) return json({}, 403);
    if (requireTestPayment && b.topic === "completion" && b.answer === "yes" &&
        order.model === "online" && order.labour + order.reimbursement > 0 &&
        !(await sql("SELECT 1 AS paid FROM test_wallet_entries WHERE ref=?", "payment-" + order.id).first())) {
      return json({ error: "test_payment_required" }, 409);
    }
    if (b.topic === "cash" && !["cash", "split"].includes(order.model))
      return json({}, 400);
    await sql(
      "INSERT OR IGNORE INTO confirmations SELECT id,?,?,? FROM orders WHERE id=? AND cancelled=0",
      user.id,
      b.topic,
      b.answer,
      order.id,
    ).run();
    const row = await sql(
      "SELECT answer FROM confirmations WHERE order_id=? AND actor=? AND topic=?",
      order.id,
      user.id,
      b.topic,
    ).first();
    return json({}, row?.answer === b.answer ? 200 : 409);
  }
  if (!path.startsWith("/api/admin/")) return;
  if (!user.owner) return json({}, 403);
  const audit = (kind, detail) =>
    sql(
      "INSERT INTO events(actor,kind,detail) VALUES(?,?,?)",
      user.id,
      kind,
      detail,
    );
  if (path === "/api/admin/customer-fee-preview" && post) {
    const { labour, reimbursement, processing } = b;
    if (![labour, reimbursement, processing].every(
      (value) => Number.isSafeInteger(value) && value >= 0 && value <= 10000000,
    )) return json({}, 400);
    const { rate } = await sql("SELECT rate FROM policy WHERE id=1").first();
    const serviceFee = Math.round(labour * rate / 100);
    return json({
      currency: "EUR",
      labour,
      reimbursement,
      serviceFee,
      customerTotal: labour + reimbursement + serviceFee,
      helperTotal: labour + reimbursement,
      estimatedPlatformMargin: serviceFee - processing,
    });
  }
  if (path === "/api/admin/policy" && post) {
    if (
      !Number.isInteger(b.rate) ||
      b.rate < 0 ||
      b.rate > 100 ||
      typeof b.cash !== "boolean" ||
      typeof b.split !== "boolean"
    )
      return json({}, 400);
    await db.batch([
      sql(
        "UPDATE policy SET rate=?,allow_cash=?,allow_split=? WHERE id=1",
        b.rate,
        +b.cash,
        +b.split,
      ),
      audit("policy_changed", JSON.stringify([b.rate, b.cash, b.split])),
    ]);
    return json({ ok: true });
  }
  if (path === "/api/admin/rate" && post) {
    if (
      !["helper", "category"].includes(b.scope) ||
      !Number.isSafeInteger(b.subject) ||
      (b.rate !== null &&
        (!Number.isInteger(b.rate) || b.rate < 0 || b.rate > 100))
    )
      return json({}, 400);
    if (
      !(await sql(
        b.scope === "helper"
          ? "SELECT user FROM profiles WHERE user=?"
          : "SELECT id FROM categories WHERE id=?",
        b.subject,
      ).first())
    )
      return json({}, 404);
    const op =
      b.rate === null
        ? sql(
            "DELETE FROM rates WHERE scope=? AND subject=?",
            b.scope,
            b.subject,
          )
        : sql(
            "INSERT OR REPLACE INTO rates VALUES(?,?,?)",
            b.scope,
            b.subject,
            b.rate,
          );
    await db.batch([
      op,
      audit("rate_changed", JSON.stringify([b.scope, b.subject, b.rate])),
    ]);
    return json({ ok: true });
  }
  if (path === "/api/admin/entry" && post) {
    if (
      !["fee_received", "refund", "payout"].includes(b.kind) ||
      !Number.isSafeInteger(b.cents) ||
      b.cents <= 0 ||
      !/^[-\w]{8,64}$/.test(b.ref) ||
      typeof b.reason !== "string" ||
      !b.reason.trim() ||
      b.reason.length > 120
    )
      return json({}, 400);
    const limits = {
      fee_received:
        "o.fee-COALESCE((SELECT sum(cents) FROM ledger WHERE order_id=o.id AND kind='fee_received'),0)",
      refund:
        "COALESCE((SELECT sum(CASE kind WHEN 'fee_received' THEN cents WHEN 'refund' THEN -cents ELSE 0 END) FROM ledger WHERE order_id=o.id),0)",
      payout:
        "o.labour+o.reimbursement-o.fee-COALESCE((SELECT sum(cents) FROM ledger WHERE order_id=o.id AND kind='payout'),0)",
    };
    await sql(
      "INSERT OR IGNORE INTO ledger(order_id,kind,cents,ref,actor,reason) SELECT id,?,?,?,?,? FROM orders o WHERE id=? AND EXISTS(SELECT 1 FROM ledger WHERE order_id=o.id AND kind='accrual') AND NOT EXISTS(SELECT 1 FROM events WHERE order_id=o.id AND kind='disputed') AND (?<>'payout' OR model='online') AND ?<=(" +
        limits[b.kind] +
        ")",
      b.kind,
      b.cents,
      b.ref,
      user.id,
      b.reason,
      b.id,
      b.kind,
      b.cents,
    ).run();
    const row = await sql("SELECT * FROM ledger WHERE ref=?", b.ref).first();
    return json(
      {},
      row?.order_id === b.id &&
        row.kind === b.kind &&
        row.cents === b.cents &&
        row.reason === b.reason
        ? 200
        : 409,
    );
  }
  if (["/api/admin/report", "/api/admin/export"].includes(path) && !post) {
    const args = [],
      parts = [];
    for (const [key, field] of [
      ["city", "o.city"],
      ["category", "o.category"],
      ["helper", "o.provider"],
      ["from", "o.start"],
      ["to", "o.start"],
    ]) {
      const v = url.searchParams.get(key);
      if (!v) continue;
      if (key !== "city" && !/^\d{1,15}$/.test(v)) return json({}, 400);
      parts.push(
        field + (key === "from" ? ">=" : key === "to" ? "<" : "=") + "?",
      );
      args.push(key === "city" ? v : Number(v));
    }
    const where = parts.length ? " WHERE " + parts.join(" AND ") : "";
    const rows = (
      await sql(
        "SELECT o.*,EXISTS(SELECT 1 FROM events WHERE order_id=o.id AND kind='completion_confirmed') completed,EXISTS(SELECT 1 FROM events WHERE order_id=o.id AND kind='disputed') disputed FROM orders o" +
          where +
          " ORDER BY o.id DESC",
        ...args,
      ).all()
    ).results;
    const entries = (
      await sql(
        "SELECT l.* FROM ledger l JOIN orders o ON o.id=l.order_id" +
          where +
          " ORDER BY l.id DESC",
        ...args,
      ).all()
    ).results;
    if (path.endsWith("/export")) {
      const escape = (v) => {
        let s = String(v ?? "");
        if (/^\s*[=+@-]|^[\t\r\n]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      const fields = [
        "id",
        "stamp",
        "order_id",
        "kind",
        "cents",
        "ref",
        "actor",
        "reason",
      ];
      return new Response(
        [fields, ...entries.map((row) => fields.map((f) => escape(row[f])))]
          .map((r) => r.join(","))
          .join("\r\n"),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="apukaveri-ledger.csv"',
            "Cache-Control": "no-store",
          },
        },
      );
    }
    const events = (
      await sql("SELECT * FROM events ORDER BY seq DESC LIMIT 100").all()
    ).results;
    const totals = {};
    for (const l of entries) totals[l.kind] = (totals[l.kind] || 0) + l.cents;
    const helpers = (
      await sql(
        "SELECT o.provider helper,count(*) assigned,sum(EXISTS(SELECT 1 FROM events e WHERE e.order_id=o.id AND e.kind='completion_confirmed')) completed FROM orders o" +
          where +
          (where ? " AND " : " WHERE ") +
          "o.provider IS NOT NULL GROUP BY o.provider",
        ...args,
      ).all()
    ).results;
    const notifications = await sql(
      "SELECT count(*) offered,count(f.seen) viewed FROM offers f JOIN orders o ON o.id=f.order_id" +
        where,
      ...args,
    ).first();
    const invoices = (
      await sql(
        "SELECT i.order_id,i.issued,i.cents,MAX(0,i.cents-COALESCE((SELECT sum(CASE kind WHEN 'fee_received' THEN cents WHEN 'refund' THEN -cents ELSE 0 END) FROM ledger WHERE order_id=i.order_id),0)) outstanding FROM invoices i JOIN orders o ON o.id=i.order_id" +
          where,
        ...args,
      ).all()
    ).results;
    return json({
      orders: rows,
      entries,
      events,
      totals,
      helpers,
      notifications,
      invoices,
      policy: await sql("SELECT * FROM policy").first(),
      users: await sql(
        "SELECT count(*) registered,(SELECT count(*) FROM activity WHERE last_seen>unixepoch()*1000-86400000) active,(SELECT count(*) FROM profiles WHERE available=1) available FROM accounts",
      ).first(),
    });
  }
}
