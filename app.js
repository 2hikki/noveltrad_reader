let catalogoData = [];
let noticiasData = [];
let tabAnterior = "library";
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
// Obtén repoId y categoryId en https://giscus.app/es tras activar Discussions en tu repo
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

  // 1. Detectar enlaces de Spotify (track, album, playlist, episode, show)
  const matchSpotify = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
  if (matchSpotify) {
    const tipo = matchSpotify[1];
    const id = matchSpotify[2];
    const altura = tipo === "track" ? 152 : 352;
    return {
      plataforma: "Spotify",
      embedUrl: `https://open.spotify.com/embed/${tipo}/${id}?utm_source=generator&theme=0`,
      height: altura
    };
  }

  // 2. Detectar playlists de YouTube
  const matchYtList = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (matchYtList && !url.includes("watch?v=")) {
    return {
      plataforma: "YouTube",
      embedUrl: `https://www.youtube.com/embed/videoseries?list=${matchYtList[1]}&autoplay=1`,
      height: 200
    };
  }

  // 3. Detectar videos o directos de YouTube
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
    alert("Enlace no reconocido. Pega una URL válida de Spotify (canción/playlist/álbum) o YouTube (video/playlist).");
    return;
  }

  wrapper.classList.remove("hidden");
  wrapper.innerHTML = `
    <iframe
      src="${info.embedUrl}"
      height="${info.height}"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy">
    </iframe>
  `;
  reproductorActivo = true;
  document.getElementById("music-mini-pill").classList.add("hidden");
}

function obtenerPistasGuardadas() {
  return JSON.parse(localStorage.getItem("nt_pistas") || "[]");
}

function guardarPistas(lista) {
  localStorage.setItem("nt_pistas", JSON.stringify(lista));
}

function renderizarPistasGuardadas() {
  const list = document.getElementById("saved-tracks-list");
  const pistas = obtenerPistasGuardadas();
  const slugActual = estadoActual.novela ? estadoActual.novela.slug : null;

  if (pistas.length === 0) {
    list.innerHTML = `<span style="font-size:0.78rem; color:var(--muted);">Aún no tienes pistas guardadas.</span>`;
    return;
  }

  const ordenadas = [...pistas].sort((a, b) => {
    const aMatch = a.novelaSlug === slugActual ? 1 : 0;
    const bMatch = b.novelaSlug === slugActual ? 1 : 0;
    return bMatch - aMatch;
  });

  list.innerHTML = ordenadas.map(p => {
    const etiquetaNovela = p.novelaTitulo ? `<span class="track-badge">[${p.novelaTitulo.slice(0, 14)}...]</span>` : "";
    return `
      <div class="track-item">
        <button class="track-play-btn" onclick="reproducirPistaGuardada(${p.id})" title="${p.nombre}">
          ▶ ${etiquetaNovela}${p.nombre}
        </button>
        <button class="btn-del-note" onclick="eliminarPista(${p.id})" title="Borrar">✕</button>
      </div>
    `;
  }).join("");
}

