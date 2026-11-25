let catalogoData = [];
let noticiasData = [];
let tabAnterior = "library";
let tabActual = "library";
let categoriaActiva = "Todas";
let filtroBusqueda = "";
let modoIncognito = JSON.parse(localStorage.getItem("nt_incognito") || "false");
let soloPendientes = JSON.parse(localStorage.getItem("nt_solo_pendientes") || "false");
let soloDescargados = JSON.parse(localStorage.getItem("nt_solo_descargados") || "false");
let descargaEnCurso = null;
const OFFLINE_CACHE_NAME = "novelatrad-offline-vols";

function obtenerDescargadosMap() { return JSON.parse(localStorage.getItem("nt_descargados") || "{}"); }
function guardarDescargadosMap(mapa) { localStorage.setItem("nt_descargados", JSON.stringify(mapa)); }
function estaVolumenDescargado(slug, volClave) { return !!obtenerDescargadosMap()[`${slug}_${volClave}`]; }
function tieneAlgunVolumenDescargado(slug) { return Object.keys(obtenerDescargadosMap()).some((k) => k.startsWith(`${slug}_`)); }

function toggleOnlyDownloaded(forzarValor) {
  soloDescargados = typeof forzarValor === "boolean" ? forzarValor : !soloDescargados;
  localStorage.setItem("nt_solo_descargados", JSON.stringify(soloDescargados));
  const chk = document.getElementById("chk-only-downloaded");
  if (chk) chk.checked = soloDescargados;
}

async function descargarVolumenOffline(novela, vol) {
  if (descargaEnCurso) return alert("Ya hay una descarga en curso. Espera a que termine.");
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  await cache.add(vol.ruta_indice);
  const indiceData = await (await fetch(vol.ruta_indice)).json();
  const capitulos = indiceData.capitulos || [];

  descargaEnCurso = { slug: novela.slug, novelaTitulo: novela.titulo_es, volClave: vol.clave, volNumero: vol.numero, actual: 0, total: capitulos.length };
  actualizarUIProgresoDescarga();
  if (estadoActual.novela?.slug === novela.slug) abrirNovela(novela);

  try {
    if (novela.portada) await cache.add(novela.portada).catch(() => {});
    if (vol.portada) await cache.add(vol.portada).catch(() => {});
    for (let i = 0; i < capitulos.length; i++) {
      const rutaCap = `output/novelas/${novela.slug}/${vol.clave}/${capitulos[i].archivo}`;
      const res = await fetch(rutaCap);
      if (!res.ok) throw new Error(`Error descargando cap ${i + 1}`);
      await cache.put(rutaCap, res.clone());
      descargaEnCurso.actual = i + 1;
      actualizarUIProgresoDescarga();
    }
    const mapa = obtenerDescargadosMap();
    mapa[`${novela.slug}_${vol.clave}`] = { slug: novela.slug, novelaTitulo: novela.titulo_es, volClave: vol.clave, volNumero: vol.numero, totalCapitulos: capitulos.length, fecha: new Date().toLocaleDateString() };
    guardarDescargadosMap(mapa);
  } catch {
    alert("No se pudo completar la descarga. Verifica tu conexión.");
  } finally {
    descargaEnCurso = null;
    actualizarUIProgresoDescarga();
    if (tabActual === "downloads") renderizarListaDescargas();
    if (estadoActual.novela?.slug === novela.slug && document.getElementById("view-novel").classList.contains("active")) abrirNovela(novela);
  }
}

async function eliminarVolumenOffline(slug, volClave) {
  const mapa = obtenerDescargadosMap();
  const info = mapa[`${slug}_${volClave}`];
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  for (const req of await cache.keys()) {
    if (req.url.includes(`/${slug}/${volClave}/`)) await cache.delete(req);
  }
  delete mapa[`${slug}_${volClave}`];
  guardarDescargadosMap(mapa);
  if (tabActual === "downloads") renderizarListaDescargas();
  if (info && estadoActual.novela?.slug === slug && document.getElementById("view-novel").classList.contains("active")) abrirNovela(estadoActual.novela);
}

function actualizarUIProgresoDescarga() {
  const box = document.getElementById("active-download-box");
  if (!box) return;
  if (!descargaEnCurso) return box.classList.add("hidden");
  const pct = Math.round((descargaEnCurso.actual / Math.max(descargaEnCurso.total, 1)) * 100);
  box.classList.remove("hidden");
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; font-size:0.88rem; font-weight:600;">
      <span>Descargando: ${descargaEnCurso.novelaTitulo} (Vol. ${descargaEnCurso.volNumero})</span>
      <span style="color:var(--accent);">${descargaEnCurso.actual}/${descargaEnCurso.total}</span>
    </div>
    <div class="m3-progress-track"><div class="m3-progress-fill" style="width:${pct}%;"></div></div>
  `;
}

function abrirVistaDescargas() {
  actualizarUIProgresoDescarga();
  renderizarListaDescargas();
  mostrarVista("downloads");
}

function renderizarListaDescargas() {
  const list = document.getElementById("downloaded-vols-list");
  const items = Object.values(obtenerDescargadosMap());
  if (!items.length) {
    list.innerHTML = `<div class="kaomoji-empty"><div class="kaomoji-face">(￣o￣) . z Z</div><div class="kaomoji-text">No hay volúmenes descargados sin conexión</div></div>`;
    return;
  }
  list.innerHTML = items.map(item => `
    <div class="feed-item">
      <div>
        <div style="font-weight:600;">${item.novelaTitulo} — Vol. ${item.volNumero}</div>
        <div class="feed-meta">${item.totalCapitulos} capítulos offline • Guardado el ${item.fecha}</div>
      </div>
      <div style="display:flex; gap:0.4rem;">
        <button class="m3-btn tonal" onclick="abrirNovelaPorSlug('${item.slug}')">Abrir</button>
        <button class="m3-btn tonal" style="color:#f28b82;" onclick="eliminarVolumenOffline('${item.slug}', '${item.volClave}')">Borrar</button>
      </div>
    </div>
  `).join("");
}

document.getElementById("btn-clear-all-downloads").addEventListener("click", async () => {
  await caches.delete(OFFLINE_CACHE_NAME);
  guardarDescargadosMap({});
  renderizarListaDescargas();
});

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
// 1. REPRODUCTOR AMBIENTAL (SPOTIFY & YOUTUBE)
// ==========================================
function parsearUrlMultimedia(urlRaw) {
  const url = urlRaw.trim();
  if (!url) return null;

  const matchSpotify = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
  if (matchSpotify) {
    const tipo = matchSpotify[1];
    const id = matchSpotify[2];
    return {
      plataforma: "Spotify",
      embedUrl: `https://open.spotify.com/embed/${tipo}/${id}?utm_source=generator&theme=0`,
      height: tipo === "track" ? 152 : 352
    };
  }

  const matchYtList = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (matchYtList && !url.includes("watch?v=")) {
    return {
      plataforma: "YouTube",
      embedUrl: `https://www.youtube.com/embed/videoseries?list=${matchYtList[1]}&autoplay=1`,
      height: 200
    };
  }

  const matchYtVideo = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (matchYtVideo) {
    const listParam = matchYtList ? `&list=${matchYtList[1]}` : "";
    return {
      plataforma: "YouTube",
      embedUrl: `https://www.youtube.com/embed/${matchYtVideo[1]}?autoplay=1${listParam}`,
      height: 200
    };
  }
  return null;
}

