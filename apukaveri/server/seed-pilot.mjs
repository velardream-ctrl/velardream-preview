import { mkdtemp, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { password } from "./worker.mjs";

const accounts = [
  { email: "demo-owner@example.invalid", owner: 1 },
  { email: "demo-customer@example.invalid", owner: 0 },
  { email: "demo-helper@example.invalid", owner: 0, category: 3, city: "Kitee" },
  { email: "demo-delivery@example.invalid", owner: 0, category: 6, city: "Joensuu" },
  { email: "demo-digital@example.invalid", owner: 0, category: 12, city: "Joensuu" },
];
const directory = await mkdtemp(join(tmpdir(), "apukaveri-pilot-"));
const statements = [];
const schedule = JSON.stringify({
  weekly: Object.fromEntries(Array.from({length: 7}, (_, day) =>
    [day, [{start: "00:00", end: "24:00"}]],
  )),
});
for (const [index, account] of accounts.entries()) {
  account.password = randomBytes(24).toString("base64url");
  const hash = await password(account.password, randomUUID());
  statements.push(
    "INSERT INTO accounts(email,password,verified,owner) VALUES('" +
      account.email + "','" + hash + "',1," + account.owner + ");",
    "INSERT INTO profiles(user,alias) SELECT id,'Demo " + (index + 1) +
      "' FROM accounts WHERE email='" + account.email + "';",
  );
  if (account.category) statements.push(
    "UPDATE profiles SET category=" + account.category + ", city='" + account.city +
      "', schedule='" + schedule + "', available=1 WHERE user=(SELECT id FROM accounts WHERE email='" +
      account.email + "');",
  );
}
await writeFile(join(directory, "seed.sql"), statements.join("\n") + "\n", { mode: 0o600 });
await writeFile(join(directory, "credentials.json"), JSON.stringify(accounts, null, 2) + "\n", { mode: 0o600 });
console.log(directory);