function reproducirPistaGuardada(id) {
  const pista = obtenerPistasGuardadas().find(p => p.id === id);
  if (!pista) return;
  document.getElementById("music-url-input").value = pista.url;
  cargarEnReproductor(pista.url);
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
  if (reproductorActivo) {
    document.getElementById("music-mini-pill").classList.remove("hidden");
  }
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

document.getElementById("btn-load-music").addEventListener("click", () => {
  cargarEnReproductor(document.getElementById("music-url-input").value);
});

document.getElementById("btn-save-track").addEventListener("click", () => {
  const url = document.getElementById("music-url-input").value.trim();
  const info = parsearUrlMultimedia(url);
  if (!info) {
    alert("Primero pega un enlace válido de Spotify o YouTube.");
    return;
  }
  const nombre = document.getElementById("music-name-input").value.trim() || `${info.plataforma} Ambient`;
  const vincular = document.getElementById("chk-bind-novel").checked && estadoActual.novela;

  const pistas = obtenerPistasGuardadas();
  pistas.unshift({
    id: Date.now(),
    nombre,
    url,
    plataforma: info.plataforma,
    novelaSlug: vincular ? estadoActual.novela.slug : null,
    novelaTitulo: vincular ? estadoActual.novela.titulo_es : null
  });
  guardarPistas(pistas);
  document.getElementById("music-name-input").value = "";
  renderizarPistasGuardadas();
});

// ==========================================
// 2. PREFERENCIAS VISUALES Y TIPOGRAFÍA
// ==========================================
const defaultPrefs = {
  theme: "dark",
  fontSize: 18,
  lineHeight: 1.85,
  fontFamily: "'Lora', Georgia, serif",
  readerWidth: 820
};
const prefs = { ...defaultPrefs, ...JSON.parse(localStorage.getItem("nt_prefs") || "{}") };

function obtenerTemaGiscus() {
  const temasClaros = ["sepia", "parchment", "softgray", "light"];
  if (prefs.theme === "amoled") return "noborder_dark";
  return temasClaros.includes(prefs.theme) ? "light" : "dark_dimmed";
}

function actualizarTemaGiscusEnVivo() {
  const iframe = document.querySelector("iframe.giscus-frame");
  if (!iframe) return;
  iframe.contentWindow.postMessage(
    { giscus: { setConfig: { theme: obtenerTemaGiscus() } } },
    "https://giscus.app"
  );
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
  actualizarTemaGiscusEnVivo();
}

document.getElementById("btn-settings").addEventListener("click", () => {
  document.getElementById("music-drawer").classList.add("hidden");
  if (reproductorActivo) document.getElementById("music-mini-pill").classList.remove("hidden");
  document.getElementById("settings-drawer").classList.toggle("hidden");
});
document.getElementById("btn-close-settings").addEventListener("click", () => {
  document.getElementById("settings-drawer").classList.add("hidden");
});
document.querySelectorAll("#theme-swatches button").forEach(btn => {
  btn.addEventListener("click", () => { prefs.theme = btn.dataset.themeVal; aplicarPreferencias(); });
});
document.getElementById("font-family-select").addEventListener("change", (e) => {
  prefs.fontFamily = e.target.value; aplicarPreferencias();
});
document.getElementById("btn-font-inc").addEventListener("click", () => {
  if (prefs.fontSize < 30) { prefs.fontSize += 1; aplicarPreferencias(); }
});
document.getElementById("btn-font-dec").addEventListener("click", () => {
  if (prefs.fontSize > 13) { prefs.fontSize -= 1; aplicarPreferencias(); }
});
document.getElementById("btn-lh-inc").addEventListener("click", () => {
  if (prefs.lineHeight < 2.4) { prefs.lineHeight = +(prefs.lineHeight + 0.1).toFixed(2); aplicarPreferencias(); }
});
document.getElementById("btn-lh-dec").addEventListener("click", () => {
  if (prefs.lineHeight > 1.3) { prefs.lineHeight = +(prefs.lineHeight - 0.1).toFixed(2); aplicarPreferencias(); }
});
document.getElementById("width-slider").addEventListener("input", (e) => {
  prefs.readerWidth = parseInt(e.target.value, 10); aplicarPreferencias();
});

// ==========================================
// 3. NAVEGACIÓN POR PESTAÑAS (ESTILO MIHON)
// ==========================================
function mostrarVista(nombre) {
  document.getElementById("settings-drawer").classList.add("hidden");
  document.getElementById("selection-toolbar").classList.add("hidden");
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(`view-${nombre}`).classList.add("active");

  document.getElementById("bottom-nav").classList.toggle("hidden", nombre === "reader");
  window.scrollTo(0, 0);
}

function cambiarTab(tabName) {
  tabAnterior = tabName;
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });

  if (tabName === "library") {
    renderizarBannerUltimaLectura();
    renderizarBiblioteca();
  } else if (tabName === "updates") {
    renderizarActualizaciones();
  } else if (tabName === "history") {
    renderizarHistorial();
  } else if (tabName === "explore") {
    renderizarExplorar();
  }

  mostrarVista(tabName);
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => cambiarTab(btn.dataset.tab));
});

