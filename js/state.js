let catalogoData = [];
let noticiasData = [];
let tabAnterior = "library";
let tabActual = "library";
let categoriaActiva = "Todas";
let filtroBusqueda = "";
let modoIncognito = JSON.parse(localStorage.getItem("nt_incognito") || "false");
let soloPendientes = JSON.parse(localStorage.getItem("nt_solo_pendientes") || "false");

let estadoActual = {
  novela: null,
  volumen: null,
  capitulosIndice: [],
  capIndex: 0
};
let seleccionActualTexto = "";
let reproductorActivo = false;

// ==========================================
// 0. CONFIGURACIÓN DE COMENTARIOS (GISCUS)
// ==========================================
const GISCUS_CONFIG = {
  repo: "2hikki/noveltrad_reader",
  repoId: "R_kgDOV67idg",
  category: "General",
  categoryId: "DIC_kwDOV67ids4DL6PB"
};

// ==========================================
// 2. PREFERENCIAS VISUALES
// ==========================================
const defaultPrefs = { theme: "mihon", fontSize: 18, lineHeight: 1.85, fontFamily: "'Lora', Georgia, serif", readerWidth: 820 };
const prefs = { ...defaultPrefs, ...JSON.parse(localStorage.getItem("nt_prefs") || "{}") };

function obtenerTemaGiscus() {
  const claros = ["sepia", "parchment", "softgray", "light"];
  return claros.includes(prefs.theme) ? "light" : "dark_dimmed";
}

function aplicarPreferencias() {
  document.documentElement.setAttribute("data-theme", prefs.theme);
  document.documentElement.style.setProperty("--font-size", prefs.fontSize + "px");
  document.documentElement.style.setProperty("--line-height", prefs.lineHeight);
  document.documentElement.style.setProperty("--font-family", prefs.fontFamily);
  document.documentElement.style.setProperty("--reader-width", prefs.readerWidth + "px");

  document.getElementById("lbl-fontsize").textContent = prefs.fontSize + "px";
  document.getElementById("lbl-lineheight").textContent = prefs.lineHeight.toFixed(2);
  document.getElementById("lbl-width").textContent = prefs.readerWidth + "px";
  document.getElementById("font-family-select").value = prefs.fontFamily;
  document.getElementById("width-slider").value = prefs.readerWidth;

  document.querySelectorAll("#theme-swatches button").forEach(btn => {
    btn.classList.toggle("active-swatch", btn.dataset.themeVal === prefs.theme);
  });
  localStorage.setItem("nt_prefs", JSON.stringify(prefs));
}

document.getElementById("btn-settings").addEventListener("click", () => {
  document.getElementById("music-drawer").classList.add("hidden");
  document.getElementById("settings-drawer").classList.toggle("hidden");
});
document.getElementById("btn-close-settings").addEventListener("click", () => document.getElementById("settings-drawer").classList.add("hidden"));
document.querySelectorAll("#theme-swatches button").forEach(btn => btn.addEventListener("click", () => { prefs.theme = btn.dataset.themeVal; aplicarPreferencias(); }));
document.getElementById("font-family-select").addEventListener("change", (e) => { prefs.fontFamily = e.target.value; aplicarPreferencias(); });
document.getElementById("btn-font-inc").addEventListener("click", () => { if (prefs.fontSize < 30) { prefs.fontSize++; aplicarPreferencias(); } });
document.getElementById("btn-font-dec").addEventListener("click", () => { if (prefs.fontSize > 13) { prefs.fontSize--; aplicarPreferencias(); } });
document.getElementById("btn-lh-inc").addEventListener("click", () => { if (prefs.lineHeight < 2.4) { prefs.lineHeight = +(prefs.lineHeight + 0.1).toFixed(2); aplicarPreferencias(); } });
document.getElementById("btn-lh-dec").addEventListener("click", () => { if (prefs.lineHeight > 1.3) { prefs.lineHeight = +(prefs.lineHeight - 0.1).toFixed(2); aplicarPreferencias(); } });
document.getElementById("width-slider").addEventListener("input", (e) => { prefs.readerWidth = parseInt(e.target.value, 10); aplicarPreferencias(); });
