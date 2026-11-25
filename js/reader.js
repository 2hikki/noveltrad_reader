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
