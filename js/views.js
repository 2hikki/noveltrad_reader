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
        <div class="empty-state-art"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/></svg></div>
        <div class="kaomoji-text">${slugs.length === 0 ? "Tu estantería espera su primera historia" : "No hay novelas en esta categoría"}</div>
        ${slugs.length === 0 ? `<button class="m3-btn filled" onclick="cambiarTab('explore')">Explorar catálogo</button>` : ""}
      </div>
    `;
    return;
  }
  filtradas.forEach(n => grid.appendChild(crearTarjetaMihon(n, false)));
}

function obtenerEtiquetasNovela(novela) {
  if (Array.isArray(novela.etiquetas) && novela.etiquetas.length) return novela.etiquetas;
  if (novela.tono) return novela.tono.split(/[,/•|-]/).map(t => t.trim()).filter(Boolean);
  return [];
}

function renderizarTabsEtiquetasExplore() {
  const bar = document.getElementById("explore-tag-tabs");
  if (!bar) return;
  const setTags = new Set();
  catalogoData.forEach(n => obtenerEtiquetasNovela(n).forEach(t => setTags.add(t)));
  const tags = ["Todas", ...Array.from(setTags).sort((a, b) => a.localeCompare(b, "es"))];
  if (!tags.includes(etiquetaExploreActiva)) etiquetaExploreActiva = "Todas";

  bar.innerHTML = tags.map(t => `
    <button class="cat-tab ${t === etiquetaExploreActiva ? "active" : ""}" onclick="seleccionarEtiquetaExplore('${t.replace(/'/g, "\'")}')">${t}</button>
  `).join("");
}

function seleccionarEtiquetaExplore(tag) {
  etiquetaExploreActiva = tag;
  renderizarTabsEtiquetasExplore();
  renderizarExplorar();
}

document.getElementById("btn-sort-explore").addEventListener("click", () => {
  ordenExploreAsc = !ordenExploreAsc;
  document.getElementById("btn-sort-explore").textContent = ordenExploreAsc ? "A-Z ↑" : "Z-A ↓";
  renderizarExplorar();
});

function renderizarExplorar() {
  renderizarTabsEtiquetasExplore();
  const grid = document.getElementById("explore-grid");
  const q = filtroBusqueda.toLowerCase().trim();
  const filtradas = catalogoData
    .filter(n => {
      const tags = obtenerEtiquetasNovela(n);
      if (etiquetaExploreActiva !== "Todas" && !tags.includes(etiquetaExploreActiva)) return false;
      if (!q) return true;
      return n.titulo_es.toLowerCase().includes(q) ||
             tags.some(t => t.toLowerCase().includes(q)) ||
             n.sinopsis.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const cmp = a.titulo_es.localeCompare(b.titulo_es, "es", { sensitivity: "base" });
      return ordenExploreAsc ? cmp : -cmp;
    });

  grid.innerHTML = "";
  if (!filtradas.length) {
    grid.innerHTML = `<div class="kaomoji-empty"><div class="empty-state-art"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M9 11h4"/></svg></div><div class="kaomoji-text">No se encontraron resultados</div></div>`;
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

  feed.innerHTML = html || `<div class="kaomoji-empty"><div class="empty-state-art"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></div><div class="kaomoji-text">Sin actualizaciones recientes</div></div>`;
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
    list.innerHTML = `<div class="kaomoji-empty"><div class="empty-state-art"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg></div><div class="kaomoji-text">Aún no has iniciado ninguna lectura</div></div>`;
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
        <div class="novel-tags-row">
          ${(obtenerEtiquetasNovela(novela).length ? obtenerEtiquetasNovela(novela) : ["Novela Ligera"])
            .map(t => `<span class="novel-tag-pill">${t}</span>`).join("")}
        </div>
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

function abrirModalDonaciones() {
  document.getElementById("donate-modal").classList.remove("hidden");
}
document.getElementById("btn-close-donate").addEventListener("click", () => {
  document.getElementById("donate-modal").classList.add("hidden");
});
document.getElementById("donate-modal").addEventListener("click", (e) => {
  if (e.target.id === "donate-modal") {
    document.getElementById("donate-modal").classList.add("hidden");
  }
});

function abrirModalBienvenida() {
  document.getElementById("welcome-modal").classList.remove("hidden");
}

function cerrarModalBienvenida(irAExplorar = false) {
  localStorage.setItem("nt_bienvenida_vista", "true");
  document.getElementById("welcome-modal").classList.add("hidden");
  if (irAExplorar) cambiarTab("explore");
}

document.getElementById("btn-welcome-start").addEventListener("click", () => {
  cerrarModalBienvenida(true);
});

document.getElementById("welcome-modal").addEventListener("click", (e) => {
  if (e.target.id === "welcome-modal") {
    cerrarModalBienvenida(false);
  }
});
