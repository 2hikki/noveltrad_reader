
const TEMAS_MECENAS = ["sakura", "eink", "antique", "cyber", "grad-aurora", "grad-sunset", "grad-abyss", "grad-forest", "grad-quantum"];
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
  const GRADIENTES_MAP = {
    "grad-aurora": "radial-gradient(circle at 15% 10%, #134e4a 0%, #0f172a 55%, #1e1b4b 100%)",
    "grad-sunset": "linear-gradient(145deg, #3b1224 0%, #27131e 48%, #361c12 100%)",
    "grad-abyss":  "radial-gradient(circle at 80% 15%, #1e3a8a 0%, #090e1f 55%, #050811 100%)",
    "grad-forest": "linear-gradient(155deg, #0d2118 0%, #132a20 50%, #1a2e22 100%)",
    "grad-sakura": "linear-gradient(145deg, #2d1424 0%, #1f151c 52%, #2a1826 100%)"
  };
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
  if (typeof sincronizarTarjetasFuente === "function") sincronizarTarjetasFuente();
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
document.getElementById("btn-close-settings")?.addEventListener("click", () => document.getElementById("settings-drawer").classList.add("hidden"));
document.querySelectorAll("#theme-swatches button").forEach(btn => btn?.addEventListener("click", () => { prefs.theme = btn.dataset.themeVal; aplicarPreferencias(); }));
document.getElementById("font-family-select")?.addEventListener("change", (e) => { prefs.fontFamily = e.target.value; aplicarPreferencias(); });
document.getElementById("btn-font-inc")?.addEventListener("click", () => { if (prefs.fontSize < 30) { prefs.fontSize++; aplicarPreferencias(); } });
document.getElementById("btn-font-dec")?.addEventListener("click", () => { if (prefs.fontSize > 13) { prefs.fontSize--; aplicarPreferencias(); } });
document.getElementById("btn-lh-inc")?.addEventListener("click", () => { if (prefs.lineHeight < 2.4) { prefs.lineHeight = +(prefs.lineHeight + 0.1).toFixed(2); aplicarPreferencias(); } });
document.getElementById("btn-lh-dec")?.addEventListener("click", () => { if (prefs.lineHeight > 1.3) { prefs.lineHeight = +(prefs.lineHeight - 0.1).toFixed(2); aplicarPreferencias(); } });
document.getElementById("width-slider")?.addEventListener("input", (e) => { prefs.readerWidth = parseInt(e.target.value, 10); aplicarPreferencias(); });

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


// ==========================================
// EXTRACTOR DE PALETA DE PORTADA (MODO CAMALEÓN MECENAS)
// ==========================================
window.aplicarGradientePortada = function (imgUrl) {
  if (imgUrl) window._ultimaPortadaCamaleon = imgUrl;
  const targetUrl = imgUrl || window._ultimaPortadaCamaleon || document.querySelector(".detail-cover img, .novel-cover img, img[src*='cover'], img[src*='portada']")?.src;
  const activo = window.esMecenas && typeof prefs !== "undefined" && prefs.chameleonGrad;
  if (!activo) {
    document.body.classList.remove("chameleon-active");
    return;
  }

  const aplicarFallbackHash = (seedStr) => {
    let h = 2166136261;
    const str = String(seedStr || "noveltrad");
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const hue1 = Math.abs(h) % 360;
    const hue2 = (hue1 + 38) % 360;
    const f1 = `hsl(${hue1}, 42%, 16%)`;
    const f2 = `hsl(${hue2}, 38%, 11%)`;
    document.documentElement.style.setProperty("--dyn-c1", f1);
    document.documentElement.style.setProperty("--dyn-c2", f2);
    document.body.classList.add("chameleon-active");
    document.body.style.background = `linear-gradient(155deg, ${f1} 0%, ${f2} 100%) fixed`;
  };

  if (!targetUrl) {
    aplicarFallbackHash(document.title);
    return;
  }

  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 16, 16);
      const data = ctx.getImageData(0, 0, 16, 16).data;
      let r1 = 0, g1 = 0, b1 = 0, c1 = 0, r2 = 0, g2 = 0, b2 = 0, c2 = 0;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = (y * 16 + x) * 4;
          const r = Math.min(76, Math.round(data[i] * 0.30));
          const g = Math.min(76, Math.round(data[i + 1] * 0.30));
          const b = Math.min(88, Math.round(data[i + 2] * 0.32));
          if (y < 8) { r1 += r; g1 += g; b1 += b; c1++; }
          else { r2 += r; g2 += g; b2 += b; c2++; }
        }
      }
      const c1Str = `rgb(${Math.round(r1/c1)}, ${Math.round(g1/c1)}, ${Math.round(b1/c1)})`;
      const c2Str = `rgb(${Math.round(r2/c2)}, ${Math.round(g2/c2)}, ${Math.round(b2/c2)})`;
      document.documentElement.style.setProperty("--dyn-c1", c1Str);
      document.documentElement.style.setProperty("--dyn-c2", c2Str);
      document.body.classList.add("chameleon-active");
      document.body.style.background = `linear-gradient(155deg, ${c1Str} 0%, ${c2Str} 100%) fixed`;
    } catch (e) {
      aplicarFallbackHash(targetUrl);
    }
  };
  img.onerror = () => aplicarFallbackHash(targetUrl);
  img.src = targetUrl;
};