document.getElementById("btn-home").addEventListener("click", () => cambiarTab("library"));
document.getElementById("btn-notebook").addEventListener("click", () => {
  renderizarLibretaGlobal();
  mostrarVista("notebook");
});

// ==========================================
// 4. BIBLIOTECA PERSONAL Y CONTEO DE SIN LEER
// ==========================================
function obtenerBibliotecaSlugs() {
  return JSON.parse(localStorage.getItem("nt_biblioteca") || "[]");
}

function alternarEnBiblioteca(slug) {
  let bib = obtenerBibliotecaSlugs();
  if (bib.includes(slug)) {
    bib = bib.filter(s => s !== slug);
  } else {
    bib.push(slug);
  }
  localStorage.setItem("nt_biblioteca", JSON.stringify(bib));
  return bib.includes(slug);
}

function contarCapitulosSinLeer(novela) {
  const progreso = JSON.parse(localStorage.getItem("nt_progreso") || "{}");
  let sinLeer = 0;
  for (const vol of novela.volumenes) {
    for (let c = 1; c <= vol.total_capitulos; c++) {
      if (!progreso[`${novela.slug}_${vol.clave}_${c}`]) {
        sinLeer++;
      }
    }
  }
  return sinLeer;
}

function crearTarjetaNovela(novela, esVistaExplorar = false) {
  const enBiblioteca = obtenerBibliotecaSlugs().includes(novela.slug);
  const sinLeer = contarCapitulosSinLeer(novela);

  const card = document.createElement("div");
  card.className = "card";

  const badgeUnread = sinLeer > 0 ? `<span class="unread-badge">${sinLeer}</span>` : "";
  const badgeLib = (esVistaExplorar && enBiblioteca) ? `<span class="in-library-badge">❤️ En biblioteca</span>` : "";
  const imgHtml = novela.portada
    ? `<img src="${novela.portada}" alt="Portada de ${novela.titulo_es}" class="card-cover" loading="lazy" />`
    : `<div class="card-cover placeholder">📖</div>`;

  card.innerHTML = `
    ${badgeUnread}
    ${badgeLib}
    ${imgHtml}
    <div class="card-info">
      <span class="tag">${novela.volumenes.length} Vol. • ${novela.tono || "Novela Ligera"}</span>
      <h2>${novela.titulo_es}</h2>
      <p>${novela.sinopsis}</p>
    </div>
  `;
  card.onclick = () => abrirNovela(novela);
  return card;
}

