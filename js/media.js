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
