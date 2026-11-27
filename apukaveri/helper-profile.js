const helperProfile = (() => {
  const key = "apukaveri-demo-helper-v1";
  const words = {
    fi: ["Tallenna oma palvelu", "Muokkaa omaa palvelua", "Olet demoauttaja tässä selaimessa.", "Tallennus epäonnistui. Salli sivuston tallennustila ja yritä uudelleen.", "Valitse palvelu ja tuntihinta. Tiedot tallennetaan tähän selaimeen.", "Oma palvelu", "Siirry omalle sivulle", "Tarkista palvelu ja tuntihinta."],
    ru: ["Сохранить услугу", "Изменить мою услугу", "Вы стали помощником в этом демо на этом устройстве.", "Сохранить не удалось. Разрешите сайту хранить данные и попробуйте ещё раз.", "Выберите услугу и цену за час. Они сохранятся в этом браузере.", "Моя услуга", "Перейти в мой кабинет", "Проверьте услугу и цену за час."],
    en: ["Save my service", "Edit my service", "You are a demo helper in this browser.", "Could not save. Allow site storage and try again.", "Choose a service and hourly rate. They will be saved in this browser.", "My service", "Open my account", "Check the service and hourly rate."]
  };
  function read() {
    try {
      const p = JSON.parse(localStorage.getItem(key));
      if (p && typeof p.service === "string" && Number.isInteger(p.rate) && p.rate >= 0 && p.rate <= 200 && ["fi","ru","en"].every(l => typeof p.labels?.[l] === "string")) return p;
    } catch {}
    return null;
  }
  return {read, words, save(profile) { localStorage.setItem(key, JSON.stringify(profile)); }};
})();
