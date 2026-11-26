const words = [
  ["Omistajan näkymä", "Панель владельца", "Owner dashboard"],
  ["Rekisteröityneet", "Зарегистрированы", "Registered"],
  ["Vapaat auttajat", "Доступные помощники", "Available helpers"],
  ["Pyynnöt", "Заявки", "Requests"],
  ["Hyväksytyt", "Принятые", "Assigned"],
  ["Valmiit", "Выполненные", "Completed"],
  ["Riidat", "Споры", "Disputed"],
  ["Ansaittu provisio", "Начисленная комиссия", "Accrued commission"],
  ["Kirjatut maksut", "Учтённые оплаты комиссии", "Recorded fee payments"],
  ["Palautukset", "Возвраты", "Refunds"],
  ["Tilitykset", "Выплаты", "Payouts"],
  ["Maksuasetukset", "Настройки оплаты", "Payment settings"],
  ["Perusprosentti", "Базовая ставка, %", "Default rate, %"],
  ["Jaettu maksu", "Раздельная оплата", "Split payment"],
  ["Käteinen ja lasku", "Наличные со счётом", "Cash and invoice"],
  ["Tallenna", "Сохранить", "Save"],
  ["Tapahtumaloki", "Журнал событий", "Event log"],
  ["Taloustapahtumat", "Финансовый реестр", "Financial ledger"],
  ["Ei tapahtumia", "Пока нет записей", "No entries yet"],
  ["Kaupunki", "Город", "City"],
  ["Luokka", "Категория", "Category"],
  ["Auttajan ID", "ID исполнителя", "Helper ID"],
  ["Suodata", "Фильтровать", "Apply filters"],
  ["Luokkien muokkaus", "Редактор категорий", "Category editor"],
  ["Provisio %", "Комиссия, %", "Commission, %"],
  ["Tallennettu", "Сохранено", "Saved"],
  ["Virhe", "Ошибка", "Error"],
  ["Kaikki", "Все", "All"],
  ["Kuluttomat tilaukset", "Без оплаты труда", "Free orders"],
  ["Suoritetut tunnit", "Выполнено часов", "Completed hours"],
  ["Työn arvo", "Оборот выполненных услуг", "Completed labour turnover"],
  ["Testikirjaus", "Тестовая операция", "Test adjustment"],
  ["Tilausnumero", "Номер заказа", "Order ID"],
  ["Summa sentteinä", "Сумма в центах", "Amount in cents"],
  ["Peruste", "Основание", "Reason"],
  ["Lataa CSV", "Скачать CSV", "Download CSV"],
  ["Henkilökohtainen provisio", "Индивидуальная комиссия", "Helper commission"],
  [
    "Maksutiedot ovat testitietoja.",
    "Все финансовые записи тестовые.",
    "All financial entries are simulated.",
  ],
  ["Alkaen", "С даты", "From"],
  ["Asti", "До даты включительно", "Through"],
  ["Aktiiviset (24 h)", "Активные за 24 ч", "Active in 24 h"],
  ["Tarjoukset", "Предложения", "Offers"],
  ["Avatut tarjoukset", "Открытые предложения", "Viewed offers"],
  ["Avoin laskusaldo", "Задолженность по счетам", "Outstanding invoices"],
  ["Laskut", "Счета", "Invoices"],
  [
    "Auttajat: tilaukset / valmiit",
    "Исполнители · принятые / выполненные",
    "Helpers · assigned / completed",
  ],
  ["Perutut", "Отменённые", "Cancelled"],
  ["Määrä", "Сумма", "Amount"],
  ["Tapahtuma", "Операция", "Event"],
  ["Aika", "Время", "Time"],
  ["Tekijä", "Участник", "Actor"],
  ["Saldo", "Остаток", "Balance"],
];
const key = "apukaveri-demo-language",
  langs = ["fi", "ru", "en"],
  el = (id) => document.getElementById(id);
let lang = localStorage.getItem(key) || "fi",
  cats = [],
  filters = new URLSearchParams();
if (!langs.includes(lang)) lang = "fi";
const t = (i) => words[i][langs.indexOf(lang)],
  money = (c) =>
    new Intl.NumberFormat(lang, { style: "currency", currency: "EUR" }).format(
      c / 100,
    );
const field = (i, id, type = "text") =>
  "<label>" + t(i) + '<input id="' + id + '" type="' + type + '"></label>';