function cargarEnReproductor(urlRaw) {
  const info = parsearUrlMultimedia(urlRaw);
  const wrapper = document.getElementById("player-embed-wrapper");
  if (!info) {
    alert("Enlace no reconocido. Usa un link de Spotify o YouTube.");
    return;
  }
  wrapper.classList.remove("hidden");
  wrapper.innerHTML = `<iframe src="${info.embedUrl}" height="${info.height}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
  reproductorActivo = true;
  document.getElementById("music-mini-pill").classList.add("hidden");
}

function obtenerPistasGuardadas() { return JSON.parse(localStorage.getItem("nt_pistas") || "[]"); }
function guardarPistas(lista) { localStorage.setItem("nt_pistas", JSON.stringify(lista)); }

function renderizarPistasGuardadas() {
  const list = document.getElementById("saved-tracks-list");
  const pistas = obtenerPistasGuardadas();
  const slugActual = estadoActual.novela ? estadoActual.novela.slug : null;
  if (!pistas.length) {
    list.innerHTML = `<span style="font-size:0.78rem; color:var(--muted);">Sin pistas guardadas.</span>`;
    return;
  }
  const ordenadas = [...pistas].sort((a, b) => (b.novelaSlug === slugActual ? 1 : 0) - (a.novelaSlug === slugActual ? 1 : 0));
  list.innerHTML = ordenadas.map(p => `
    <div class="track-item">
      <button class="track-play-btn" onclick="reproducirPistaGuardada(${p.id})">▶ ${p.novelaTitulo ? `[${p.novelaTitulo.slice(0, 12)}...] ` : ""}${p.nombre}</button>
      <button class="btn-del-note" onclick="eliminarPista(${p.id})">✕</button>
    </div>
  `).join("");
}

function reproducirPistaGuardada(id) {
  const p = obtenerPistasGuardadas().find(x => x.id === id);
  if (p) { document.getElementById("music-url-input").value = p.url; cargarEnReproductor(p.url); }
}

function eliminarPista(id) {
  guardarPistas(obtenerPistasGuardadas().filter(p => p.id !== id));
  renderizarPistasGuardadas();
}

document.getElementById("btn-music").addEventListener("click", () => {
  document.getElementById("settings-drawer").classList.add("hidden");
  document.getElementById("music-drawer").classList.toggle("hidden");
  renderizarPistasGuardadas();
});
document.getElementById("btn-minimize-music").addEventListener("click", () => {
  document.getElementById("music-drawer").classList.add("hidden");
  if (reproductorActivo) document.getElementById("music-mini-pill").classList.remove("hidden");
});
document.getElementById("btn-close-music").addEventListener("click", () => {
  document.getElementById("music-drawer").classList.add("hidden");
  document.getElementById("player-embed-wrapper").innerHTML = "";
  document.getElementById("player-embed-wrapper").classList.add("hidden");
  document.getElementById("music-mini-pill").classList.add("hidden");
  reproductorActivo = false;
});
document.getElementById("music-mini-pill").addEventListener("click", () => {
  document.getElementById("music-mini-pill").classList.add("hidden");
  document.getElementById("music-drawer").classList.remove("hidden");
});
document.getElementById("btn-load-music").addEventListener("click", () => cargarEnReproductor(document.getElementById("music-url-input").value));
document.getElementById("btn-save-track").addEventListener("click", () => {
  const url = document.getElementById("music-url-input").value.trim();
  const info = parsearUrlMultimedia(url);
  if (!info) return alert("Pega un enlace válido de Spotify o YouTube.");
  const nombre = document.getElementById("music-name-input").value.trim() || `${info.plataforma} Ambient`;
  const vincular = document.getElementById("chk-bind-novel").checked && estadoActual.novela;
  const pistas = obtenerPistasGuardadas();
  pistas.unshift({ id: Date.now(), nombre, url, novelaSlug: vincular ? estadoActual.novela.slug : null, novelaTitulo: vincular ? estadoActual.novela.titulo_es : null });
  guardarPistas(pistas);
  document.getElementById("music-name-input").value = "";
  renderizarPistasGuardadas();
});

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

// ==========================================
// 3. NAVEGACIÓN MATERIAL 3 ESTILO MIHON
// ==========================================
const titulosVista = {
  library: "Biblioteca",
  updates: "Actualizaciones",
  history: "Historial",
  explore: "Explorar",
  more: "Más",
  notebook: "Citas y Notas",
  stats: "Estadísticas",
  downloads: "Cola de descargas"
};

function mostrarVista(nombre) {
  document.getElementById("settings-drawer").classList.add("hidden");
  document.getElementById("selection-toolbar").classList.add("hidden");
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(`view-${nombre}`).classList.add("active");

  const ocultarNav = nombre === "reader";
  document.getElementById("bottom-nav").classList.toggle("hidden", ocultarNav);
  document.getElementById("main-topbar").classList.toggle("hidden", nombre === "more" || nombre === "reader");

  if (titulosVista[nombre]) {
    document.getElementById("topbar-title").textContent = titulosVista[nombre];
  }
  const mostrarLupa = nombre === "library" || nombre === "explore";
  document.getElementById("btn-toggle-search").classList.toggle("hidden", !mostrarLupa);
  if (!mostrarLupa) document.getElementById("search-bar-container").classList.add("hidden");

  window.scrollTo(0, 0);
}

function cambiarTab(tabName) {
  tabActual = tabName;
  if (["library", "updates", "history", "explore", "more"].includes(tabName)) {
    tabAnterior = tabName;
  }
  document.querySelectorAll(".m3-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));

  if (tabName === "library") {
    renderizarTabsCategorias();
    renderizarBannerUltimaLectura();
    renderizarBiblioteca();
  } else if (tabName === "updates") {
    renderizarActualizaciones();
  } else if (tabName === "history") {
    renderizarHistorial();
  } else if (tabName === "explore") {
    renderizarExplorar();
  } else if (tabName === "more") {
    document.getElementById("chk-incognito").checked = modoIncognito;
    document.getElementById("chk-only-unread").checked = soloPendientes;
    const chkDl = document.getElementById("chk-only-downloaded");
    if (chkDl) chkDl.checked = soloDescargados;
    const totalDesc = Object.keys(obtenerDescargadosMap()).length;
    const sumEl = document.getElementById("more-downloads-summary");
    if (sumEl) sumEl.textContent = totalDesc > 0 ? `${totalDesc} volumen(es) disponibles sin conexión` : "Gestionar volúmenes guardados offline";
  }
  mostrarVista(tabName);
}

document.querySelectorAll(".m3-tab").forEach(btn => btn.addEventListener("click", () => cambiarTab(btn.dataset.tab)));

// Búsqueda desplegable
document.getElementById("btn-toggle-search").addEventListener("click", () => {
  const bar = document.getElementById("search-bar-container");
  bar.classList.toggle("hidden");
  if (!bar.classList.contains("hidden")) document.getElementById("global-search-input").focus();
});
document.getElementById("btn-close-search").addEventListener("click", () => {
  filtroBusqueda = "";
  document.getElementById("global-search-input").value = "";
  document.getElementById("search-bar-container").classList.add("hidden");
  if (tabActual === "library") renderizarBiblioteca();
  if (tabActual === "explore") renderizarExplorar();
});
document.getElementById("global-search-input").addEventListener("input", (e) => {
  filtroBusqueda = e.target.value;
  if (tabActual === "library") renderizarBiblioteca();
  if (tabActual === "explore") renderizarExplorar();
});

// ==========================================
// 4. CATEGORÍAS, MODO INCÓGNITO Y BIBLIOTECA
// ==========================================
function obtenerCategorias() {
  return JSON.parse(localStorage.getItem("nt_categorias") || '["Leyendo", "Pendientes", "Favoritas"]');
}
function guardarCategorias(lista) {
  localStorage.setItem("nt_categorias", JSON.stringify(lista));
}
function obtenerMapaCategoriasNovelas() {
  return JSON.parse(localStorage.getItem("nt_novela_cat") || "{}");
}
function asignarCategoriaNovela(slug, cat) {
  const mapa = obtenerMapaCategoriasNovelas();
  mapa[slug] = cat;
  localStorage.setItem("nt_novela_cat", JSON.stringify(mapa));
}

function renderizarTabsCategorias() {
  const bar = document.getElementById("library-category-tabs");
  const cats = ["Todas", ...obtenerCategorias()];
  if (!cats.includes(categoriaActiva)) categoriaActiva = "Todas";

  bar.innerHTML = cats.map(c => `
    <button class="cat-tab ${c === categoriaActiva ? "active" : ""}" onclick="seleccionarCategoria('${c.replace(/'/g, "\\'")}')">${c}</button>
  `).join("");
}

function seleccionarCategoria(cat) {
  categoriaActiva = cat;
  renderizarTabsCategorias();
  renderizarBiblioteca();
}

function abrirModalCategorias() {
  document.getElementById("categories-modal").classList.remove("hidden");
  renderizarListaGestionCategorias();
}
document.getElementById("btn-close-cat-modal").addEventListener("click", () => {
  document.getElementById("categories-modal").classList.add("hidden");
  if (tabActual === "library") renderizarTabsCategorias();
});
document.getElementById("btn-create-category").addEventListener("click", () => {
  const input = document.getElementById("new-category-input");
  const val = input.value.trim();
  if (!val || val === "Todas") return;
  const cats = obtenerCategorias();
  if (!cats.includes(val)) {
    cats.push(val);
    guardarCategorias(cats);
  }
  input.value = "";
  renderizarListaGestionCategorias();
});
function eliminarCategoria(cat) {
  guardarCategorias(obtenerCategorias().filter(c => c !== cat));
  renderizarListaGestionCategorias();
}
function renderizarListaGestionCategorias() {
  const list = document.getElementById("categories-manage-list");
  const cats = obtenerCategorias();
  list.innerHTML = cats.map(c => `
    <div class="cat-manage-item">
      <span>${c}</span>
      <button class="btn-del-note" onclick="eliminarCategoria('${c.replace(/'/g, "\\'")}')">Eliminar</button>
    </div>
  `).join("") || `<p style="color:var(--muted); font-size:0.85rem;">Sin categorías personalizadas.</p>`;
}

function toggleIncognito(forzarValor) {
  modoIncognito = typeof forzarValor === "boolean" ? forzarValor : !modoIncognito;
  localStorage.setItem("nt_incognito", JSON.stringify(modoIncognito));
  document.getElementById("chk-incognito").checked = modoIncognito;
  document.getElementById("incognito-pill").classList.toggle("hidden", !modoIncognito);
}

function toggleOnlyUnread(forzarValor) {
  soloPendientes = typeof forzarValor === "boolean" ? forzarValor : !soloPendientes;
  localStorage.setItem("nt_solo_pendientes", JSON.stringify(soloPendientes));
  document.getElementById("chk-only-unread").checked = soloPendientes;
}

function obtenerBibliotecaSlugs() { return JSON.parse(localStorage.getItem("nt_biblioteca") || "[]"); }
function alternarEnBiblioteca(slug) {
  let bib = obtenerBibliotecaSlugs();
  bib = bib.includes(slug) ? bib.filter(s => s !== slug) : [...bib, slug];
  localStorage.setItem("nt_biblioteca", JSON.stringify(bib));
  return bib.includes(slug);
}

function contarCapitulosSinLeer(novela) {
  const progreso = JSON.parse(localStorage.getItem("nt_progreso") || "{}");
  let sinLeer = 0;
  for (const vol of novela.volumenes) {
    for (let c = 1; c <= vol.total_capitulos; c++) {
      if (!progreso[`${novela.slug}_${vol.clave}_${c}`]) sinLeer++;
    }
  }
  return sinLeer;
}

function crearTarjetaMihon(novela, esExplorar = false) {
  const enBib = obtenerBibliotecaSlugs().includes(novela.slug);
  const sinLeer = contarCapitulosSinLeer(novela);
  const offlineTag = tieneAlgunVolumenDescargado(novela.slug) ? `<span class="offline-badge">Offline</span>` : "";

  const card = document.createElement("div");
  card.className = "mihon-card";
  card.innerHTML = `
    ${sinLeer > 0 ? `<span class="unread-badge">${sinLeer}</span>` : ""}
    ${(esExplorar && enBib) ? `<span class="in-lib-tag">En biblioteca</span>` : ""}
    ${offlineTag}
    ${novela.portada ? `<img src="${novela.portada}" alt="${novela.titulo_es}" loading="lazy" />` : `<div class="mihon-card-placeholder">📖</div>`}
    <div class="mihon-card-overlay">${novela.titulo_es}</div>
  `;
  card.onclick = () => abrirNovela(novela);
  return card;
}

function renderizarBiblioteca() {
  const grid = document.getElementById("library-grid");
  const slugs = obtenerBibliotecaSlugs();
  const mapaCat = obtenerMapaCategoriasNovelas();
  const q = filtroBusqueda.toLowerCase().trim();

  const filtradas = catalogoData.filter(n => {
    if (!slugs.includes(n.slug)) return false;
    if (categoriaActiva !== "Todas" && (mapaCat[n.slug] || "Leyendo") !== categoriaActiva) return false;
    if (soloPendientes && contarCapitulosSinLeer(n) === 0) return false;
    if (soloDescargados && !tieneAlgunVolumenDescargado(n.slug)) return false;
    if (q && !n.titulo_es.toLowerCase().includes(q) && !n.sinopsis.toLowerCase().includes(q)) return false;
    return true;
  });

  grid.innerHTML = "";
  if (filtradas.length === 0) {
    grid.innerHTML = `
      <div class="kaomoji-empty">
        <div class="kaomoji-face">Σ(ಠ_ಠ)</div>
        <div class="kaomoji-text">${slugs.length === 0 ? "Tu biblioteca está vacía" : "La categoría está vacía"}</div>
        ${slugs.length === 0 ? `<button class="m3-btn filled" onclick="cambiarTab('explore')">Explorar catálogo</button>` : ""}
      </div>
    `;
    return;
  }
  filtradas.forEach(n => grid.appendChild(crearTarjetaMihon(n, false)));
}

function renderizarExplorar() {
  const grid = document.getElementById("explore-grid");
  const q = filtroBusqueda.toLowerCase().trim();
  const filtradas = catalogoData.filter(n =>
    !q || n.titulo_es.toLowerCase().includes(q) || (n.tono && n.tono.toLowerCase().includes(q)) || n.sinopsis.toLowerCase().includes(q)
  );

  grid.innerHTML = "";
  if (!filtradas.length) {
    grid.innerHTML = `<div class="kaomoji-empty"><div class="kaomoji-face">(･_･?)</div><div class="kaomoji-text">No se encontraron resultados</div></div>`;
    return;
  }
  filtradas.forEach(n => grid.appendChild(crearTarjetaMihon(n, true)));
}

// ==========================================
// 5. ACTUALIZACIONES, HISTORIAL Y ESTADÍSTICAS
// ==========================================
function renderizarActualizaciones() {
  const feed = document.getElementById("updates-feed");
  let html = "";

  noticiasData.forEach(noticia => {
    html += `
      <div class="feed-item news-item">
        <span class="feed-badge">${noticia.tipo || "Anuncio"} • ${noticia.fecha}</span>
        <strong style="font-size:1rem; margin-top:0.25rem;">${noticia.titulo}</strong>
        <p style="color:var(--muted); font-size:0.88rem; margin-top:0.25rem;">${noticia.contenido}</p>
      </div>
    `;
  });

  const subidas = [];
  catalogoData.forEach(novela => novela.volumenes.forEach(vol => subidas.push({ novela, vol, fecha: vol.fecha_subida || "" })));
  subidas.sort((a, b) => b.fecha.localeCompare(a.fecha));

  subidas.forEach(item => {
    html += `
      <div class="feed-item">
        <div>
          <span class="feed-badge">Nuevo Volumen</span>
          <div style="font-weight:600; margin-top:0.2rem;">${item.novela.titulo_es} — Vol. ${item.vol.numero}</div>
          <div class="feed-meta">${item.vol.total_capitulos} capítulos • ${item.fecha}</div>
        </div>
        <button class="m3-btn tonal" onclick="abrirNovelaPorSlug('${item.novela.slug}')">Abrir</button>
      </div>
    `;
  });

  feed.innerHTML = html || `<div class="kaomoji-empty"><div class="kaomoji-face">(－_－) zzZ</div><div class="kaomoji-text">Sin actualizaciones recientes</div></div>`;
}

function abrirNovelaPorSlug(slug) {
  const nov = catalogoData.find(n => n.slug === slug);
  if (nov) abrirNovela(nov);
}

function registrarEnHistorial(novela, vol, capData) {
  if (modoIncognito) return;
  let historial = JSON.parse(localStorage.getItem("nt_historial") || "[]");
  historial = historial.filter(h => !(h.slug === novela.slug && h.volClave === vol.clave && h.capNumero === capData.numero));
  historial.unshift({
    slug: novela.slug,
    novelaTitulo: novela.titulo_es,
    volClave: vol.clave,
    volNumero: vol.numero,
    capNumero: capData.numero,
    capTitulo: capData.titulo_es,
    fechaHora: new Date().toLocaleString()
  });
  if (historial.length > 60) historial.pop();
  localStorage.setItem("nt_historial", JSON.stringify(historial));
}

function renderizarHistorial() {
  const list = document.getElementById("history-list");
  const historial = JSON.parse(localStorage.getItem("nt_historial") || "[]");
  if (!historial.length) {
    list.innerHTML = `<div class="kaomoji-empty"><div class="kaomoji-face">(・_・)</div><div class="kaomoji-text">Nada leído recientemente</div></div>`;
    return;
  }
  list.innerHTML = historial.map((h, i) => `
    <div class="feed-item">
      <div>
        <div style="font-weight:600;">${h.novelaTitulo}</div>
        <div class="feed-meta">Vol. ${h.volNumero}, Cap. ${h.capNumero}: ${h.capTitulo}</div>
        <div class="feed-meta">${h.fechaHora}</div>
      </div>
      <button class="m3-btn filled" onclick="reanudarDesdeHistorial(${i})">▶</button>
    </div>
  `).join("");
}

async function reanudarDesdeHistorial(idxHist) {
  const item = JSON.parse(localStorage.getItem("nt_historial") || "[]")[idxHist];
  if (!item) return;
  const nov = catalogoData.find(n => n.slug === item.slug);
  const vol = nov?.volumenes.find(v => v.clave === item.volClave);
  if (!vol) return;
  const indiceData = await (await fetch(vol.ruta_indice)).json();
  const idx = indiceData.capitulos.findIndex(c => c.numero === item.capNumero);
  if (idx !== -1) await abrirCapitulo(nov, vol, indiceData.capitulos, idx, 0);
}

document.getElementById("btn-clear-history").addEventListener("click", () => {
  localStorage.removeItem("nt_historial");
  renderizarHistorial();
});

function abrirVistaLibreta() {
  renderizarLibretaGlobal();
  mostrarVista("notebook");
}

function abrirVistaEstadisticas() {
  const progreso = JSON.parse(localStorage.getItem("nt_progreso") || "{}");
  const leidos = Object.keys(progreso).length;
  const enBib = obtenerBibliotecaSlugs().length;
  const citas = obtenerNotas().length;
  const totalCaps = catalogoData.reduce((acc, n) => acc + n.volumenes.reduce((a, v) => a + v.total_capitulos, 0), 0);

  document.getElementById("stats-container").innerHTML = `
    <div class="stat-box"><div class="stat-num">${enBib}</div><div class="stat-lbl">En Biblioteca</div></div>
    <div class="stat-box"><div class="stat-num">${leidos}</div><div class="stat-lbl">Capítulos Leídos</div></div>
    <div class="stat-box"><div class="stat-num">${totalCaps}</div><div class="stat-lbl">Capítulos Totales</div></div>
    <div class="stat-box"><div class="stat-num">${citas}</div><div class="stat-lbl">Citas y Notas</div></div>
  `;
  mostrarVista("stats");
}

function mostrarAcercaDe() {
  alert("NovelaTrad Reader\nInterfaz inspirada en Mihon (Material You).\nTraducciones offline y comentarios Giscus.");
}

document.getElementById("btn-more-backup").addEventListener("click", () => abrirVistaLibreta());

// ==========================================
// 6. CONTINUAR LECTURA Y FICHA DE NOVELA
// ==========================================
let scrollTimer = null;
window.addEventListener("scroll", () => {
  if (!document.getElementById("view-reader").classList.contains("active")) return;
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    const ultima = JSON.parse(localStorage.getItem("nt_ultima_lectura") || "null");
    if (ultima && estadoActual.novela) {
      ultima.scrollY = window.scrollY;
      localStorage.setItem("nt_ultima_lectura", JSON.stringify(ultima));
    }
  }, 300);
});

function renderizarBannerUltimaLectura() {
  const banner = document.getElementById("continue-reading-banner");
  const ultima = JSON.parse(localStorage.getItem("nt_ultima_lectura") || "null");
  if (!ultima) return banner.classList.add("hidden");
  const nov = catalogoData.find(n => n.slug === ultima.slug);
  const vol = nov?.volumenes.find(v => v.clave === ultima.volClave);
  if (!vol) return banner.classList.add("hidden");

  banner.classList.remove("hidden");
  banner.innerHTML = `
    <div>
      <span style="font-size:0.72rem; color:var(--accent); font-weight:700;">CONTINUAR LECTURA</span>
      <div style="font-weight:600; font-size:0.92rem;">${nov.titulo_es} • Vol. ${vol.numero}, Cap. ${ultima.capNumero}</div>
    </div>
    <button id="btn-resume-now" class="m3-btn filled">Reanudar</button>
  `;
  document.getElementById("btn-resume-now").onclick = async () => {
    const indiceData = await (await fetch(vol.ruta_indice)).json();
    const idx = indiceData.capitulos.findIndex(c => c.numero === ultima.capNumero);
    if (idx !== -1) await abrirCapitulo(nov, vol, indiceData.capitulos, idx, ultima.scrollY || 0);
  };
}

async function abrirNovela(novela) {
  estadoActual.novela = novela;
  document.getElementById("btn-novel-back").onclick = () => cambiarTab(tabAnterior);

  const btnBib = document.getElementById("btn-toggle-library");
  const catSelect = document.getElementById("novel-category-select");

  const actualizarControlesBib = () => {
    const enBib = obtenerBibliotecaSlugs().includes(novela.slug);
    btnBib.textContent = enBib ? "❤️ En Biblioteca" : "🤍 Añadir";
    btnBib.className = enBib ? "m3-btn filled" : "m3-btn tonal";
    catSelect.classList.toggle("hidden", !enBib);
    if (enBib) {
      const cats = obtenerCategorias();
      const actual = obtenerMapaCategoriasNovelas()[novela.slug] || cats[0] || "Leyendo";
      catSelect.innerHTML = cats.map(c => `<option value="${c}" ${c === actual ? "selected" : ""}>${c}</option>`).join("");
    }
  };
  actualizarControlesBib();
  btnBib.onclick = () => { alternarEnBiblioteca(novela.slug); actualizarControlesBib(); };
  catSelect.onchange = (e) => asignarCategoriaNovela(novela.slug, e.target.value);

  document.getElementById("novel-header").innerHTML = `
    <div class="novel-hero">
      ${novela.portada ? `<img src="${novela.portada}" alt="${novela.titulo_es}" class="novel-hero-cover" />` : ""}
      <div class="novel-hero-info">
        <h2>${novela.titulo_es}</h2>
        <span style="color:var(--accent); font-size:0.82rem;">${novela.tono || "Novela Ligera"}</span>
        <p style="color:var(--muted); margin:0.5rem 0 0.9rem; font-size:0.88rem;">${novela.sinopsis}</p>
        <button id="btn-smart-read" class="m3-btn filled">▶ Continuar</button>
      </div>
    </div>
  `;

  const container = document.getElementById("volumes-container");
  container.innerHTML = "<p style='color:var(--muted);'>Cargando...</p>";
  mostrarVista("novel");

  const progreso = JSON.parse(localStorage.getItem("nt_progreso") || "{}");
  container.innerHTML = "";
  let primerNoLeido = null;
  let primerCap = null;

  for (const vol of novela.volumenes) {
    const indiceData = await (await fetch(vol.ruta_indice)).json();
    const box = document.createElement("div");
    box.className = "vol-box";

    const descargado = estaVolumenDescargado(novela.slug, vol.clave);
    const descargandoEste = descargaEnCurso && descargaEnCurso.slug === novela.slug && descargaEnCurso.volClave === vol.clave;

    const headerMain = document.createElement("div");
    headerMain.className = "vol-header-main";
    headerMain.innerHTML = `
      <div class="vol-header" style="margin-bottom:0;">
        ${vol.portada ? `<img src="${vol.portada}" class="vol-cover" />` : ""}
        <div>
          <h3>Volumen ${vol.numero}</h3>
          <span style="color:var(--muted); font-size:0.82rem;">${indiceData.capitulos.length} capítulos</span>
        </div>
      </div>
    `;

    const btnDl = document.createElement("button");
    btnDl.className = "vol-download-btn" + (descargado ? " downloaded" : "");
    if (descargandoEste) {
      btnDl.disabled = true;
      btnDl.textContent = `⏳ ${descargaEnCurso.actual}/${descargaEnCurso.total}`;
    } else if (descargado) {
      btnDl.textContent = "✓ Descargado";
      btnDl.onclick = () => {
        if (confirm(`¿Eliminar Volumen ${vol.numero} de la caché offline?`)) eliminarVolumenOffline(novela.slug, vol.clave);
      };
    } else {
      btnDl.textContent = "⬇ Descargar";
      btnDl.onclick = () => descargarVolumenOffline(novela, vol);
    }

    headerMain.appendChild(btnDl);
    box.appendChild(headerMain);

    const ul = document.createElement("ul");
    ul.className = "cap-list";

    indiceData.capitulos.forEach((cap, idx) => {
      const clave = `${novela.slug}_${vol.clave}_${cap.numero}`;
      const leido = !!progreso[clave];
      if (!primerCap) primerCap = { vol, caps: indiceData.capitulos, idx };
      if (!leido && !primerNoLeido) primerNoLeido = { vol, caps: indiceData.capitulos, idx };

      const li = document.createElement("li");
      li.className = "cap-item" + (leido ? " read" : "");
      li.innerHTML = `<span class="cap-title-btn">Cap. ${cap.numero}: ${cap.titulo}</span>`;
      li.querySelector(".cap-title-btn").onclick = () => abrirCapitulo(novela, vol, indiceData.capitulos, idx, 0);

      const btnCheck = document.createElement("button");
      btnCheck.className = "cap-toggle-read";
      btnCheck.textContent = leido ? "✓" : "Marcar";
      btnCheck.onclick = (e) => {
        e.stopPropagation();
        const p = JSON.parse(localStorage.getItem("nt_progreso") || "{}");
        p[clave] ? delete p[clave] : (p[clave] = true);
        localStorage.setItem("nt_progreso", JSON.stringify(p));
        abrirNovela(novela);
      };
      li.appendChild(btnCheck);
      ul.appendChild(li);
    });

    box.appendChild(ul);
    container.appendChild(box);
  }

  const obj = primerNoLeido || primerCap;
  const btnSmart = document.getElementById("btn-smart-read");
  if (obj) {
    btnSmart.textContent = primerNoLeido ? `▶ Vol. ${obj.vol.numero} • Cap. ${obj.caps[obj.idx].numero}` : "▶ Releer desde inicio";
    btnSmart.onclick = () => abrirCapitulo(novela, obj.vol, obj.caps, obj.idx, 0);
  }
}

// ==========================================
// 7. LECTOR, COMENTARIOS GISCUS Y CITAS
// ==========================================
function formatearParrafo(texto) {
  const limpio = texto.trim();
  if (/^(\*\s*){3,}$/.test(limpio) || limpio === "***") return `<p class="scene-break">* * *</p>`;
  const esc = limpio.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return `<p>${esc}</p>`;
}

function cargarComentariosCapitulo(identificadorHilo) {
  const contenedor = document.getElementById("comments-thread");
  const hint = document.querySelector(".comments-hint");
  contenedor.innerHTML = "";

  if (GISCUS_CONFIG.repoId.startsWith("PEGA_AQUI")) {
    if (hint) { hint.classList.remove("hidden"); hint.textContent = `Hilo listo: ${identificadorHilo} (configura repoId y categoryId en app.js)`; }
    return;
  }
  if (hint) hint.classList.add("hidden");

  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.setAttribute("data-repo", GISCUS_CONFIG.repo);
  script.setAttribute("data-repo-id", GISCUS_CONFIG.repoId);
  script.setAttribute("data-category", GISCUS_CONFIG.category);
  script.setAttribute("data-category-id", GISCUS_CONFIG.categoryId);
  script.setAttribute("data-mapping", "specific");
  script.setAttribute("data-term", identificadorHilo);
  script.setAttribute("data-reactions-enabled", "1");
  script.setAttribute("data-theme", obtenerTemaGiscus());
  script.setAttribute("data-lang", "es");
  script.crossOrigin = "anonymous";
  script.async = true;
  contenedor.appendChild(script);
}

async function abrirCapitulo(novela, vol, listaCapitulos, idx, scrollRestaurar = 0) {
  estadoActual = { novela, volumen: vol, capitulosIndice: listaCapitulos, capIndex: idx };
  const capInfo = listaCapitulos[idx];
  const capData = await (await fetch(`output/novelas/${novela.slug}/${vol.clave}/${capInfo.archivo}`)).json();

  if (!modoIncognito) {
    const progreso = JSON.parse(localStorage.getItem("nt_progreso") || "{}");
    progreso[`${novela.slug}_${vol.clave}_${capData.numero}`] = true;
    localStorage.setItem("nt_progreso", JSON.stringify(progreso));
    localStorage.setItem("nt_ultima_lectura", JSON.stringify({
      slug: novela.slug, volClave: vol.clave, capNumero: capData.numero, capTitulo: capData.titulo_es, scrollY: scrollRestaurar
    }));
    registrarEnHistorial(novela, vol, capData);
  }

  let html = `<h1>Capítulo ${capData.numero}: ${capData.titulo_es}</h1>` + capData.parrafos.map(formatearParrafo).join("");
  if (capData.notas_traductor?.length) {
    html += `<div class="translator-notes"><strong>Notas de traducción:</strong><ul>${capData.notas_traductor.map(n => `<li>${n}</li>`).join("")}</ul></div>`;
  }

  document.getElementById("chapter-content").innerHTML = html;
  document.getElementById("reader-progress-label").textContent = `Vol. ${vol.numero} • ${idx + 1}/${listaCapitulos.length}`;
  document.getElementById("btn-back-index").onclick = () => abrirNovela(novela);

  const btnPrev = document.getElementById("btn-prev-cap");
  const btnNext = document.getElementById("btn-next-cap");
  btnPrev.disabled = idx === 0;
  btnPrev.onclick = () => abrirCapitulo(novela, vol, listaCapitulos, idx - 1, 0);
  btnNext.disabled = idx === listaCapitulos.length - 1;
  btnNext.onclick = () => abrirCapitulo(novela, vol, listaCapitulos, idx + 1, 0);

  renderizarNotasCapitulo();
  cargarComentariosCapitulo(`${novela.slug}-${vol.clave}-cap-${capData.numero}`);
  mostrarVista("reader");
  if (scrollRestaurar > 0) setTimeout(() => window.scrollTo({ top: scrollRestaurar, behavior: "smooth" }), 100);
}

// Citas y Respaldo
function obtenerNotas() { return JSON.parse(localStorage.getItem("nt_notas") || "[]"); }
function guardarNotas(lista) { localStorage.setItem("nt_notas", JSON.stringify(lista)); }

document.addEventListener("selectionchange", () => {
  if (!document.getElementById("view-reader").classList.contains("active")) return;
  const sel = window.getSelection();
  const texto = sel ? sel.toString().trim() : "";
  const toolbar = document.getElementById("selection-toolbar");
  if (texto.length >= 6 && document.getElementById("chapter-content").contains(sel.anchorNode)) {
    seleccionActualTexto = texto;
    toolbar.classList.remove("hidden");
  } else {
    toolbar.classList.add("hidden");
  }
});

document.getElementById("btn-save-quote").addEventListener("click", () => {
  if (!seleccionActualTexto || !estadoActual.novela) return;
  registrarCitaONota(seleccionActualTexto, "");
  window.getSelection().removeAllRanges();
  document.getElementById("selection-toolbar").classList.add("hidden");
});
document.getElementById("btn-add-note").addEventListener("click", () => {
  if (!seleccionActualTexto) return;
  document.getElementById("modal-quote-preview").textContent = `"${seleccionActualTexto}"`;
  document.getElementById("modal-note-input").value = "";
  document.getElementById("note-modal").classList.remove("hidden");
  document.getElementById("selection-toolbar").classList.add("hidden");
});
document.getElementById("btn-cancel-note").addEventListener("click", () => document.getElementById("note-modal").classList.add("hidden"));
document.getElementById("btn-confirm-note").addEventListener("click", () => {
  registrarCitaONota(seleccionActualTexto, document.getElementById("modal-note-input").value.trim());
  document.getElementById("note-modal").classList.add("hidden");
  window.getSelection().removeAllRanges();
});

function registrarCitaONota(cita, nota) {
  const capInfo = estadoActual.capitulosIndice[estadoActual.capIndex];
  const notas = obtenerNotas();
  notas.unshift({
    id: Date.now(), slug: estadoActual.novela.slug, novelaTitulo: estadoActual.novela.titulo_es,
    volNumero: estadoActual.volumen.numero, capNumero: capInfo.numero, capTitulo: capInfo.titulo,
    cita, nota, fecha: new Date().toLocaleDateString()
  });
  guardarNotas(notas);
  renderizarNotasCapitulo();
}

function eliminarNota(id) {
  guardarNotas(obtenerNotas().filter(n => n.id !== id));
  renderizarNotasCapitulo();
  renderizarLibretaGlobal();
}

function renderizarNotasCapitulo() {
  const box = document.getElementById("chapter-user-notes");
  const list = document.getElementById("chapter-notes-list");
  if (!estadoActual.novela) return;
  const capInfo = estadoActual.capitulosIndice[estadoActual.capIndex];
  const notasCap = obtenerNotas().filter(n => n.slug === estadoActual.novela.slug && n.volNumero === estadoActual.volumen.numero && n.capNumero === capInfo.numero);
  if (!notasCap.length) return box.classList.add("hidden");
  box.classList.remove("hidden");
  list.innerHTML = notasCap.map(n => `
    <div class="note-card" style="margin-top:0.65rem;">
      <blockquote>"${n.cita}"</blockquote>
      ${n.nota ? `<p style="margin-top:0.35rem;">${n.nota}</p>` : ""}
      <div class="note-meta"><span>${n.fecha}</span><button class="btn-del-note" onclick="eliminarNota(${n.id})">Eliminar</button></div>
    </div>
  `).join("");
}

function renderizarLibretaGlobal() {
  const list = document.getElementById("notebook-list");
  const notas = obtenerNotas();
  if (!notas.length) {
    list.innerHTML = `<div class="kaomoji-empty"><div class="kaomoji-face">(￣▽￣)ノ</div><div class="kaomoji-text">Aún no has guardado citas ni notas</div></div>`;
    return;
  }
  list.innerHTML = notas.map(n => `
    <div class="note-card">
      <blockquote>"${n.cita}"</blockquote>
      ${n.nota ? `<p style="margin-top:0.35rem;">${n.nota}</p>` : ""}
      <div class="note-meta"><span>${n.novelaTitulo} • Vol. ${n.volNumero}, Cap. ${n.capNumero}</span><button class="btn-del-note" onclick="eliminarNota(${n.id})">Eliminar</button></div>
    </div>
  `).join("");
}

document.getElementById("btn-export-notes").addEventListener("click", () => {
  const notas = obtenerNotas();
  if (!notas.length) return;
  const txt = notas.map(n => `[${n.novelaTitulo} - Vol. ${n.volNumero}, Cap. ${n.capNumero}]\n"${n.cita}"\n${n.nota ? "Nota: " + n.nota + "\n" : ""}---`).join("\n\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" }));
  a.download = "mis_citas_y_notas.txt";
  a.click();
});

document.getElementById("btn-backup-json").addEventListener("click", () => {
  const backup = {
    nt_biblioteca: obtenerBibliotecaSlugs(),
    nt_categorias: obtenerCategorias(),
    nt_novela_cat: obtenerMapaCategoriasNovelas(),
    nt_progreso: JSON.parse(localStorage.getItem("nt_progreso") || "{}"),
    nt_historial: JSON.parse(localStorage.getItem("nt_historial") || "[]"),
    nt_notas: obtenerNotas(),
    nt_pistas: obtenerPistasGuardadas(),
    nt_ultima_lectura: JSON.parse(localStorage.getItem("nt_ultima_lectura") || "null"),
    nt_prefs: prefs
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  a.download = `novelatrad_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
});

