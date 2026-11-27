const helperProfile = (() => {
  const key = "apukaveri-demo-helper-v1";
  const words = {
    fi: ["Tallenna oma palvelu", "Muokkaa omaa palvelua", "Olet demoauttaja tässä selaimessa.", "Tallennus epäonnistui. Salli sivuston tallennustila ja yritä uudelleen.", "Valitse palvelu ja tuntihinta. Tiedot tallennetaan tähän selaimeen.", "Oma palvelu", "Siirry omalle sivulle", "Tarkista palvelu ja tuntihinta."],
    ru: ["Сохранить услугу", "Изменить мою услугу", "Вы стали помощником в этом демо на этом устройстве.", "Сохранить не удалось. Разрешите сайту хранить данные и попробуйте ещё раз.", "Выберите услугу и цену за час. Они сохранятся в этом браузере.", "Моя услуга", "Перейти в мой кабинет", "Проверьте услугу и цену за час."],
    en: ["Save my service", "Edit my service", "You are a demo helper in this browser.", "Could not save. Allow site storage and try again.", "Choose a service and hourly rate. They will be saved in this browser.", "My service", "Open my account", "Check the service and hourly rate."]
  };
  function valid(profile) {
    return profile && typeof profile.service === "string" &&
      Number.isInteger(profile.rate) && profile.rate >= 0 && profile.rate <= 200 &&
      ["fi", "ru", "en"].every(lang => typeof profile.labels?.[lang] === "string");
  }
  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      // Earlier versions stored a single service under the same key.
      return Array.from(new Map((Array.isArray(saved) ? saved : [saved])
        .filter(valid).map(item => [item.service, item])).values());
    } catch {
      return [];
    }
  }
  function save(profile) {
    if (!valid(profile)) throw new TypeError("Invalid service");
    const services = new Map(read().map(item => [item.service, item]));
    services.set(profile.service, profile);
    localStorage.setItem(key, JSON.stringify([...services.values()]));
  }
  function remove(service) {
    localStorage.setItem(key, JSON.stringify(read().filter(item => item.service !== service)));
  }
  return { read, words, save, remove };
})();
