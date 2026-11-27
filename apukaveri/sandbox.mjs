import { setLocationSelects } from "./location-select.mjs";
import { resolveHelsinki, helsinkiDate } from "./helsinki.mjs";
import { uploadThumbnail, displayThumbnail } from "./profile-tools.mjs";
const words = [
  [
    "Apua lähellä, kun sitä tarvitset.",
    "Помощь рядом, когда она нужна.",
    "Help nearby, when you need it.",
  ],
  ["Testitili", "Тестовая учётная запись", "Test account"],
  [
    "Käytä vain keksittyjä testitietoja. Vahvistuskoodi näkyy paikallisen palvelimen päätteessä.",
    "Используйте только вымышленные данные. Код подтверждения появится в терминале локального сервера.",
    "Use invented test details only. The verification code appears in the local server terminal.",
  ],
  ["Testisähköposti", "Тестовый email", "Test email"],
  [
    "Testisalasana (12+ merkkiä)",
    "Тестовый пароль (от 12 символов)",
    "Test password (12+ characters)",
  ],
  ["Muista minut", "Запомнить меня", "Remember me"],
  ["Rekisteröidy", "Регистрация", "Register"],
  ["Kirjaudu", "Войти", "Sign in"],
  ["Koodi", "Код", "Code"],
  ["Vahvista", "Подтвердить", "Verify"],
  ["Pyydä palautuskoodi", "Запросить код сброса", "Request reset code"],
  ["Aseta uusi salasana", "Установить новый пароль", "Set new password"],
  ["Oma profiili", "Моя анкета", "My profile"],
  ["Kaupunki", "Город", "City"],
  ["Palvelu", "Услуга", "Service"],
  ["Ota testipyyntöjä", "Принимать тестовые заявки", "Accept test requests"],
  ["Tallenna", "Сохранить", "Save"],
  ["Tilaukset", "Заказы", "Orders"],
  ["Luo testipyyntö", "Создать тестовую заявку", "Create test request"],
  ["Päivitä", "Обновить", "Refresh"],
  ["Hyväksy", "Принять", "Accept"],
  ["Kirjaudu ulos", "Выйти", "Sign out"],
  ["Valmis", "Готово", "Done"],
  ["Toiminto epäonnistui", "Действие не выполнено", "Action failed"],
  ["Vapaa", "Открыт", "Open"],
  ["Varattu", "Назначен", "Assigned"],
  ["Ei tilauksia", "Заказов пока нет", "No orders yet"],
  ["Etusivu", "Главная", "Home"],
  ["Omistajan hallinta", "Панель владельца", "Owner dashboard"],
  ["Käyttäjät", "Пользователи", "Users"],
  ["Palvelumaksu %", "Комиссия %", "Commission %"],
  ["Etsi auttajia", "Найти помощников", "Find helpers"],
  ["Kaikki sopivat", "Все подходящие", "All eligible"],
  ["Suosikit", "Избранные", "Favourites"],
  [
    "Suosikit ensin (5 min)",
    "Сначала избранные (5 минут)",
    "Favourites first (5 min)",
  ],
  ["Lisää suosikiksi", "Добавить в избранные", "Add favourite"],
  ["Poista suosikeista", "Убрать из избранных", "Remove favourite"],
  ["Varaa", "Забронировать", "Book"],
  ["Ilmoitus", "Объявление", "Listing"],
  ["Vastaanottajat", "Получатели", "Recipients"],
  [
    "Huomenna 12–13 · Helsinki",
    "Завтра 12–13 · Хельсинки",
    "Tomorrow 12–13 · Helsinki",
  ],
  ["Ei vapaita auttajia", "Свободных помощников нет", "No available helpers"],
  ["Työ tehty", "Работа выполнена", "Work completed"],
  [
    "Käteismaksu vahvistettu",
    "Подтвердить наличный расчёт",
    "Confirm cash payment",
  ],
  ["Avaa riita", "Открыть спор", "Dispute"],
  ["Työ (senttiä)", "Оплата труда (центы)", "Labour (cents)"],
  ["Kulut (senttiä)", "Возмещение (центы)", "Expenses (cents)"],
  ["Maksumalli", "Модель оплаты", "Payment model"],
  ["Verkkomaksu", "Полностью через сайт", "Online"],
  ["Jaettu maksu", "Комиссия через сайт", "Split payment"],
  ["Käteinen ja lasku", "Наличные со счётом", "Cash and invoice"],
  ["Testikuva", "Тестовое фото", "Test photo"],
  ["Poista kuva", "Удалить фото", "Remove photo"],
  [
    "Viikko / päivämäärä",
    "Неделя / конкретная дата",
    "Weekday / specific date",
  ],
  ["Lisää aikaväli", "Добавить интервал", "Add interval"],
  ["Sulje päivä", "Выходной", "Close day"],
  [
    "Palauta viikkoaikataulu",
    "Вернуть недельный график",
    "Restore weekly schedule",
  ],
  ["Näytä tarjous", "Открыть предложение", "View offer"],
  ["Päivä", "Дата", "Date"],
  ["Alkaa", "Начало", "Start"],
  ["Päättyy", "Окончание", "End"],
  [
    "Myöhempi kellonaika syyskellonsiirrossa",
    "Позднее время при осеннем переводе часов",
    "Later occurrence when clocks go back",
  ],
  ["Peru tilaus", "Отменить заказ", "Cancel order"],
  ["Peruttu", "Отменён", "Cancelled"],
  ["Lukematta", "Непрочитанные", "Unread"],
  [
    "Auttajalle kuluineen",
    "Исполнителю с возмещением",
    "To helper incl. expenses",
  ],
  ["Työn vahvistukset", "Подтверждения работы", "Work confirmations"],
  ["Käteismaksun vahvistukset", "Подтверждения наличных", "Cash confirmations"],
  ["Riita", "Спор", "Disputed"],
];
const key = "apukaveri-demo-language",
  langs = ["fi", "ru", "en"];
