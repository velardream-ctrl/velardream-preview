import { validLanguages } from "../profile-languages.mjs";
import { finance } from "./finance.mjs";
import {
  intervalsForDate,
  normalizeIntervals,
  validDate,
} from "../availability.mjs";
const json = (data, status = 200, headers = {}) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
const fail = (status, message) => {
  throw Object.assign(Error(message), { status });
};
const bytes = new TextEncoder();
const hex = (b) =>
  Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join(
    "",
  );
const digest = async (s) =>
  hex(await crypto.subtle.digest("SHA-256", bytes.encode(s)));
export async function password(value, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    bytes.encode(value),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return (
    salt +
    "." +
    hex(
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt: bytes.encode(salt),
          iterations: 100000,
        },
        key,
        256,
      ),
    )
  );
}
const clock = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Helsinki",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function covers(schedule, start, end) {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start % 60000 ||
    end % 60000 ||
    end <= start ||
    end - start > 86400000
  )
    return false;
  const days = new Map();
  for (let t = start; t < end; t += 60000) {
    const [date, time] = clock.format(t).split(" ");
    if (!days.has(date)) days.set(date, intervalsForDate(schedule, date));
    const [h, m] = time.split(":").map(Number);
    if (!days.get(date).some(([a, b]) => a <= h * 60 + m && h * 60 + m < b))
      return false;
  }
  return true;
}
export default {
  async fetch(req, env) {
    try {
      const url = new URL(req.url),
        path = url.pathname;
      if (env.MODE !== "synthetic")
        return json({ error: "sandbox disabled" }, 503);
      const sql = (query, ...args) => env.DB.prepare(query).bind(...args);
      const activeCity = (city) =>
        typeof city === "string" &&
        sql("SELECT id FROM locations WHERE city=? AND active=1", city).first();
      const post = req.method === "POST";
      if (!post && req.method !== "GET") return json({}, 405);
      if (
        post &&
        (req.headers.get("Origin") !== url.origin ||
          !req.headers.get("Content-Type")?.startsWith("application/json"))
      )
        return json({}, 403);
      const raw = post ? await req.text() : "";
      if (raw.length > 16384) return json({}, 413);
      let b;
      try {
        b = raw ? JSON.parse(raw) : {};
      } catch {
        return json({}, 400);
      }
      if (!b || typeof b !== "object" || Array.isArray(b)) return json({}, 400);
      const now = Date.now();
      const cookie = "ak_session";
      const secret =
        req.headers
          .get("Cookie")
          ?.match(/(?:^|; )ak_session=([a-f0-9-]+)/)?.[1] || "";
      const session = await digest(secret);
      const user = await sql(
        "SELECT a.id,a.owner FROM accounts a JOIN tokens t ON a.id=t.user WHERE t.hash=? AND purpose='session' AND expires>?",
        session,
        now,
      ).first();
      async function issue(id, purpose, ttl) {
        const code = crypto.randomUUID();
        await sql(
          "INSERT INTO tokens VALUES(?,?,?,?)",
          await digest(code),
          id,
          purpose,
          now + ttl,
        ).run();
        return code;
      }
      if (path === "/api/locations" && !post)
        return json(
          (await sql("SELECT id,country,region,city,fi,ru,en,timezone FROM locations WHERE active=1 ORDER BY fi").all()).results,
        );
      if (path === "/api/categories" && !post)
        return json(
          (await sql("SELECT * FROM categories ORDER BY id").all()).results,
        );
      if (
        post &&
        ["/api/register", "/api/login", "/api/recover"].includes(path)
      ) {
        if (!/^demo-[a-z0-9]{1,24}@example\.invalid$/.test(b.email))
          return json({ error: "synthetic email required" }, 400);
        const a = await sql(
          "SELECT * FROM accounts WHERE email=?",
          b.email,
        ).first();
        if (path.endsWith("/recover")) {
          if (a && env.deliver)
            await env.deliver(
              b.email,
              "reset",
              await issue(a.id, "reset", 900000),
            );
          return json({ ok: true });
        }
        if (
          typeof b.password !== "string" ||
          b.password.length < 12 ||
          b.password.length > 128
        )
          return json({}, 400);
        if (path.endsWith("/register")) {
          if (!env.deliver)
            return json({ error: "test mailbox unavailable" }, 503);
          if (a) return json({}, 409);
          await env.DB.batch([
            sql(
              "INSERT INTO accounts(email,password) VALUES(?,?)",
              b.email,
              await password(b.password, crypto.randomUUID()),
            ),
            sql(
              "INSERT INTO profiles(user) SELECT id FROM accounts WHERE email=?",
              b.email,
            ),
          ]);
          const row = await sql(
            "SELECT id FROM accounts WHERE email=?",
            b.email,
          ).first();
          await env.deliver(
            b.email,
            "verify",
            await issue(row.id, "verify", 900000),
          );
          return json({ ok: true }, 201);
        }
        if (
          !a?.verified ||
          (await password(b.password, a.password.split(".")[0])) !== a.password
        )
          return json({}, 401);
        const ttl = (b.remember ? 30 : 1) * 86400000;
        const token = await issue(a.id, "session", ttl);
        return json({ ok: true }, 200, {
          "Set-Cookie":
            cookie +
            "=" +
            token +
            "; HttpOnly; SameSite=Strict; Path=/" +
            (url.protocol === "https:" ? "; Secure" : "") +
            (b.remember ? "; Max-Age=" + ttl / 1000 : ""),
        });
      }
      if (post && ["/api/verify", "/api/reset"].includes(path)) {
        const purpose = path.slice(5),
          hash = await digest(String(b.code)),
          where =
            "SELECT user FROM tokens WHERE hash=? AND purpose=? AND expires>?";
        const args = [hash, purpose, now],
          ops = [];
        if (purpose === "reset") {
          if (
            typeof b.password !== "string" ||
            b.password.length < 12 ||
            b.password.length > 128
          )
            return json({}, 400);
          ops.push(
            sql(
              "UPDATE accounts SET password=? WHERE id IN (" + where + ")",
              await password(b.password, crypto.randomUUID()),
              ...args,
            ),
            sql(
              "DELETE FROM tokens WHERE purpose='session' AND user IN (" +
                where +
                ")",
              ...args,
            ),
          );
        } else
          ops.push(
            sql(
              "UPDATE accounts SET verified=1 WHERE id IN (" + where + ")",
              ...args,
            ),
          );
        ops.push(
          sql(
            "DELETE FROM tokens WHERE purpose=? AND user IN (" + where + ")",
            purpose,
            ...args,
          ),
        );
        const result = await env.DB.batch(ops);
        return json({}, result[0].meta.changes ? 200 : 400);
      }
      if (!user) return json({}, 401);
      await sql(
        "INSERT INTO activity VALUES(?,?) ON CONFLICT(user) DO UPDATE SET last_seen=excluded.last_seen WHERE activity.last_seen<excluded.last_seen-60000",
        user.id,
        now,
      ).run();
      if (path === "/api/avatar") {
        if (!post)
          return json(
            (await sql(
              "SELECT pixels FROM avatars WHERE user=?",
              user.id,
            ).first()) || {},
          );
        if (b.pixels === null)
          await sql("DELETE FROM avatars WHERE user=?", user.id).run();
        else if (
          typeof b.pixels === "string" &&
          /^[A-Za-z0-9+/]{12288}$/.test(b.pixels)
        )
          await sql(
            "INSERT OR REPLACE INTO avatars VALUES(?,?)",
            user.id,
            b.pixels,
          ).run();
        else return json({}, 400);
        return json({ ok: true });
      }
      const financial = await finance(
        path,
        post,
        b,
        user,
        sql,
        env.DB,
        json,
        url,
      );
      if (financial) return financial;
      if (path === "/api/logout" && post) {
        await sql("DELETE FROM tokens WHERE hash=?", session).run();
        return json({ ok: true });
      }
      if (path === "/api/me" && !post)
        return json({
          ...user,
          ...(await sql(
            "SELECT * FROM profiles WHERE user=?",
            user.id,
          ).first()),
        });
      if (path === "/api/profile" && post) {
        if (
          (b.languages !== undefined && !validLanguages(b.languages)) ||
          !/^Demo [0-9]{1,5}$/.test(b.alias) ||
          !(await activeCity(b.city))
        )
          return json({}, 400);
        if (
          !(await sql(
            "SELECT id FROM categories WHERE id=? AND restricted=0",
            b.category,
          ).first())
        )
          return json({}, 400);
        if (
          !b.schedule ||
          typeof b.schedule !== "object" ||
          Array.isArray(b.schedule) ||
          ["weekly", "overrides"].some(
            (k) =>
              b.schedule[k] != null &&
              (typeof b.schedule[k] !== "object" ||
                Array.isArray(b.schedule[k])),
          )
        )
          return json({}, 400);
        try {
          for (const [k, v] of Object.entries(b.schedule.weekly || {})) {
            if (!/^[0-6]$/.test(k)) throw Error();
            normalizeIntervals(v);
          }
          for (const [k, v] of Object.entries(b.schedule.overrides || {})) {
            if (!validDate(k)) throw Error();
            normalizeIntervals(v);
          }
        } catch {
          return json({}, 400);
        }
        await sql(
          "UPDATE profiles SET alias=?,city=?,category=?,schedule=?,available=?,languages=COALESCE(?,languages) WHERE user=?",
          b.alias,
          b.city,
          b.category,
          JSON.stringify(b.schedule),
          Number(b.available === true),
          b.languages === undefined ? null : JSON.stringify(b.languages),
          user.id,
        ).run();
        return json({ ok: true });
      }
      if (path === "/api/favourites") {
        if (!post)
          return json(
            (
              await sql(
                "SELECT helper FROM favourites WHERE customer=? ORDER BY helper",
                user.id,
              ).all()
            ).results,
          );
        if (
          !Number.isSafeInteger(b.helper) ||
          b.helper === user.id ||
          !(await sql(
            "SELECT user FROM profiles WHERE user=?",
            b.helper,
          ).first())
        )
          return json({}, 400);
        if (b.enabled === true)
          await sql(
            "INSERT OR IGNORE INTO favourites VALUES(?,?)",
            user.id,
            b.helper,
          ).run();
        else if (b.enabled === false)
          await sql(
            "DELETE FROM favourites WHERE customer=? AND helper=?",
            user.id,
            b.helper,
          ).run();
        else return json({}, 400);
        return json({ ok: true });
      }
      const audience =
        "(audience='all' OR (audience='first' AND expand_at<=?) OR EXISTS(SELECT 1 FROM recipients WHERE order_id=orders.id AND helper=?))";
      if (path === "/api/orders" && !post) {
        const rows = (
          await sql(
            "SELECT orders.*,(SELECT stars FROM ratings WHERE order_id=orders.id) AS stars FROM orders WHERE customer=? OR provider=? OR (cancelled=0 AND customer<>? AND provider IS NULL AND (target IS NULL OR target=?) AND " +
              audience +
              " AND EXISTS(SELECT 1 FROM profiles p WHERE p.user=? AND p.available=1 AND p.city=orders.city AND p.category=orders.category))",
            user.id,
            user.id,
            user.id,
            user.id,
            now,
            user.id,
            user.id,
          ).all()
        ).results;
        const profile = await sql(
          "SELECT schedule FROM profiles WHERE user=?",
          user.id,
        ).first();
        const booked = (
          await sql(
            "SELECT start,end FROM orders WHERE cancelled=0 AND provider=? AND end>?",
            user.id,
            now,
          ).all()
        ).results;
        const visible = rows.filter(
          (o) =>
            o.customer === user.id ||
            o.provider === user.id ||
            o.kind === "listing" ||
            (o.start > now &&
              covers(JSON.parse(profile.schedule), o.start, o.end) &&
              !booked.some((b) => b.start < o.end && o.start < b.end)),
        );
        const pending = visible.filter(
          (o) => !o.provider && o.customer !== user.id && o.kind !== "listing",
        );
        for (const o of pending)
          await sql(
            "INSERT OR IGNORE INTO offers(order_id,helper) VALUES(?,?)",
            o.id,
            user.id,
          ).run();
        const confirmations = (
          await sql(
            "SELECT c.order_id,c.actor,c.topic,c.answer FROM confirmations c JOIN orders o ON o.id=c.order_id WHERE o.customer=? OR o.provider=?",
            user.id,
            user.id,
          ).all()
        ).results;
        const byOrder = new Map();
        for (const item of confirmations) {
          if (!byOrder.has(item.order_id)) byOrder.set(item.order_id, []);
          byOrder.get(item.order_id).push(item);
        }
        return json(
          visible.map((o) => ({
            ...o,
            confirmations: byOrder.get(o.id) || [],
          })),
        );
      }
      if (path === "/api/inbox" && !post) {
        const items = (
          await sql(
            "SELECT f.order_id,f.seen FROM offers f JOIN orders o ON o.id=f.order_id WHERE helper=? AND o.cancelled=0 AND o.start>? AND (o.provider IS NULL OR o.provider=?) ORDER BY f.id DESC",
            user.id,
            now,
            user.id,
          ).all()
        ).results;
        return json({ unread: items.filter((i) => !i.seen).length, items });
      }
      if (path === "/api/offers/view" && post) {
        const result = await sql(
          "UPDATE offers SET seen=COALESCE(seen,unixepoch()) WHERE order_id=? AND helper=?",
          b.id,
          user.id,
        ).run();
        return json({}, result.meta.changes ? 200 : 404);
      }
      if (path === "/api/orders" && post) {
        if (
          !["urgent", "planned", "listing"].includes(b.kind) ||
          !(await activeCity(b.city)) ||
          !Number.isSafeInteger(b.start) ||
          !Number.isSafeInteger(b.end) ||
          b.start % 60000 ||
          b.end % 60000 ||
          b.start < now ||
          b.end <= b.start ||
          b.end - b.start > 86400000 ||
          b.end > now + 366 * 86400000
        )
          return json({}, 400);
        const cat = await sql(
          "SELECT id,commission FROM categories WHERE id=? AND restricted=0",
          b.category,
        ).first();
        if (!cat) return json({}, 403);
        if (b.kind === "planned" && !b.target) return json({}, 400);
        if (
          b.target != null &&
          !(await sql(
            "SELECT user FROM profiles WHERE user=? AND user<>? AND category=? AND city=? AND available=1",
            b.target,
            user.id,
            b.category,
            b.city,
          ).first())
        )
          return json({}, 400);
        const group = b.audience ?? "all",
          labour = b.labour ?? 0,
          reimbursement = b.reimbursement ?? 0;
        if (
          !["all", "first", "favourites"].includes(group) ||
          (b.target != null && group !== "all") ||
          ![labour, reimbursement].every(
            (x) => Number.isSafeInteger(x) && x >= 0 && x <= 10000000,
          ) ||
          (cat.id === 13 && labour !== 0)
        )
          return json({}, 400);
        const policy = await sql("SELECT * FROM policy").first(),
          model = labour ? (b.model ?? "online") : "free";
        if (
          !["online", "split", "cash", "free"].includes(model) ||
          (model === "free" && labour) ||
          (model === "split" && !policy.allow_split) ||
          (model === "cash" && !policy.allow_cash)
        )
          return json({}, 400);
        const override = await sql(
          "SELECT rate FROM rates WHERE (scope='helper' AND subject=?) OR (scope='category' AND subject=?) ORDER BY CASE scope WHEN 'helper' THEN 0 ELSE 1 END LIMIT 1",
          b.target ?? -1,
          b.category,
        ).first();
        const percent = labour ? (override?.rate ?? policy.rate) : 0,
          fee = Math.round((labour * percent) / 100);
        const ops = [
          sql(
            "INSERT INTO orders(customer,category,city,start,end,target,kind,audience,expand_at,labour,reimbursement,fee,percent,model) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            user.id,
            b.category,
            b.city,
            b.start,
            b.end,
            b.target ?? null,
            b.kind,
            group,
            now + 300000,
            labour,
            reimbursement,
            fee,
            percent,
            model,
          ),
        ];
        if (group !== "all")
          ops.push(
            sql(
              "INSERT INTO recipients SELECT (SELECT MAX(id) FROM orders WHERE customer=?),helper FROM favourites WHERE customer=?",
              user.id,
              user.id,
            ),
          );
        if (b.kind !== "listing") {
          const helpers = (
            await sql(
              "SELECT user,schedule FROM profiles p WHERE available=1 AND user<>? AND category=? AND city=? AND (? IS NULL OR user=?) AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.cancelled=0 AND o.provider=p.user AND o.start<? AND o.end>?)",
              user.id,
              b.category,
              b.city,
              b.target ?? null,
              b.target ?? null,
              b.end,
              b.start,
            ).all()
          ).results;
          for (const h of helpers.filter((p) =>
            covers(JSON.parse(p.schedule), b.start, b.end),
          )) {
            ops.push(
              sql(
                "INSERT OR IGNORE INTO offers(order_id,helper) SELECT id,? FROM orders o WHERE customer=? AND id=(SELECT max(id) FROM orders WHERE customer=?) AND (audience='all' OR EXISTS(SELECT 1 FROM recipients r WHERE r.order_id=o.id AND r.helper=?))",
                h.user,
                user.id,
                user.id,
                h.user,
              ),
            );
          }
        }
        const [result] = await env.DB.batch(ops);
        return json(
          { id: result.meta.last_row_id, labour, reimbursement, percent, fee },
          201,
        );
      }
      if (path === "/api/cancel" && post) {
        const r = await sql(
          "UPDATE orders SET cancelled=? WHERE id=? AND (customer=? OR provider=?) AND cancelled=0 AND NOT EXISTS(SELECT 1 FROM confirmations WHERE order_id=orders.id)",
          user.id,
          b.id,
          user.id,
          user.id,
        ).run();
        return json({}, r.meta.changes ? 200 : 409);
      }
      if (path === "/api/claim" && post) {
        const order = await sql(
          "SELECT * FROM orders WHERE cancelled=0 AND id=? AND customer<>? AND (target IS NULL OR target=?) AND provider IS NULL AND kind<>? AND start>? AND " +
            audience,
          b.id,
          user.id,
          user.id,
          "listing",
          now,
          now,
          user.id,
        ).first();
        if (!order) return json({}, 409);
        const p = await sql(
          "SELECT * FROM profiles WHERE user=? AND available=1 AND category=? AND city=?",
          user.id,
          order.category,
          order.city,
        ).first();
        if (!p || !covers(JSON.parse(p.schedule), order.start, order.end))
          return json({}, 409);
        const r = await sql(
          "UPDATE orders SET provider=? WHERE cancelled=0 AND id=? AND provider IS NULL AND EXISTS(SELECT 1 FROM profiles WHERE user=? AND available=1 AND schedule=? AND category=? AND city=?)",
          user.id,
          b.id,
          user.id,
          p.schedule,
          order.category,
          order.city,
        ).run();
        return json({}, r.meta.changes ? 200 : 409);
      }
      if (path === "/api/admin/category" && post) {
        if (!user.owner) return json({}, 403);
        if (
          ![b.fi, b.ru, b.en].every(
            (x) => typeof x === "string" && x.trim() && x.length <= 80,
          ) ||
          !Number.isInteger(b.commission) ||
          b.commission < 0 ||
          b.commission > 100
        )
          return json({}, 400);
        if (!(await sql("SELECT id FROM categories WHERE id=?", b.id).first()))
          return json({}, 404);
        const [r] = await env.DB.batch([
          sql(
            "UPDATE categories SET fi=?,ru=?,en=?,commission=? WHERE id=?",
            b.fi.trim(),
            b.ru.trim(),
            b.en.trim(),
            b.id === 13 ? 0 : b.commission,
            b.id,
          ),
          sql(
            "INSERT OR REPLACE INTO rates VALUES('category',?,?)",
            b.id,
            b.id === 13 ? 0 : b.commission,
          ),
          sql(
            "INSERT INTO events(actor,kind,detail) VALUES(?,?,?)",
            user.id,
            "category_changed",
            JSON.stringify([b.id, b.fi, b.ru, b.en, b.commission]),
          ),
        ]);
        return json({}, r.meta.changes ? 200 : 404);
      }
      if (path === "/api/rating" && post) {
        if (!Number.isSafeInteger(b.id) || !Number.isInteger(b.stars) ||
            b.stars < 1 || b.stars > 5) return json({}, 400);
        const result = await sql(
          "INSERT INTO ratings(order_id,stars) SELECT o.id,? FROM orders o WHERE o.id=? AND o.customer=? AND o.provider IS NOT NULL AND o.cancelled=0 AND EXISTS(SELECT 1 FROM events WHERE order_id=o.id AND kind='completion_confirmed') AND NOT EXISTS(SELECT 1 FROM events WHERE order_id=o.id AND kind='disputed') ON CONFLICT(order_id) DO NOTHING",
          b.stars, b.id, user.id,
        ).run();
        if (result.meta.changes) return json({}, 201);
        const rated = await sql(
          "SELECT r.stars FROM ratings r JOIN orders o ON o.id=r.order_id WHERE o.id=? AND o.customer=?",
          b.id, user.id,
        ).first();
        return json({}, rated ? (rated.stars === b.stars ? 200 : 409) : 403);
      }
      if (path === "/api/search" && post) {
        if (
          !(await activeCity(b.city)) ||
          !Number.isSafeInteger(b.start) ||
          !Number.isSafeInteger(b.end) ||
          b.start < now ||
          b.end > now + 366 * 86400000 ||
          b.end <= b.start ||
          b.end - b.start > 86400000
        )
          return json({}, 400);
        const rows = (
          await sql(
            "WITH scores AS (SELECT o.provider,AVG(r.stars) rating,COUNT(*) rating_count FROM ratings r JOIN orders o ON o.id=r.order_id GROUP BY o.provider) SELECT p.user,p.alias,p.city,p.category,p.schedule,s.rating,COALESCE(s.rating_count,0) rating_count FROM profiles p LEFT JOIN scores s ON s.provider=p.user WHERE user<>? AND available=1 AND city=? AND category=? AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.cancelled=0 AND o.provider=p.user AND o.start<? AND o.end>?) ORDER BY s.rating DESC,s.rating_count DESC,p.user",
            user.id,
            b.city,
            b.category,
            b.end,
            b.start,
          ).all()
        ).results;
        return json(
          rows
            .filter((p) => covers(JSON.parse(p.schedule), b.start, b.end))
            .map(({ schedule, ...profile }) => profile),
        );
      }
      if (path === "/api/admin" && !post) {
        if (!user.owner) return json({}, 403);
        return json(
          await sql(
            "SELECT (SELECT count(*) FROM accounts) users,(SELECT count(*) FROM orders) orders",
          ).first(),
        );
      }
      return json({}, 404);
    } catch (e) {
      if (/occupied|UNIQUE constraint/.test(String(e.cause || e)))
        return json({}, 409);
      return json({ error: "Request failed" }, e.status || 500);
    }
  },
};
