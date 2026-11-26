// Isolated, in-memory owner demonstration. This entry point is never served by the Worker.
const sqlite = await initSqlJs(),
  db = new sqlite.Database();
db.run(window.demoSchema);
db.run(`
 INSERT INTO accounts(id,email,password,owner,verified) VALUES(1,'demo-owner@example.invalid','-',1,1),(2,'demo-helper@example.invalid','-',0,1);
 INSERT INTO profiles(user,alias,city,category,available) VALUES(1,'Demo 1','Kitee',3,0),(2,'Demo 2','Kitee',3,1);
 INSERT INTO orders(customer,category,city,start,end,kind,model,labour,fee,percent) VALUES(1,3,'Kitee',unixepoch()*1000-7200000,unixepoch()*1000-3600000,'planned','cash',4000,600,15);
 INSERT INTO offers(order_id,helper,seen) VALUES(1,2,unixepoch());
 UPDATE orders SET provider=2 WHERE id=1;
 INSERT INTO confirmations VALUES(1,1,'completion','yes'),(1,2,'completion','yes'),(1,1,'cash','yes'),(1,2,'cash','yes');
`);
function sql(query, ...args) {
  const rows = () => {
    const stmt = db.prepare(query);
    try {
      stmt.bind(args);
      const results = [];
      while (stmt.step()) results.push(stmt.getAsObject());
      return results;
    } finally {
      stmt.free();
    }
  };
  return {
    all: () => ({ results: rows() }),
    first: () => rows()[0],
    run: () => {
      db.run(query, args);
      return {
        meta: {
          changes: db.getRowsModified(),
          last_row_id: db.exec("SELECT last_insert_rowid()")[0].values[0][0],
        },
      };
    },
  };
}
const adapter = {
  prepare: (query) => ({ bind: (...args) => sql(query, ...args) }),
  batch: (ops) => {
    db.run("BEGIN");
    try {
      const out = ops.map((op) => op.run());
      db.run("COMMIT");
      return out;
    } catch (e) {
      db.run("ROLLBACK");
      throw e;
    }
  },
};
const origin = "https://apukaveri.example.invalid";
const token = crypto.randomUUID();
const hash = Array.from(
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
  ),
  (v) => v.toString(16).padStart(2, "0"),
).join("");
db.run("INSERT INTO tokens VALUES(?,1,'session',?)", [
  hash,
  Date.now() + 86400000,
]);
window.fetch = async (input, options = {}) => {
  const url = new URL(input, origin);
  if (url.origin !== origin || !url.pathname.startsWith("/api/"))
    throw Error("Offline demo");
  const req = {
    url: url.href,
    method: options.method || "GET",
    headers: new Headers({
      ...options.headers,
      Origin: origin,
      Cookie: "ak_session=" + token,
    }),
    text: async () => options.body || "",
  };
  return ApukaveriWorker.default.fetch(req, { MODE: "synthetic", DB: adapter });
};
document.addEventListener("click", async (e) => {
  const link = e.target.closest("#csv");
  if (!link) return;
  e.preventDefault();
  const data = await fetch(link.getAttribute("href")),
    a = document.createElement("a");
  a.download = "apukaveri-ledger.csv";
  a.href = URL.createObjectURL(await data.blob());
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