let draft = {},
  pixels = null;
let locale = localStorage.getItem(key) || "fi",
  me = null,
  cats = [],
  locations = [];
if (!langs.includes(locale)) locale = "fi";
const t = (i) => words[i][langs.indexOf(locale)],
  el = (id) => document.getElementById(id);
const field = (i, control) => "<label>" + t(i) + control + "</label>";
const button = (i) => '<button data-action="' + i + '">' + t(i) + "</button>";
async function api(name, data) {
  const r = await fetch(
    "api/" + name,
    data
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      : {},
  );
  if (!r.ok) throw Error(String(r.status));
  return r.json();
}
function render() {
  document.documentElement.lang = locale;
  el("lang").value = locale;
  let html = "<h1>" + t(0) + '</h1><a href="index.html">' + t(27) + "</a>";
  if (!me)
    html +=
      "<article><h2>" +
      t(1) +
      "</h2><p>" +
      t(2) +
      "</p>" +
      field(3, '<input id="email" value="demo-1@example.invalid">') +
      field(4, '<input id="pwd" type="password" autocomplete="off">') +
      field(5, '<input id="remember" type="checkbox">') +
      '<div class="actions">' +
      button(6) +
      button(7) +
      "</div>" +
      field(8, '<input id="code">') +
      '<div class="actions">' +
      button(9) +
      button(10) +
      button(11) +
      "</div></article>";
  else
    html +=
      "<article><h2>" +
      t(12) +
      " · " +
      me.id +
      "</h2>" +
      '<label><span id="municipalityLabel"></span><select id="municipality" required></select></label>' +
      field(
        13,
        '<select id="city" required></select>',
      ) +
      field(14, '<select id="category"></select>') +
      field(15, '<input id="available" type="checkbox">') +
      "<details><summary>" +
      t(53) +
      '</summary><select id="day"></select><input type="date" id="date"><div class="actions"><input type="time" id="begin" value="09:00"><input type="time" id="end" value="17:00">' +
      button(54) +
      button(55) +
      button(56) +
      '</div><p id="intervals"></p></details>' +
      button(16) +
      '<hr><canvas width="48" height="48" id="avatar"></canvas>' +
      field(
        51,
        '<input id="photo" type="file" accept="image/png,image/jpeg,image/webp">',
      ) +
      button(52) +
      "</article><article><h2>" +
      t(17) +
      "</h2>" +
      field(45, '<input type="number" id="labour" min="0" value="0">') +
      field(46, '<input type="number" id="expenses" min="0" value="0">') +
      field(
        47,
        '<select id="model"><option value="online">' +
          t(48) +
          '</option><option value="split">' +
          t(49) +
          '</option><option value="cash">' +
          t(50) +
          "</option></select>",
      ) +
      field(
        39,
        '<select id="audience"><option value="all">' +
          t(32) +
          '</option><option value="favourites">' +
          t(33) +
          '</option><option value="first">' +
          t(34) +
          "</option></select>",
      ) +
      '<p>Europe/Helsinki</p><div class="actions">' +
      field(58, '<input type="date" id="orderDate">') +
      field(59, '<input type="time" id="orderStart" value="12:00">') +
      field(60, '<input type="time" id="orderEnd" value="13:00">') +
      "</div>" +
      field(61, '<input id="fold" type="checkbox">') +
      '<div id="matches"></div><div class="actions">' +
      button(31) +
      button(38) +
      button(18) +
      button(19) +
      '</div><p id="unread"></p><ul id="orders"></ul></article>' +
      button(21);
  el("app").innerHTML = html;
  if (me) {
    el("orderDate").value = helsinkiDate(Date.now() + 86400000);
    const day = el("day");
    for (let i = 0; i < 7; i++)
      day.add(
        new Option(
          new Intl.DateTimeFormat(locale, {
            weekday: "long",
            timeZone: "UTC",
          }).format(Date.UTC(2026, 10, 22 + i)),
          i,
        ),
      );
    day.onchange = showIntervals;
    el("date").onchange = showIntervals;
    showIntervals();
    displayThumbnail(el("avatar"), pixels);
    el("photo").onchange = async (e) => {
      try {
        const value = await uploadThumbnail(e.target.files[0]);
        await api("avatar", { pixels: value });
        pixels = value;
        displayThumbnail(el("avatar"), pixels);
        el("status").textContent = t(22);
      } catch (err) {
        el("status").textContent = t(23) + " " + err.message;
      }
    };
    for (const c of cats.filter((c) => !c.restricted))
      el("category").add(new Option(c.icon + " " + c[locale], c.id));
    el("category").value = me.category || 3;
    setLocationSelects({
      municipality: el("municipality"),
      city: el("city"),
      label: el("municipalityLabel"),
      locations,
      locale,
      required: true,
      selectedCity: me.city,
    });
    el("available").checked = !!me.available;
  }
}
function slotKey() {
  return el("date").value
    ? ["overrides", el("date").value]
    : ["weekly", el("day").value];
}
function showIntervals() {
  const [type, k] = slotKey();
  const rows =
    draft[type]?.[k] ??
    (type === "overrides"
      ? draft.weekly?.[new Date(k + "T00:00:00Z").getUTCDay()]
      : []);
  el("intervals").textContent =
    (rows || []).map((r) => r.start + "–" + r.end).join(", ") || "—";
}
async function orders() {
  const rows = await api("orders"),
    inbox = await api("inbox");
  const ul = el("orders");
  if (!ul) return;
  el("unread").textContent = t(64) + " · " + inbox.unread;
  ul.replaceChildren();
  if (!rows.length) ul.textContent = t(26);
  for (const row of rows) {
    const li = document.createElement("li");
    li.textContent =
      "#" +
      row.id +
      " · " +
      cats.find((c) => c.id === row.category)?.[locale] +
      " · " +
      t(row.cancelled ? 63 : row.provider ? 25 : 24) +
      " · " +
      new Intl.DateTimeFormat(locale, {
        timeZone: "Europe/Helsinki",
        dateStyle: "short",
        timeStyle: "short",
      }).format(row.start) +
      " ";
    const amount = (cents) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
      }).format(cents / 100);
    const amounts = document.createElement("p");
    amounts.textContent = [
      t(45) + " · " + amount(row.labour),
      t(46) + " · " + amount(row.reimbursement),
      t(30) + " · " + row.percent + "% (" + amount(row.fee) + ")",
      t(65) + " · " + amount(row.labour + row.reimbursement - row.fee),
    ].join(" / ");
    li.append(amounts);
    if (row.confirmations.length) {
      const summary = document.createElement("p");
      summary.textContent = [
        t(66) +
          " " +
          row.confirmations.filter(
            (c) => c.topic === "completion" && c.answer === "yes",
          ).length +
          "/2",
        ...(["cash", "split"].includes(row.model)
          ? [
              t(67) +
                " " +
                row.confirmations.filter(
                  (c) => c.topic === "cash" && c.answer === "yes",
                ).length +
                "/2",
            ]
          : []),
        ...(row.confirmations.some((c) => c.answer === "dispute")
          ? [t(68)]
          : []),
      ].join(" · ");
      li.append(summary);
    }
    if (
      !row.cancelled &&
      !row.provider &&
      row.customer !== me.id &&
      row.kind !== "listing"
    ) {
      const b = document.createElement("button");
      b.textContent = t(20);
      b.dataset.claim = row.id;
      const view = document.createElement("button");
      view.textContent = t(57);
      view.dataset.view = row.id;
      li.append(view, b);
    }
    if (!row.cancelled && (row.customer === me.id || row.provider === me.id)) {
      const cancel = document.createElement("button");
      cancel.textContent = t(62);
      cancel.dataset.cancel = row.id;
      li.append(cancel);
    }
    if (
      !row.cancelled &&
      row.provider &&
      (row.customer === me.id || row.provider === me.id)
    ) {
      for (const k of [
        42,
        ...(["cash", "split"].includes(row.model) ? [43] : []),
        44,
      ]) {
        const btn = document.createElement("button");
        btn.textContent = t(k);
        btn.dataset.confirm = row.id;
        btn.dataset.key = k;
        li.append(btn);
      }
    }
    ul.append(li);
  }
}
async function refresh() {
  me = await api("me");
  pixels = (await api("avatar")).pixels;
  draft = JSON.parse(me.schedule);
  draft.weekly ??= Object.fromEntries(
    Array.from({ length: 7 }, (_, n) => [
      n,
      [{ start: "09:00", end: "17:00" }],
    ]),
  );
  draft.overrides ??= {};
  [cats, locations] = await Promise.all([api("categories"), api("locations")]);
  render();
  await orders();
}
el("lang").onchange = async (e) => {
  locale = e.target.value;
  localStorage.setItem(key, locale);
  el("status").textContent = "";
  render();
  if (me) await orders();
};
el("app").onclick = async (e) => {
  if (!e.target.matches("button")) return;
  const i = Number(e.target.dataset.action),
    val = (id) => el(id).value;
  try {
    if (e.target.dataset.cancel)
      await api("cancel", { id: Number(e.target.dataset.cancel) });
    if (e.target.dataset.view)
      await api("offers/view", { id: Number(e.target.dataset.view) });
    if (i === 52) {
      await api("avatar", { pixels: null });
      pixels = null;
      displayThumbnail(el("avatar"), null);
    }
    if ([54, 55, 56].includes(i)) {
      const [type, k] = slotKey();
      if (i === 54) {
        const start = val("begin"),
          end = val("end");
        if (!start || start >= end) throw Error("⏱");
        (draft[type][k] ??= []).push({ start, end });
      } else if (i === 55) draft[type][k] = [];
      else if (type === "overrides") delete draft.overrides[k];
      showIntervals();
    }
    if (e.target.dataset.confirm) {
      const k = Number(e.target.dataset.key);
      await api("confirm", {
        id: Number(e.target.dataset.confirm),
        topic: k === 43 ? "cash" : "completion",
        answer: k === 44 ? "dispute" : "yes",
      });
    }
    if (e.target.dataset.claim)
      await api("claim", { id: Number(e.target.dataset.claim) });
    if ([6, 7, 10].includes(i))
      await api({ 6: "register", 7: "login", 10: "recover" }[i], {
        email: val("email"),
        password: val("pwd"),
        remember: el("remember").checked,
      });
    if ([9, 11].includes(i))
      await api(i === 9 ? "verify" : "reset", {
        code: val("code"),
        password: val("pwd"),
      });
    if (i === 7) await refresh();
    if (i === 16)
      await api("profile", {
        alias: "Demo " + me.id,
        city: val("city"),
        category: Number(val("category")),
        available: el("available").checked,
        schedule: draft,
      });
    if (i === 18 || i === 38 || i === 31 || e.target.dataset.book) {
      const stamp = (id) =>
          resolveHelsinki(val("orderDate"), val(id), el("fold").checked),
        start = stamp("orderStart"),
        end = stamp("orderEnd");
      if (!start || !end || end <= start) throw Error("Europe/Helsinki");
      const slot = {
        city: val("city"),
        category: Number(val("category")),
        start,
        end,
      };
      if (i === 31) {
        const matches = await api("search", slot),
          favs = await api("favourites"),
          holder = el("matches");
        holder.replaceChildren();
        if (!matches.length) holder.textContent = t(41);
        for (const m of matches) {
          const div = document.createElement("p");
          div.textContent = m.alias + " · " + m.city + " ";
          const fav = document.createElement("button"),
            on = favs.some((f) => f.helper === m.user);
          fav.dataset.fav = m.user;
          fav.dataset.enabled = String(!on);
          fav.textContent = t(on ? 36 : 35);
          const book = document.createElement("button");
          book.dataset.book = m.user;
          book.textContent = t(37);
          div.append(fav, book);
          holder.append(div);
        }
      } else
        await api("orders", {
          ...slot,
          labour: Number(val("labour")),
          reimbursement: Number(val("expenses")),
          model: val("model"),
          kind: e.target.dataset.book
            ? "planned"
            : i === 38
              ? "listing"
              : "urgent",
          audience: e.target.dataset.book ? "all" : val("audience"),
          target: e.target.dataset.book ? Number(e.target.dataset.book) : null,
        });
    }
    if (e.target.dataset.fav) {
      const enabled = e.target.dataset.enabled === "true";
      await api("favourites", {
        helper: Number(e.target.dataset.fav),
        enabled,
      });
      e.target.dataset.enabled = String(!enabled);
      e.target.textContent = t(enabled ? 36 : 35);
    }
    if (i === 21) {
      await api("logout", {});
      me = null;
      render();
    }
    if (me) await orders();
    el("status").textContent = t(22);
  } catch (err) {
    el("status").textContent = t(23) + " (" + err.message + ")";
  }
};
render();
try {
  await refresh();
} catch {}

if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {});

setInterval(() => {
  if (me && !document.hidden) orders().catch(() => {});
}, 30000);