document.addEventListener("change", (e) => {
  if (e.target && e.target.id === "chk-dynamic-cover-grad") {
    if (!window.esMecenas) {
      e.target.checked = false;
      if (typeof abrirModalDonaciones === "function") abrirModalDonaciones();
      return;
    }
    prefs.chameleonGrad = e.target.checked;
    localStorage.setItem("nt_prefs", JSON.stringify(prefs));
    if (!prefs.chameleonGrad) document.body.classList.remove("chameleon-active");
  }
});

// Bloquear selector RGB libre si no es Mecenas
document.addEventListener("input", (e) => {
  if (e.target && (e.target.id === "custom-bg-color" || e.target.id === "input-custom-bg") && !window.esMecenas) {
    e.stopImmediatePropagation();
    if (typeof abrirModalDonaciones === "function") abrirModalDonaciones();
  }
}, true);


// ==========================================
// SELECTOR VISUAL DE TIPOGRAFÍAS CON PREVIEW
// ==========================================
function sincronizarTarjetasFuente() {
  const actual = (prefs && prefs.font) || "'Lora', Georgia, serif";
  const preview = document.getElementById("font-live-preview");
  if (preview) preview.style.fontFamily = actual;

  document.querySelectorAll(".font-card-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.fontVal === actual);
  });
}

document.addEventListener("click", (e) => {
  const btnFont = e.target.closest(".font-card-btn");
  if (!btnFont) return;
  const val = btnFont.dataset.fontVal;

  if (esFuncionMecenasBloqueada(val)) {
    e.stopImmediatePropagation();
    e.preventDefault();
    if (typeof abrirModalDonaciones === "function") abrirModalDonaciones();
    return;
  }

  prefs.font = val;
  localStorage.setItem("nt_prefs", JSON.stringify(prefs));
  if (typeof aplicarPreferencias === "function") aplicarPreferencias();
  sincronizarTarjetasFuente();
}, true);

document.addEventListener("DOMContentLoaded", sincronizarTarjetasFuente);


document.addEventListener("click", (e) => {
  const rgbEl = e.target.closest("#custom-bg-color, #input-custom-bg, .custom-bg-row, [data-mecenas-rgb]");
  if (rgbEl && !window.esMecenas) {
    e.stopImmediatePropagation();
    e.preventDefault();
    if (typeof abrirModalDonaciones === "function") abrirModalDonaciones();
  }
}, true);

document.addEventListener("click", (e) => {
  const esColorPicker = e.target.matches('input[type="color"]') || e.target.closest('[data-mecenas-rgb]');
  if (esColorPicker && !window.esMecenas) {
    e.stopImmediatePropagation();
    e.preventDefault();
    if (typeof abrirModalDonaciones === "function") abrirModalDonaciones();
  }
}, true);


// === BOTÓN RÁPIDO Aa EN LECTURA + TRIGGER INMEDIATO DE CAMALEÓN ===
document.addEventListener("DOMContentLoaded", () => {
  const chkCam = document.getElementById("chk-dynamic-cover-grad");
  if (chkCam) {
    chkCam.addEventListener("change", () => {
      if (typeof prefs !== "undefined") {
        prefs.chameleonGrad = chkCam.checked;
        if (typeof guardarPreferencias === "function") guardarPreferencias();
      }
      if (typeof window.aplicarGradientePortada === "function") window.aplicarGradientePortada();
    });
  }

  // Crear botón Aa para lectura de capítulos
  if (!document.getElementById("btn-reader-aa")) {
    const btnAa = document.createElement("button");
    btnAa.id = "btn-reader-aa";
    btnAa.type = "button";
    btnAa.title = "Ajustar fuente y apariencia";
    btnAa.innerHTML = "Aa ⚙";
    btnAa.addEventListener("click", (e) => {
      e.stopPropagation();
      const drawer = document.getElementById("settings-drawer");
      if (drawer) drawer.classList.toggle("hidden");
    });
    document.body.appendChild(btnAa);

    // Mostrar btn-reader-aa solo cuando haya un capítulo abierto en pantalla
    const syncBtnAa = () => {
      const rv = document.querySelector(".reader-view, #reader-view, #chapter-content, .chapter-body");
      const visible = rv && !rv.classList.contains("hidden") && rv.offsetParent !== null;
      btnAa.style.display = visible ? "inline-flex" : "none";
    };
    const obs = new MutationObserver(syncBtnAa);
    obs.observe(document.body, { attributes: true, subtree: true, childList: true });
    setInterval(syncBtnAa, 600);
  }
});


// === GARANTIZAR CLIC EN #gradient-grid Y ACTUALIZACIÓN DE CAMALEÓN ===
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#gradient-grid [data-theme-val], #theme-swatches [data-theme-val]");
  if (!btn) return;
  const val = btn.dataset.themeVal;
  if (typeof esFuncionMecenasBloqueada === "function" && esFuncionMecenasBloqueada(val)) return;
  prefs.theme = val;
  if (typeof aplicarPreferencias === "function") aplicarPreferencias();
});
