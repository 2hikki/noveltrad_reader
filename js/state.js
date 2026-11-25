
const TEMAS_MECENAS = ["sakura", "eink", "antique", "cyber"];
const FUENTES_MECENAS = ["Literata", "Crimson Pro", "Atkinson Hyperlegible"];

function esFuncionMecenasBloqueada(valor) {
  if (window.esMecenas) return false;
  if (TEMAS_MECENAS.includes(valor)) return true;
  if (typeof valor === "string" && FUENTES_MECENAS.some(f => valor.includes(f))) return true;
  return false;
}

let catalogoData = [];
let noticiasData = [];
let tabAnterior = "library";
let tabActual = "library";
let categoriaActiva = "Todas";
let etiquetaExploreActiva = "Todas";
let ordenExploreAsc = true;
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


function hexARgb(hex) {
  const limpio = hex.replace("#", "");
  const num = parseInt(limpio.length === 3 ? limpio.split("").map(c => c + c).join("") : limpio, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function ajustarBrilloHex(hex, delta) {
  const { r, g, b } = hexARgb(hex);
  const clamp = (v) => Math.max(0, Math.min(255, v + delta));
  return "#" + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, "0")).join("");
}

function esColorClaro(hex) {
  const { r, g, b } = hexARgb(hex);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.56;
}

function limpiarVariablesTemaCustom() {
  ["--bg", "--surface", "--surface-high", "--text", "--muted", "--border"].forEach(prop => {
    document.documentElement.style.removeProperty(prop);
  });
}

function aplicarFondoCustomRGB(hex) {
  const claro = esColorClaro(hex);
  const root = document.documentElement.style;
  root.setProperty("--bg", hex);
  root.setProperty("--surface", ajustarBrilloHex(hex, claro ? -14 : 14));
  root.setProperty("--surface-high", ajustarBrilloHex(hex, claro ? -26 : 26));
  root.setProperty("--border", ajustarBrilloHex(hex, claro ? -36 : 34));
  root.setProperty("--text", claro ? "#1c1917" : "#ece6f0");
  root.setProperty("--muted", claro ? "#57534e" : "#bfb8c7");
}

function obtenerTemaGiscus() {
  if (prefs.theme === "custom" && prefs.customBg) return esColorClaro(prefs.customBg) ? "light" : "dark_dimmed";
  const claros = ["sepia", "parchment", "softgray", "light"];
  return claros.includes(prefs.theme) ? "light" : "dark_dimmed";
}

function aplicarPreferencias() {
  if (esFuncionMecenasBloqueada(prefs.theme)) {
    prefs.theme = "dark";
    localStorage.setItem("nt_prefs", JSON.stringify(prefs));
  }
  if (esFuncionMecenasBloqueada(prefs.font)) {
    prefs.font = "system-ui, -apple-system, sans-serif";
    localStorage.setItem("nt_prefs", JSON.stringify(prefs));
  }
  document.documentElement.setAttribute("data-theme", prefs.theme);
  if (prefs.theme === "custom" && prefs.customBg) {
    aplicarFondoCustomRGB(prefs.customBg);
  } else {
    limpiarVariablesTemaCustom();
  }
  document.documentElement.style.setProperty("--font-size", prefs.fontSize + "px");
  document.documentElement.style.setProperty("--line-height", prefs.lineHeight);
  document.documentElement.style.setProperty("--font-family", prefs.fontFamily);
  document.documentElement.style.setProperty("--reader-width", prefs.readerWidth + "px");

  document.getElementById("lbl-fontsize").textContent = prefs.fontSize + "px";
  document.getElementById("lbl-lineheight").textContent = prefs.lineHeight.toFixed(2);
  document.getElementById("lbl-width").textContent = prefs.readerWidth + "px";
  document.getElementById("font-family-select").value = prefs.fontFamily;
  document.getElementById("width-slider").value = prefs.readerWidth;
  const picker = document.getElementById("custom-bg-picker");
  const hexLbl = document.getElementById("lbl-custom-hex");
  if (picker && hexLbl) {
    const colorActual = prefs.customBg || "#16131d";
    picker.value = colorActual;
    hexLbl.textContent = colorActual.toUpperCase();
  }

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

document.getElementById("custom-bg-picker").addEventListener("input", (e) => {
  prefs.theme = "custom";
  prefs.customBg = e.target.value;
  aplicarPreferencias();
});


document.addEventListener("click", (e) => {
  const btnTheme = e.target.closest("[data-theme-val]");
  if (!btnTheme) return;
  const val = btnTheme.dataset.themeVal;
  if (TEMAS_MECENAS.includes(val) && !window.esMecenas) {
    e.stopImmediatePropagation();
    e.preventDefault();
    if (typeof abrirModalDonaciones === "function") abrirModalDonaciones();
  }
}, true);