function renderizarBiblioteca(filtro = "") {
  const grid = document.getElementById("library-grid");
  const slugs = obtenerBibliotecaSlugs();
  const q = filtro.toLowerCase().trim();

  const guardadas = catalogoData.filter(n =>
    slugs.includes(n.slug) &&
    (!q || n.titulo_es.toLowerCase().includes(q) || n.sinopsis.toLowerCase().includes(q))
  );

  grid.innerHTML = "";
  if (guardadas.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1; padding:1.5rem; background:var(--surface); border-radius:10px; border:1px solid var(--border);">
        <p style="margin-bottom:0.8rem;">Tu biblioteca está vacía.</p>
        <button class="nav-btn primary" onclick="cambiarTab('explore')">🧭 Ir a Explorar y añadir novelas</button>
      </div>
    `;
    return;
  }

  guardadas.forEach(novela => grid.appendChild(crearTarjetaNovela(novela, false)));
}

function renderizarExplorar(filtro = "") {
  const grid = document.getElementById("explore-grid");
  const q = filtro.toLowerCase().trim();

  const filtradas = catalogoData.filter(n =>
    !q || n.titulo_es.toLowerCase().includes(q) ||
    (n.tono && n.tono.toLowerCase().includes(q)) ||
    n.sinopsis.toLowerCase().includes(q)
  );

  grid.innerHTML = "";
  filtradas.forEach(novela => grid.appendChild(crearTarjetaNovela(novela, true)));
}

document.getElementById("search-library").addEventListener("input", (e) => renderizarBiblioteca(e.target.value));
document.getElementById("search-explore").addEventListener("input", (e) => renderizarExplorar(e.target.value));

// ==========================================
// 5. ACTUALIZACIONES (NOTICIAS + SUBIDAS)
// ==========================================
function renderizarActualizaciones() {
  const feed = document.getElementById("updates-feed");
  let html = "";

  noticiasData.forEach(noticia => {
    html += `
      <div class="feed-item news-item">
        <span class="feed-badge">📢 ${noticia.tipo || "Anuncio"} • ${noticia.fecha}</span>
        <strong style="font-size:1.05rem; margin-top:0.25rem;">${noticia.titulo}</strong>
        <p style="color:var(--muted); font-size:0.9rem; margin-top:0.3rem;">${noticia.contenido}</p>
      </div>
    `;
  });

  const subidas = [];
  catalogoData.forEach(novela => {
    novela.volumenes.forEach(vol => {
      subidas.push({ novela, vol, fecha: vol.fecha_subida || "" });
    });
  });
  subidas.sort((a, b) => b.fecha.localeCompare(a.fecha));

  subidas.forEach(item => {
    html += `
      <div class="feed-item">
        <div>
          <span class="feed-badge">✨ Nuevo Volumen Subido</span>
          <div style="font-weight:600; margin-top:0.2rem;">${item.novela.titulo_es} — Volumen ${item.vol.numero}</div>
          <div class="feed-meta">${item.vol.total_capitulos} capítulos • Publicado: ${item.fecha}</div>
        </div>
        <button class="nav-btn primary" onclick="abrirNovelaPorSlug('${item.novela.slug}')">Ver</button>
      </div>
    `;
  });

  feed.innerHTML = html || `<p style="color:var(--muted);">No hay actualizaciones recientes.</p>`;
}

function abrirNovelaPorSlug(slug) {
  const nov = catalogoData.find(n => n.slug === slug);
  if (nov) abrirNovela(nov);
}

// ==========================================
// 6. HISTORIAL Y CONTINUAR LECTURA
// ==========================================
function registrarEnHistorial(novela, vol, capData) {
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

  if (historial.length === 0) {
    list.innerHTML = `<p style="color:var(--muted);">Aún no has leído ningún capítulo.</p>`;
    return;
  }

  list.innerHTML = historial.map((h, i) => `
    <div class="feed-item">
      <div>
        <div style="font-weight:600;">${h.novelaTitulo}</div>
        <div class="feed-meta">Vol. ${h.volNumero}, Cap. ${h.capNumero}: ${h.capTitulo}</div>
        <div class="feed-meta">Leído el ${h.fechaHora}</div>
      </div>
      <button class="nav-btn primary" onclick="reanudarDesdeHistorial(${i})">Leer</button>
    </div>
  `).join("");
}

async function reanudarDesdeHistorial(indiceHistorial) {
  const historial = JSON.parse(localStorage.getItem("nt_historial") || "[]");
  const item = historial[indiceHistorial];
  if (!item) return;

  const novelaObj = catalogoData.find(n => n.slug === item.slug);
  if (!novelaObj) return;
  const volObj = novelaObj.volumenes.find(v => v.clave === item.volClave);
  if (!volObj) return;

  const res = await fetch(volObj.ruta_indice);
  const indiceData = await res.json();
  const idx = indiceData.capitulos.findIndex(c => c.numero === item.capNumero);
  if (idx !== -1) {
    await abrirCapitulo(novelaObj, volObj, indiceData.capitulos, idx, 0);
  }
}

document.getElementById("btn-clear-history").addEventListener("click", () => {
  localStorage.removeItem("nt_historial");
  renderizarHistorial();
});

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
  if (!ultima) { banner.classList.add("hidden"); return; }

  const novelaObj = catalogoData.find(n => n.slug === ultima.slug);
  if (!novelaObj) { banner.classList.add("hidden"); return; }
  const volObj = novelaObj.volumenes.find(v => v.clave === ultima.volClave);
  if (!volObj) return;

  banner.classList.remove("hidden");
  banner.innerHTML = `
    <div>
      <span style="font-size:0.76rem; color:var(--accent); font-weight:700;">CONTINUAR ÚLTIMA LECTURA</span>
      <div style="font-weight:600; margin-top:0.2rem;">${novelaObj.titulo_es} — Vol. ${volObj.numero}, Cap. ${ultima.capNumero}</div>
    </div>
    <button id="btn-resume-now" class="nav-btn primary">Reanudar →</button>
  `;

  document.getElementById("btn-resume-now").onclick = async () => {
    const res = await fetch(volObj.ruta_indice);
    const indiceData = await res.json();
    const idx = indiceData.capitulos.findIndex(c => c.numero === ultima.capNumero);
    if (idx !== -1) {
      await abrirCapitulo(novelaObj, volObj, indiceData.capitulos, idx, ultima.scrollY || 0);
    }
  };
}

// ==========================================
// 7. FICHA DE NOVELA E ÍNDICE
// ==========================================
async function abrirNovela(novela) {
  estadoActual.novela = novela;
  document.getElementById("btn-novel-back").onclick = () => cambiarTab(tabAnterior);

  const btnBib = document.getElementById("btn-toggle-library");
  const actualizarBotonBib = () => {
    const enBib = obtenerBibliotecaSlugs().includes(novela.slug);
    btnBib.textContent = enBib ? "❤️ En Biblioteca" : "🤍 Añadir a Biblioteca";
    btnBib.classList.toggle("primary", enBib);
  };
  actualizarBotonBib();
  btnBib.onclick = () => { alternarEnBiblioteca(novela.slug); actualizarBotonBib(); };

  const coverHtml = novela.portada
    ? `<img src="${novela.portada}" alt="${novela.titulo_es}" class="novel-hero-cover" />`
    : "";

  document.getElementById("novel-header").innerHTML = `
    <div class="novel-hero">
      ${coverHtml}
      <div class="novel-hero-info">
        <h1>${novela.titulo_es}</h1>
        <span class="tag" style="color:var(--accent); font-size:0.85rem;">${novela.tono || "Novela Ligera"}</span>
        <p style="color:var(--muted); margin:0.6rem 0 1rem; font-size:0.95rem;">${novela.sinopsis}</p>
        <button id="btn-smart-read" class="nav-btn primary">▶ Empezar / Continuar lectura</button>
      </div>
    </div>
  `;

  const container = document.getElementById("volumes-container");
  container.innerHTML = "<p>Cargando capítulos...</p>";
  mostrarVista("novel");

  const progreso = JSON.parse(localStorage.getItem("nt_progreso") || "{}");
  container.innerHTML = "";

  let primerNoLeido = null;
  let primerCapituloAbsoluto = null;

  for (const vol of novela.volumenes) {
    const res = await fetch(vol.ruta_indice);
    const indiceData = await res.json();

    const volCoverHtml = vol.portada ? `<img src="${vol.portada}" alt="Volumen ${vol.numero}" class="vol-cover" />` : "";
    const box = document.createElement("div");
    box.className = "vol-box";
    box.innerHTML = `
      <div class="vol-header">
        ${volCoverHtml}
        <div>
          <h3>Volumen ${vol.numero}</h3>
          <span style="color:var(--muted); font-size:0.85rem;">${indiceData.capitulos.length} capítulos</span>
        </div>
      </div>
    `;

    const ul = document.createElement("ul");
    ul.className = "cap-list";

    indiceData.capitulos.forEach((cap, idx) => {
      const claveLeido = `${novela.slug}_${vol.clave}_${cap.numero}`;
      const leido = !!progreso[claveLeido];

      if (!primerCapituloAbsoluto) primerCapituloAbsoluto = { vol, caps: indiceData.capitulos, idx };
      if (!leido && !primerNoLeido) primerNoLeido = { vol, caps: indiceData.capitulos, idx };

      const li = document.createElement("li");
      li.className = "cap-item" + (leido ? " read" : "");

      const spanTitle = document.createElement("span");
      spanTitle.className = "cap-title-btn";
      spanTitle.textContent = `Cap. ${cap.numero}: ${cap.titulo}`;
      spanTitle.onclick = () => abrirCapitulo(novela, vol, indiceData.capitulos, idx, 0);

      const btnCheck = document.createElement("button");
      btnCheck.className = "cap-toggle-read";
      btnCheck.title = "Marcar como leído / no leído";
      btnCheck.textContent = leido ? "✓ Leído" : "Marcar";
      btnCheck.onclick = (e) => {
        e.stopPropagation();
        const progActual = JSON.parse(localStorage.getItem("nt_progreso") || "{}");
        if (progActual[claveLeido]) {
          delete progActual[claveLeido];
        } else {
          progActual[claveLeido] = true;
        }
        localStorage.setItem("nt_progreso", JSON.stringify(progActual));
        abrirNovela(novela);
      };

      li.appendChild(spanTitle);
      li.appendChild(btnCheck);
      ul.appendChild(li);
    });

    box.appendChild(ul);
    container.appendChild(box);
  }

  const objetivo = primerNoLeido || primerCapituloAbsoluto;
  const btnSmart = document.getElementById("btn-smart-read");
  if (objetivo) {
    btnSmart.textContent = primerNoLeido
      ? `▶ Continuar: Vol. ${objetivo.vol.numero}, Cap. ${objetivo.caps[objetivo.idx].numero}`
      : "▶ Volver a leer desde el inicio";
    btnSmart.onclick = () => abrirCapitulo(novela, objetivo.vol, objetivo.caps, objetivo.idx, 0);
  }
}

// ==========================================
// 8. LECTOR DE CAPÍTULOS, COMENTARIOS Y CITAS
// ==========================================
function formatearParrafo(texto) {
  const limpio = texto.trim();
  if (/^(\*\s*){3,}$/.test(limpio) || limpio === "***") {
    return `<p class="scene-break">* * *</p>`;
  }
  const escapado = limpio
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return `<p>${escapado}</p>`;
}

function cargarComentariosCapitulo(identificadorHilo) {
  const contenedor = document.getElementById("comments-thread");
  const hint = document.querySelector(".comments-hint");
  contenedor.innerHTML = "";

  // Si aún no has puesto los IDs reales de Giscus, mostrar guía rápida y el ID del hilo
  if (GISCUS_CONFIG.repoId.startsWith("PEGA_AQUI")) {
    if (hint) hint.classList.remove("hidden");
    contenedor.innerHTML = `<div style="margin-top:0.75rem; font-size:0.82rem; color:var(--muted);">Hilo preparado: <code>${identificadorHilo}</code></div>`;
    return;
  }

  // Ocultar texto de instrucciones y cargar widget real de Giscus
  if (hint) hint.classList.add("hidden");

  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.setAttribute("data-repo", GISCUS_CONFIG.repo);
  script.setAttribute("data-repo-id", GISCUS_CONFIG.repoId);
  script.setAttribute("data-category", GISCUS_CONFIG.category);
  script.setAttribute("data-category-id", GISCUS_CONFIG.categoryId);
  script.setAttribute("data-mapping", "specific");
  script.setAttribute("data-term", identificadorHilo);
  script.setAttribute("data-strict", "0");
  script.setAttribute("data-reactions-enabled", "1");
  script.setAttribute("data-emit-metadata", "0");
  script.setAttribute("data-input-position", "top");
  script.setAttribute("data-theme", obtenerTemaGiscus());
  script.setAttribute("data-lang", "es");
  script.crossOrigin = "anonymous";
  script.async = true;

  contenedor.appendChild(script);
}

async function abrirCapitulo(novela, vol, listaCapitulos, idx, scrollRestaurar = 0) {
  estadoActual = { novela, volumen: vol, capitulosIndice: listaCapitulos, capIndex: idx };
  const capInfo = listaCapitulos[idx];
  const rutaJson = `output/novelas/${novela.slug}/${vol.clave}/${capInfo.archivo}`;

  const res = await fetch(rutaJson);
  const capData = await res.json();

  const progreso = JSON.parse(localStorage.getItem("nt_progreso") || "{}");
  progreso[`${novela.slug}_${vol.clave}_${capData.numero}`] = true;
  localStorage.setItem("nt_progreso", JSON.stringify(progreso));

  localStorage.setItem("nt_ultima_lectura", JSON.stringify({
    slug: novela.slug,
    volClave: vol.clave,
    capNumero: capData.numero,
    capTitulo: capData.titulo_es,
    scrollY: scrollRestaurar
  }));

  registrarEnHistorial(novela, vol, capData);

  let html = `<h1>Capítulo ${capData.numero}: ${capData.titulo_es}</h1>`;
  html += capData.parrafos.map(formatearParrafo).join("");

  if (capData.notas_traductor && capData.notas_traductor.length > 0) {
    html += `<div class="translator-notes"><strong>Notas de traducción:</strong><ul>` +
      capData.notas_traductor.map(n => `<li>${n}</li>`).join("") +
      `</ul></div>`;
  }

  document.getElementById("chapter-content").innerHTML = html;
  document.getElementById("reader-progress-label").textContent =
    `Vol. ${vol.numero} • Cap. ${idx + 1} de ${listaCapitulos.length}`;

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

  if (scrollRestaurar > 0) {
    setTimeout(() => window.scrollTo({ top: scrollRestaurar, behavior: "smooth" }), 100);
  }
}

// Citas y Notas
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

document.getElementById("btn-cancel-note").addEventListener("click", () => {
  document.getElementById("note-modal").classList.add("hidden");
});

document.getElementById("btn-confirm-note").addEventListener("click", () => {
  const notaTexto = document.getElementById("modal-note-input").value.trim();
  registrarCitaONota(seleccionActualTexto, notaTexto);
  document.getElementById("note-modal").classList.add("hidden");
  window.getSelection().removeAllRanges();
});

function registrarCitaONota(cita, nota) {
  const capInfo = estadoActual.capitulosIndice[estadoActual.capIndex];
  const notas = obtenerNotas();
  notas.unshift({
    id: Date.now(),
    slug: estadoActual.novela.slug,
    novelaTitulo: estadoActual.novela.titulo_es,
    volNumero: estadoActual.volumen.numero,
    capNumero: capInfo.numero,
    capTitulo: capInfo.titulo,
    cita,
    nota,
    fecha: new Date().toLocaleDateString()
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
  const notasCap = obtenerNotas().filter(
    n => n.slug === estadoActual.novela.slug && n.volNumero === estadoActual.volumen.numero && n.capNumero === capInfo.numero
  );

  if (notasCap.length === 0) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  list.innerHTML = notasCap.map(n => `
    <div class="note-card" style="margin-top:0.75rem;">
      <blockquote>"${n.cita}"</blockquote>
      ${n.nota ? `<p>${n.nota}</p>` : ""}
      <div class="note-meta">
        <span>Guardado el ${n.fecha}</span>
        <button class="btn-del-note" onclick="eliminarNota(${n.id})">Eliminar</button>
      </div>
    </div>
  `).join("");
}

function renderizarLibretaGlobal() {
  const list = document.getElementById("notebook-list");
  const notas = obtenerNotas();
  if (notas.length === 0) {
    list.innerHTML = `<p style="color:var(--muted);">Aún no has guardado citas ni notas.</p>`;
    return;
  }
  list.innerHTML = notas.map(n => `
    <div class="note-card">
      <blockquote>"${n.cita}"</blockquote>
      ${n.nota ? `<p>${n.nota}</p>` : ""}
      <div class="note-meta">
        <span>${n.novelaTitulo} • Vol. ${n.volNumero}, Cap. ${n.capNumero} (${n.fecha})</span>
        <button class="btn-del-note" onclick="eliminarNota(${n.id})">Eliminar</button>
      </div>
    </div>
  `).join("");
}

document.getElementById("btn-export-notes").addEventListener("click", () => {
  const notas = obtenerNotas();
  if (!notas.length) return;
  const contenido = notas.map(n =>
    `[${n.novelaTitulo} - Vol. ${n.volNumero}, Cap. ${n.capNumero}]\n"${n.cita}"\n${n.nota ? "Nota: " + n.nota + "\n" : ""}---`
  ).join("\n\n");
  const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mis_citas_y_notas.txt";
  a.click();
});

// Respaldo y Restauración estilo Mihon (.json)
document.getElementById("btn-backup-json").addEventListener("click", () => {
  const backup = {
    nt_biblioteca: obtenerBibliotecaSlugs(),
    nt_progreso: JSON.parse(localStorage.getItem("nt_progreso") || "{}"),
    nt_historial: JSON.parse(localStorage.getItem("nt_historial") || "[]"),
    nt_notas: obtenerNotas(),
    nt_pistas: obtenerPistasGuardadas(),
    nt_ultima_lectura: JSON.parse(localStorage.getItem("nt_ultima_lectura") || "null"),
    nt_prefs: prefs
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `novelatrad_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
});

