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
    list.innerHTML = `<div class="kaomoji-empty"><div class="empty-state-art"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m8 11 4 4 4-4"/><path d="M5 19h14"/></svg></div><div class="kaomoji-text">No tienes volúmenes guardados sin conexión</div></div>`;
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