document.getElementById("input-restore-json").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const d = JSON.parse(ev.target.result);
      ["nt_biblioteca", "nt_categorias", "nt_novela_cat", "nt_progreso", "nt_historial", "nt_notas", "nt_pistas", "nt_ultima_lectura"].forEach(k => {
        if (d[k]) localStorage.setItem(k, JSON.stringify(d[k]));
      });
      alert("Copia de seguridad restaurada.");
      location.reload();
    } catch { alert("Archivo no válido."); }
  };
  reader.readAsText(file);
});

// ==========================================
// 8. INICIALIZACIÓN
// ==========================================
async function iniciarApp() {
  aplicarPreferencias();
  document.getElementById("incognito-pill").classList.toggle("hidden", !modoIncognito);
  try {
    catalogoData = (await (await fetch("output/catalogo.json")).json()).novelas || [];
    try { noticiasData = (await (await fetch("output/noticias.json")).json()).noticias || []; } catch { noticiasData = []; }
    cambiarTab(obtenerBibliotecaSlugs().length === 0 && catalogoData.length > 0 ? "explore" : "library");
  } catch {
    document.getElementById("library-grid").innerHTML = `<div class="kaomoji-empty"><div class="kaomoji-face">(×_×)</div><div class="kaomoji-text">Error cargando catalogo.json</div></div>`;
  }
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
iniciarApp();