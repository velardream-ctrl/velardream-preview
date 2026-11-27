export const languageCodes = ["fi", "en", "ru", "uk"];
const labels = {
  fi: ["Suomi", "Englanti", "Venäjä", "Ukraina"],
  ru: ["Финский", "Английский", "Русский", "Украинский"],
  en: ["Finnish", "English", "Russian", "Ukrainian"],
};
const legacyAliases = [
  ["finnish", "suomi", "финский", "фінська"],
  ["english", "englanti", "английский", "англійська"],
  ["russian", "venäjä", "русский", "російська"],
  ["ukrainian", "ukraina", "украинский", "українська", "ua"],
];
export function normalizeLanguages(value) {
  const parts = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.toLowerCase().split(/[\s,;·/]+/)
      : [];
  return languageCodes.filter((code, index) =>
    parts.includes(code) || legacyAliases[index].some(alias => parts.includes(alias)),
  );
}
export function validLanguages(value) {
  return Array.isArray(value) && value.length <= languageCodes.length &&
    new Set(value).size === value.length && value.every(code => languageCodes.includes(code));
}
export function showLanguageChoices(root, locale, selected) {
  const previous = new Set(selected ?? readLanguageChoices(root));
  root.replaceChildren(...languageCodes.map((code, index) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = code;
    input.checked = previous.has(code);
    label.append(input, document.createTextNode(" " + labels[locale][index]));
    return label;
  }));
}
export function readLanguageChoices(root) {
  return Array.from(root.querySelectorAll("input:checked"), input => input.value);
}
