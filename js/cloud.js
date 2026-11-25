import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCyF90UOwipQ1HkEcUFrtGnecdZmYkqQH8",
  authDomain: "novelatrad.firebaseapp.com",
  projectId: "novelatrad",
  storageBucket: "novelatrad.firebasestorage.app",
  messagingSenderId: "155417298149",
  appId: "1:155417298149:web:6961bcb4fc40225ae2800c",
  measurementId: "G-JS0GQY3DP5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

window.usuarioNube = null;
window.esMecenas = false;
let unsubDoc = null;
let syncTimeout = null;

const CLAVES_SYNC = [
  "nt_biblioteca",
  "nt_progreso",
  "nt_categorias",
  "nt_notas",
  "nt_historial",
  "nt_prefs"
];

function recolectarEstadoLocal() {
  const payload = {};
  CLAVES_SYNC.forEach(k => {
    const raw = localStorage.getItem(k);
    if (raw !== null) payload[k] = raw;
  });
  return payload;
}

function aplicarEstadoRemoto(syncData) {
  if (!syncData || typeof syncData !== "object") return;
  let cambio = false;
  CLAVES_SYNC.forEach(k => {
    if (typeof syncData[k] === "string" && syncData[k] !== localStorage.getItem(k)) {
      localStorage.setItem(k, syncData[k]);
      cambio = true;
    }
  });
  if (cambio && typeof renderizarBiblioteca === "function") {
    try {
      if (typeof prefs !== "undefined") Object.assign(prefs, JSON.parse(localStorage.getItem("nt_prefs") || "{}"));
      if (typeof aplicarPreferencias === "function") aplicarPreferencias();
      renderizarBiblioteca();
    } catch (e) {}
  }
}