const btn = (i, id) => '<button id="' + id + '">' + t(i) + "</button>";
async function api(path, body) {
  const r = await fetch(
    "/api/" + path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  if (!r.ok) throw Error(String(r.status));
  return r.json();
}
const terms = {
  accrual: ["Provisio ansaittu", "Начислена комиссия", "Commission accrued"],
  cash_due: ["Laskutettava provisio", "Долг по комиссии", "Commission due"],
  fee_received: ["Provisiomaksu", "Оплата комиссии", "Fee received"],
  refund: ["Palautus", "Возврат", "Refund"],
  payout: ["Tilitys", "Выплата", "Payout"],
  request_created: ["Pyyntö luotu", "Создана заявка", "Request created"],
  offer_created: ["Tarjous luotu", "Создано предложение", "Offer created"],
  offer_viewed: ["Tarjous avattu", "Открыто предложение", "Offer viewed"],
  offer_accepted: [
    "Tarjous hyväksytty",
    "Предложение принято",
    "Offer accepted",
  ],
  assigned: ["Auttaja nimetty", "Назначен исполнитель", "Helper assigned"],
  cash_claimed: [
    "Käteisilmoitus",
    "Заявление о наличном расчёте",
    "Cash attestation",
  ],
  cash_confirmed: [
    "Käteinen vahvistettu",
    "Обе стороны подтвердили наличные",
    "Cash confirmed by both parties",
  ],
  completion_claimed: [
    "Työ ilmoitettu tehdyksi",
    "Сторона подтвердила работу",
    "Completion claimed",
  ],
  completion_confirmed: [
    "Työ vahvistettu",
    "Обе стороны подтвердили работу",
    "Completion confirmed",
  ],
  cancelled: ["Peruttu", "Отмена", "Cancelled"],
  disputed: ["Riita", "Спор", "Disputed"],
  policy_changed: [
    "Maksuasetus muutettu",
    "Изменена политика оплаты",
    "Payment policy changed",
  ],
  rate_changed: ["Provisio muutettu", "Изменена ставка", "Rate changed"],
  category_changed: [
    "Luokka muokattu",
    "Изменена категория",
    "Category edited",
  ],
  "dual completion": [
    "Molemmat vahvistivat",
    "Подтверждено обеими сторонами",
    "Both parties confirmed",
  ],
  "dual cash and completion": [
    "Työ ja käteinen vahvistettu",
    "Подтверждены работа и наличный расчёт",
    "Work and cash confirmed",
  ],
};
const label = (k) =>
  terms[String(k).replace(/^ledger_/, "")]?.[langs.indexOf(lang)] ?? k;
function table(id, rows, headers) {
  const target = el(id);
  if (!rows.length) {
    target.textContent = t(18);
    return;
  }
  const tab = document.createElement("table"),
    tr = tab.createTHead().insertRow();
  for (const i of headers) {
    const th = document.createElement("th");
    th.textContent = t(i);
    tr.append(th);
  }
  for (const row of rows) {
    const tr = tab.insertRow();
    for (const v of row) tr.insertCell().textContent = v ?? "—";
  }
  target.append(tab);
}
async function render() {
  document.documentElement.lang = lang;
  el("lang").value = lang;
  const [r, c] = await Promise.all([
    api("admin/report?" + filters),
    api("categories"),
  ]);
  cats = c;
  const done = r.orders.filter((o) => o.completed),
    sum = (arr, f) => arr.reduce((n, x) => n + f(x), 0);
  const cards = [
    [46, r.orders.filter((o) => o.cancelled).length],
    [40, r.users.active],
    [41, r.notifications.offered],
    [42, r.notifications.viewed],
    [43, money(sum(r.invoices, (i) => i.outstanding))],
    [1, r.users.registered],
    [2, r.users.available],
    [3, r.orders.length],
    [4, r.orders.filter((o) => o.provider).length],
    [5, done.length],
    [6, r.orders.filter((o) => o.disputed).length],
    [28, r.orders.filter((o) => !o.labour).length],
    [29, sum(done, (o) => (o.end - o.start) / 3600000).toFixed(1)],
    [30, money(sum(done, (o) => o.labour))],
    ...[
      ["accrual", 7],
      ["fee_received", 8],
      ["refund", 9],
      ["payout", 10],
    ].map(([k, i]) => [i, money(r.totals[k] || 0)]),
  ];
  el("panel").innerHTML =
    "<h1>" +
    t(0) +
    "</h1><p>" +
    t(37) +
    '</p><section class="row">' +
    field(19, "city") +
    field(20, "category", "number") +
    field(21, "helper", "number") +
    field(38, "from", "date") +
    field(39, "to", "date") +
    btn(22, "filter") +
    '</section><div class="cards">' +
    cards
      .map(
        ([i, v]) =>
          '<div class="card">' + t(i) + "<strong>" + v + "</strong></div>",
      )
      .join("") +
    "</div><section><h2>" +
    t(11) +
    '</h2><div class="row">' +
    field(12, "rate", "number") +
    field(13, "split", "checkbox") +
    field(14, "cash", "checkbox") +
    btn(15, "policy") +
    "</div></section><section><h2>" +
    t(23) +
    '</h2><select id="cat"></select><div class="row">' +
    langs
      .map(
        (l) =>
          "<label>" + l.toUpperCase() + '<input id="name-' + l + '"></label>',
      )
      .join("") +
    field(24, "percent", "number") +
    btn(15, "savecat") +
    "</div></section><section><h2>" +
    t(36) +
    '</h2><div class="row">' +
    field(21, "who", "number") +
    field(24, "custom", "number") +
    btn(15, "savehelper") +
    "</div></section><section><h2>" +
    t(31) +
    '</h2><div class="row">' +
    field(32, "order", "number") +
    '<select id="kind"></select>' +
    field(33, "amount", "number") +
    field(34, "reason") +
    btn(15, "entry") +
    "</div></section><section><h2>" +
    t(17) +
    '</h2><a id="csv">' +
    t(35) +
    '</a><div class="scroll" id="ledger"></div></section><section><h2>' +
    t(44) +
    '</h2><div class="scroll" id="invoices"></div></section><section><h2>' +
    t(45) +
    '</h2><div class="scroll" id="helpers"></div></section><section><h2>' +
    t(16) +
    '</h2><div class="scroll" id="events"></div></section><output id="status" aria-live="polite"></output>';
  el("csv").href = "/api/admin/export?" + filters;
  for (const f of ["city", "category", "helper"])
    el(f).value = filters.get(f) || "";
  for (const f of ["from", "to"])
    if (filters.has(f))
      el(f).value = new Date(
        Number(filters.get(f)) - (f === "to" ? 86400000 : 0),
      )
        .toISOString()
        .slice(0, 10);
  el("rate").value = r.policy.rate;
  el("cash").checked = !!r.policy.allow_cash;
  el("split").checked = !!r.policy.allow_split;
  for (const c of cats) el("cat").add(new Option(c[lang], c.id));
  el("cat").onchange = () => {
    const c = cats.find((x) => x.id === Number(el("cat").value));
    langs.forEach((l) => (el("name-" + l).value = c[l]));
    el("percent").value = c.commission;
  };
  el("cat").onchange();
  for (const [k, i] of [
    ["fee_received", 8],
    ["refund", 9],
    ["payout", 10],
  ])
    el("kind").add(new Option(t(i), k));
  table(
    "invoices",
    r.invoices.map((i) => [
      "#" + i.order_id,
      money(i.cents),
      money(i.outstanding),
    ]),
    [32, 47, 51],
  );
  table(
    "helpers",
    r.helpers.map((h) => ["#" + h.helper, h.assigned, h.completed]),
    [21, 4, 5],
  );
  table(
    "ledger",
    r.entries.map((l) => [
      "#" + l.order_id,
      label(l.kind),
      money(l.cents),
      label(l.reason),
    ]),
    [32, 48, 47, 34],
  );
  table(
    "events",
    r.events.map((e) => [
      new Date(e.stamp * 1000).toLocaleString(lang),
      label(e.kind),
      e.order_id,
      e.actor,
      label(e.detail),
    ]),
    [49, 48, 32, 50, 34],
  );
}
el("lang").onchange = () => {
  lang = el("lang").value;
  localStorage.setItem(key, lang);
  render();
};
el("panel").onclick = async (e) => {
  if (e.target.tagName !== "BUTTON") return;
  const id = e.target.id,
    n = (id) => Number(el(id).value);
  e.target.disabled = true;
  try {
    if (id === "filter") {
      filters = new URLSearchParams();
      for (const f of ["city", "category", "helper", "from", "to"])
        if (el(f).value)
          filters.set(
            f,
            ["from", "to"].includes(f)
              ? Date.parse(el(f).value) + (f === "to" ? 86400000 : 0)
              : el(f).value,
          );
    }
    if (id === "policy")
      await api("admin/policy", {
        rate: n("rate"),
        split: el("split").checked,
        cash: el("cash").checked,
      });
    if (id === "savecat")
      await api("admin/category", {
        id: n("cat"),
        commission: n("percent"),
        ...Object.fromEntries(langs.map((l) => [l, el("name-" + l).value])),
      });
    if (id === "savehelper")
      await api("admin/rate", {
        scope: "helper",
        subject: n("who"),
        rate: el("custom").value === "" ? null : n("custom"),
      });
    if (id === "entry")
      await api("admin/entry", {
        id: n("order"),
        kind: el("kind").value,
        cents: n("amount"),
        reason: el("reason").value,
        ref: crypto.randomUUID(),
      });
    await render();
    if (id !== "filter") el("status").textContent = t(25);
  } catch (err) {
    el("status").textContent = t(26) + " " + err.message;
    e.target.disabled = false;
  }
};
render().catch((err) => (el("panel").textContent = t(26) + " " + err.message));
