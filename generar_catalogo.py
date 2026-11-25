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

    os.makedirs(RUTA_OUTPUT, exist_ok=True)
    asegurar_archivo_noticias()

    with open(RUTA_CATALOGO, "w", encoding="utf-8") as f:
        json.dump({"novelas": catalogo}, f, ensure_ascii=False, indent=2)

    print(f"Catálogo actualizado en {RUTA_CATALOGO} con {len(catalogo)} novela(s).")

if __name__ == "__main__":
    construir_catalogo()