// Language + Theme toggles (no backend yet)
const state = {
  lang: localStorage.getItem("mf_lang") || "ar",
  theme: localStorage.getItem("mf_theme") || "dark",
};

function setLang(lang) {
  state.lang = lang;
  localStorage.setItem("mf_lang", lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  // Switch text blocks
  document.querySelectorAll("[data-i18n-ar]").forEach((el) => {
    el.textContent = lang === "ar" ? el.dataset.i18nAr : el.dataset.i18nEn;
  });
}

function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem("mf_theme", theme);
  document.body.classList.toggle("light", theme === "light");
}

window.MF = {
  toggleLang() {
    setLang(state.lang === "ar" ? "en" : "ar");
  },
  toggleTheme() {
    setTheme(state.theme === "dark" ? "light" : "dark");
  },
};

setLang(state.lang);
setTheme(state.theme);