async function guardarEnNubeAhora() {
  if (!window.usuarioNube) return;
  const ref = doc(db, "users", window.usuarioNube.uid);
  try {
    await setDoc(ref, {
      email: (window.usuarioNube.email || "").trim().toLowerCase(),
      displayName: window.usuarioNube.displayName || "Lector",
      updatedAt: Date.now(),
      syncData: recolectarEstadoLocal()
    }, { merge: true });
    const lbl = document.getElementById("cloud-sync-status");
    if (lbl) lbl.textContent = "Sincronizado • " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (err) {
    console.warn("Error sincronizando con Firestore:", err);
  }
}

window.programarSyncNube = function () {
  if (!window.usuarioNube) return;
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(guardarEnNubeAhora, 2500);
};

// Interceptar localStorage.setItem para respaldar automáticamente cada cambio
const origSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (k, v) {
  origSetItem(k, v);
  if (CLAVES_SYNC.includes(k)) {
    window.programarSyncNube();
  }
};

function actualizarInterfazCuenta() {
  const box = document.getElementById("cloud-account-card");
  if (!box) return;

  if (!window.usuarioNube) {
    box.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:0.75rem; flex-wrap:wrap;">
        <div>
          <strong style="font-size:0.95rem;">Respaldo en la nube y Mecenas</strong>
          <div style="font-size:0.8rem; color:var(--muted);">Inicia sesión con Google para sincronizar tus lecturas entre dispositivos</div>
        </div>
        <button id="btn-google-login" class="m3-btn filled" style="display:flex; align-items:center; gap:0.45rem;">
          <span>Continuar con Google</span>
        </button>
      </div>
    `;
    document.getElementById("btn-google-login").onclick = () => signInWithPopup(auth, provider).catch(e => alert("No se pudo iniciar sesión: " + e.message));
  } else {
    const u = window.usuarioNube;
    const badgeHtml = window.esMecenas
      ? `<span class="mecenas-badge">★ Mecenas</span>`
      : `<span class="lector-badge">Lector</span>`;

    box.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.75rem; justify-content:space-between; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <img src="${u.photoURL || ""}" alt="" style="width:42px; height:42px; border-radius:50%; border:2px solid var(--accent); object-fit:cover;" onerror="this.style.display='none'" />
          <div>
            <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
              <strong style="font-size:0.95rem;">${u.displayName || u.email}</strong>
              ${badgeHtml}
            </div>
            <div id="cloud-sync-status" style="font-size:0.76rem; color:var(--muted);">Conectado a la nube</div>
          </div>
        </div>
        <div style="display:flex; gap:0.4rem; align-items:center;">
          <button id="btn-copy-uid" class="m3-btn tonal" style="font-size:0.76rem; padding:0.35rem 0.65rem;" title="Copia tu ID único para activar recompensas de Mecenas">ID Lector</button>
          <button id="btn-sync-now" class="m3-btn tonal" style="font-size:0.76rem; padding:0.35rem 0.65rem;">↻ Sync</button>
          <button id="btn-google-logout" class="m3-btn text" style="font-size:0.76rem; padding:0.35rem 0.6rem;">Salir</button>
        </div>
      </div>
    `;

    document.getElementById("btn-copy-uid").onclick = async () => {
      await navigator.clipboard.writeText(u.uid);
      const b = document.getElementById("btn-copy-uid");
      b.textContent = "✓ ID Copiado";
      setTimeout(() => { b.textContent = "ID Lector"; }, 1400);
    };
    document.getElementById("btn-sync-now").onclick = () => guardarEnNubeAhora();
    document.getElementById("btn-google-logout").onclick = () => signOut(auth);
  }

  
  document.querySelectorAll('a[href*="ko-fi.com/kagamineakira"]').forEach(a => {
    a.href = window.usuarioNube
      ? `https://ko-fi.com/kagamineakira?message=${encodeURIComponent("ID Lector: " + window.usuarioNube.uid)}`
      : "https://ko-fi.com/kagamineakira";
  });

  actualizarVentajasMecenasUI();
}

function actualizarVentajasMecenasUI() {
  document.body.classList.toggle("is-mecenas", !!window.esMecenas);
  document.querySelectorAll(".mecenas-only-opt").forEach(el => {
    if (el.tagName === "OPTION") {
      el.disabled = !window.esMecenas;
    } else {
      el.classList.toggle("locked-mecenas", !window.esMecenas);
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  window.usuarioNube = user || null;
  if (unsubDoc) { unsubDoc(); unsubDoc = null; }

  if (!user) {
    window.esMecenas = false;
    actualizarInterfazCuenta();
    return;
  }

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await guardarEnNubeAhora();
  } else {
    const data = snap.data();
    window.esMecenas = data.supporter === true || (data.supporter && data.supporter.active === true);
    if (data.syncData) aplicarEstadoRemoto(data.syncData);
    else await guardarEnNubeAhora();
  }

  unsubDoc = onSnapshot(ref, (docSnap) => {
    if (!docSnap.exists()) return;
    const d = docSnap.data();
    const nuevoEstado = d.supporter === true || (d.supporter && d.supporter.active === true);
    if (nuevoEstado !== window.esMecenas) {
      window.esMecenas = nuevoEstado;
      actualizarInterfazCuenta();
    }
  });

  actualizarInterfazCuenta();
});

window.descargarObraCompletaMecenas = async function (novela) {
  if (!window.esMecenas) {
    if (typeof abrirModalDonaciones === "function") abrirModalDonaciones();
    return;
  }
  if (!novela || !Array.isArray(novela.volumenes)) return;
  for (const vol of novela.volumenes) {
    if (typeof descargarVolumenOffline === "function") {
      await descargarVolumenOffline(novela, vol);
    }
  }
};

window.exportarLibretaMarkdown = function () {
  if (!window.esMecenas) {
    if (typeof abrirModalDonaciones === "function") abrirModalDonaciones();
    return;
  }
  const notas = JSON.parse(localStorage.getItem("nt_notas") || "[]");
  if (!notas.length) return alert("Tu libreta está vacía.");
  const md = ["# Mi Libreta de Citas — NovelaTrad\n"]
    .concat(notas.map(n => `> «${n.texto}»\n> — **${n.titulo}** (Vol. ${n.vol}, Cap. ${n.cap})${n.nota ? `\n*Nota:* ${n.nota}` : ""}\n`))
    .join("\n---\n\n");
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "libreta_novelatrad.md";
  a.click();
};

document.addEventListener("DOMContentLoaded", actualizarInterfazCuenta);
