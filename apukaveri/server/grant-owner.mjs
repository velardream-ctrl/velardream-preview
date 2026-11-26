import { DatabaseSync } from "node:sqlite";
const [file, email] = process.argv.slice(2);
if (!file || !/^demo-[a-z0-9]{1,24}@example\.invalid$/.test(email || ""))
  throw Error("Usage: node server/grant-owner.mjs DATABASE SYNTHETIC_EMAIL");
const db = new DatabaseSync(file, { timeout: 3000 });
db.exec("BEGIN IMMEDIATE");
const row = db
  .prepare("UPDATE accounts SET owner=1 WHERE email=? AND verified=1")
  .run(email);
if (!row.changes)
  throw Error("Verify the synthetic account before granting owner access");
db.prepare(
  "INSERT INTO events(kind,detail) VALUES('owner_granted',(SELECT CAST(id AS TEXT) FROM accounts WHERE email=?))",
).run(email);
db.exec("COMMIT");
db.close();