document.getElementById("input-restore-json").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.nt_biblioteca) localStorage.setItem("nt_biblioteca", JSON.stringify(data.nt_biblioteca));
      if (data.nt_progreso) localStorage.setItem("nt_progreso", JSON.stringify(data.nt_progreso));
      if (data.nt_historial) localStorage.setItem("nt_historial", JSON.stringify(data.nt_historial));
      if (data.nt_notas) localStorage.setItem("nt_notas", JSON.stringify(data.nt_notas));
      if (data.nt_pistas) localStorage.setItem("nt_pistas", JSON.stringify(data.nt_pistas));
      if (data.nt_ultima_lectura) localStorage.setItem("nt_ultima_lectura", JSON.stringify(data.nt_ultima_lectura));
      alert("Respaldo restaurado correctamente.");
      location.reload();
    } catch {
      alert("El archivo de respaldo no es válido.");
    }
  };
  reader.readAsText(file);
});

// ==========================================
// 9. INICIALIZACIÓN
// ==========================================
async function iniciarApp() {
  aplicarPreferencias();
  try {
    const resCat = await fetch("output/catalogo.json");
    const dataCat = await resCat.json();
    catalogoData = dataCat.novelas || [];

    try {
      const resNot = await fetch("output/noticias.json");
      const dataNot = await resNot.json();
      noticiasData = dataNot.noticias || [];
    } catch {
      noticiasData = [];
    }

    if (obtenerBibliotecaSlugs().length === 0 && catalogoData.length > 0) {
      cambiarTab("explore");
    } else {
      cambiarTab("library");
    }
  } catch {
    document.getElementById("library-grid").innerHTML =
      `<p>No se pudo cargar <code>output/catalogo.json</code>. Ejecuta <code>python generar_catalogo.py</code>.</p>`;
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

iniciarApp();