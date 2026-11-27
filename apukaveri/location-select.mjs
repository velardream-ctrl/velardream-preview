const words = {
  fi: { municipality: "Kunta", all: "Kaikki kunnat", choose: "Valitse kunta", city: "Valitse kaupunki" },
  ru: { municipality: "Муниципалитет", all: "Все муниципалитеты", choose: "Выберите муниципалитет", city: "Выберите город" },
  en: { municipality: "Municipality", all: "All municipalities", choose: "Choose a municipality", city: "Choose a city" },
};

export function setLocationSelects({
  municipality, city, label, locations, locale, required = false,
  selectedCity = city.value, onChange,
}) {
  const text = words[locale];
  const groups = new Map();
  for (const location of locations) {
    const id = location.municipalityId ?? location.id;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(location);
  }
  const name = (location) => location[locale] || location.fi;
  const municipalityName = (entries) =>
    entries[0].municipalityNames?.[locale] || name(entries[0]);
  const selectedGroup = [...groups].find(([, entries]) =>
    entries.some((location) => location.city === selectedCity),
  )?.[0];
  const previousGroup = municipality.value;
  label.textContent = text.municipality;
  municipality.replaceChildren(new Option(required ? text.choose : text.all, ""));
  for (const [id, entries] of [...groups].sort(([, a], [, b]) =>
    municipalityName(a).localeCompare(municipalityName(b), locale),
  )) {
    municipality.add(new Option(municipalityName(entries), id));
  }
  municipality.value = selectedGroup || (groups.has(previousGroup) ? previousGroup : "");
  function renderCities(preferred = "") {
    const entries = groups.get(municipality.value) || [];
    city.replaceChildren(new Option(text.city, ""));
    for (const location of entries) city.add(new Option(name(location), location.city));
    city.disabled = entries.length === 0;
    city.value = entries.some((location) => location.city === preferred) ? preferred : "";
  }
  renderCities(selectedCity);
  municipality.onchange = () => {
    renderCities();
    onChange?.();
  };
  city.onchange = onChange || null;
}
