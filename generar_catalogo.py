import os
import json
from datetime import datetime

RUTA_REGISTRO = "registro_traducciones.json"
RUTA_OUTPUT = "output"
RUTA_CATALOGO = os.path.join(RUTA_OUTPUT, "catalogo.json")
RUTA_NOTICIAS = os.path.join(RUTA_OUTPUT, "noticias.json")

def asegurar_archivo_noticias():
    """Crea un archivo de noticias inicial editable manualmente si aún no existe."""
    if not os.path.exists(RUTA_NOTICIAS):
        noticias_iniciales = [
            {
                "fecha": datetime.now().strftime("%Y-%m-%d"),
                "tipo": "Proyecto",
                "titulo": "¡Lanzamiento de NovelaTrad Reader!",
                "contenido": "Estrenamos nueva interfaz inspirada en Mihon con Biblioteca personal, Historial, Libreta de citas y soporte PWA offline."
            }
        ]
        with open(RUTA_NOTICIAS, "w", encoding="utf-8") as f:
            json.dump({"noticias": noticias_iniciales}, f, ensure_ascii=False, indent=2)

RUTA_REPOS_EXTERNOS = "repos_externos.json"

def cargar_novelas_externas() -> list[dict]:
    """Lee repos_externos.json y genera entradas de catálogo apuntando a jsDelivr."""
    if not os.path.exists(RUTA_REPOS_EXTERNOS):
        return []
    try:
        with open(RUTA_REPOS_EXTERNOS, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except Exception as e:
        print(f"[AVISO] No se pudo leer {RUTA_REPOS_EXTERNOS}: {e}")
        return []

    usuario = (cfg.get("usuario_github") or "").strip()
    if not usuario or usuario == "TU_USUARIO_GITHUB":
        return []

    extras = []
    for repo in cfg.get("repos", []):
        nombre_repo = (repo.get("nombre") or "").strip()
        rama = (repo.get("rama") or "main").strip()
        if not nombre_repo:
            continue
        base_cdn = f"https://cdn.jsdelivr.net/gh/{usuario}/{nombre_repo}@{rama}"

        for nov in repo.get("novelas", []):
            slug = (nov.get("slug") or "").strip()
            if not slug:
                continue
            ext_portada = (nov.get("ext_portada") or "jpg").lstrip(".")
            vols_raw = nov.get("volumenes") or []
            volumenes_lista = []
            portada_principal = None
            ultima_actualizacion = nov.get("ultima_actualizacion") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            for v in vols_raw:
                num_vol = int(v.get("numero", 1))
                clave_vol = v.get("clave") or f"vol-{num_vol:02d}"
                v_ext = (v.get("ext_portada") or ext_portada).lstrip(".")
                ruta_portada = f"{base_cdn}/novelas/{slug}/{clave_vol}/portada.{v_ext}"
                if not portada_principal:
                    portada_principal = ruta_portada
                volumenes_lista.append({
                    "clave": clave_vol,
                    "numero": num_vol,
                    "total_capitulos": int(v.get("total_capitulos", 0)),
                    "fecha_subida": v.get("fecha_subida") or ultima_actualizacion,
                    "ruta_indice": f"{base_cdn}/novelas/{slug}/{clave_vol}/indice.json",
                    "portada": ruta_portada,
                    "repo_origen": nombre_repo
                })

            if volumenes_lista:
                extras.append({
                    "slug": slug,
                    "titulo_es": nov.get("titulo_es") or slug,
                    "titulo_original": nov.get("titulo_original") or nov.get("titulo_es") or slug,
                    "sinopsis": nov.get("sinopsis") or "Sinopsis no disponible.",
                    "tono": nov.get("tono") or "",
                    "portada": portada_principal,
                    "ultima_actualizacion": ultima_actualizacion,
                    "volumenes": volumenes_lista,
                    "repo_origen": nombre_repo
                })
    return extras

def construir_catalogo():
    if not os.path.exists(RUTA_REGISTRO):
        print("No se encontró registro_traducciones.json. Ejecuta primero novela_trad.py.")
        return

    with open(RUTA_REGISTRO, "r", encoding="utf-8") as f:
        registro = json.load(f)

    catalogo = []

    for slug, info_novela in registro.get("novelas", {}).items():
        carpeta_novela = os.path.join(RUTA_OUTPUT, "novelas", slug)
        if not os.path.exists(carpeta_novela):
            continue

        biblias = sorted([
            b for b in os.listdir(carpeta_novela)
            if b.startswith("biblia_v") and b.endswith(".json")
        ])
        sinopsis = "Sinopsis no disponible."
        tono = ""
        if biblias:
            with open(os.path.join(carpeta_novela, biblias[-1]), "r", encoding="utf-8") as fb:
                datos_biblia = json.load(fb)
                sinopsis = datos_biblia.get("resumen_trama", sinopsis)
                tono = datos_biblia.get("tono_narrativo", "")

        volumenes_lista = []
        portada_principal = None
        ultima_actualizacion = ""

        for clave_vol, info_vol in sorted(info_novela.get("volumenes", {}).items()):
            if info_vol.get("estado") != "completado":
                continue
            num_vol = int(clave_vol.replace("vol-", ""))
            carpeta_vol = os.path.join(carpeta_novela, clave_vol)
            fecha_comp = info_vol.get("fecha_completado", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            if fecha_comp > ultima_actualizacion:
                ultima_actualizacion = fecha_comp

            ruta_portada_web = None
            for ext in (".jpg", ".jpeg", ".png", ".webp"):
                if os.path.exists(os.path.join(carpeta_vol, f"portada{ext}")):
                    ruta_portada_web = f"output/novelas/{slug}/{clave_vol}/portada{ext}"
                    if not portada_principal:
                        portada_principal = ruta_portada_web
                    break

            volumenes_lista.append({
                "clave": clave_vol,
                "numero": num_vol,
                "total_capitulos": info_vol.get("total_capitulos", 0),
                "fecha_subida": fecha_comp,
                "ruta_indice": f"output/novelas/{slug}/{clave_vol}/indice.json",
                "portada": ruta_portada_web
            })

        if volumenes_lista:
            catalogo.append({
                "slug": slug,
                "titulo_es": info_novela.get("titulo_es", slug),
                "titulo_original": info_novela.get("carpeta_origen", slug),
                "sinopsis": sinopsis,
                "tono": tono,
                "portada": portada_principal,
                "ultima_actualizacion": ultima_actualizacion,
                "volumenes": volumenes_lista
            })

    # Fusionar novelas externas (repos satélite) evitando duplicados de slug
    slugs_locales = {n["slug"] for n in catalogo}
    for nov_ext in cargar_novelas_externas():
        if nov_ext["slug"] not in slugs_locales:
            catalogo.append(nov_ext)
            slugs_locales.add(nov_ext["slug"])

    os.makedirs(RUTA_OUTPUT, exist_ok=True)
    asegurar_archivo_noticias()

    with open(RUTA_CATALOGO, "w", encoding="utf-8") as f:
        json.dump({"novelas": catalogo}, f, ensure_ascii=False, indent=2)

    print(f"Catálogo actualizado en {RUTA_CATALOGO} con {len(catalogo)} novela(s).")

if __name__ == "__main__":
    construir_catalogo()