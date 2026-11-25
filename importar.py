import os
import json
from datetime import datetime
from parser_novela import extraer_capitulos, extraer_portada_epub
from novela_trad import (
    normalizar_slug,
    detectar_numero_volumen,
    calcular_hash_archivo,
    cargar_registro,
    guardar_registro,
)

CARPETA_YA_TRADUCIDAS = "input_es"

def importar_novelas_en_espanol():
    if not os.path.exists(CARPETA_YA_TRADUCIDAS):
        os.makedirs(CARPETA_YA_TRADUCIDAS)
        print(f"Carpeta '{CARPETA_YA_TRADUCIDAS}/' creada. Mete ahí subcarpetas con tus EPUB ya traducidos al español.")
        return

    registro = cargar_registro()
    subcarpetas = [d for d in sorted(os.listdir(CARPETA_YA_TRADUCIDAS)) if os.path.isdir(os.path.join(CARPETA_YA_TRADUCIDAS, d))]

    for nombre_novela in subcarpetas:
        ruta_novela = os.path.join(CARPETA_YA_TRADUCIDAS, nombre_novela)
        slug = normalizar_slug(nombre_novela)
        archivos = [f for f in sorted(os.listdir(ruta_novela)) if f.lower().endswith((".epub", ".txt"))]
        if not archivos:
            continue

        if slug not in registro["novelas"]:
            registro["novelas"][slug] = {
                "carpeta_origen": nombre_novela,
                "titulo_es": nombre_novela,
                "volumenes": {}
            }

        carpeta_novela_out = os.path.join("output", "novelas", slug)
        os.makedirs(carpeta_novela_out, exist_ok=True)

        # Crear una Biblia mínima con sinopsis editable si no existe
        ruta_biblia = os.path.join(carpeta_novela_out, "biblia_v1.json")
        if not os.path.exists(ruta_biblia):
            with open(ruta_biblia, "w", encoding="utf-8") as fb:
                json.dump({
                    "titulo_original": nombre_novela,
                    "titulo_es": nombre_novela,
                    "tono_narrativo": "Traducción importada",
                    "resumen_trama": f"Edición en español de {nombre_novela}.",
                    "personajes": [],
                    "glosario": []
                }, fb, ensure_ascii=False, indent=2)

        for idx, archivo in enumerate(archivos, start=1):
            num_vol = detectar_numero_volumen(archivo, idx)
            clave_vol = f"vol-{num_vol:02d}"
            ruta_archivo = os.path.join(ruta_novela, archivo)
            carpeta_vol_out = os.path.join(carpeta_novela_out, clave_vol)
            os.makedirs(carpeta_vol_out, exist_ok=True)

            extraer_portada_epub(ruta_archivo, carpeta_vol_out)
            capitulos = extraer_capitulos(ruta_archivo, carpeta_salida=carpeta_vol_out)
            indice_web = []

            for cap in capitulos:
                num_cap = cap["numero"]
                titulo_cap = cap.get("titulo") or f"Capítulo {num_cap}"
                archivo_cap = f"cap-{num_cap:02d}.json"
                with open(os.path.join(carpeta_vol_out, archivo_cap), "w", encoding="utf-8") as fc:
                    json.dump({
                        "numero": num_cap,
                        "titulo_es": titulo_cap,
                        "parrafos": cap["parrafos"],
                        "notas_traductor": []
                    }, fc, ensure_ascii=False, indent=2)
                indice_web.append({"numero": num_cap, "titulo": titulo_cap, "archivo": archivo_cap})

            with open(os.path.join(carpeta_vol_out, "indice.json"), "w", encoding="utf-8") as fi:
                json.dump({
                    "slug": slug,
                    "volumen": num_vol,
                    "titulo_novela": nombre_novela,
                    "capitulos": indice_web
                }, fi, ensure_ascii=False, indent=2)

            registro["novelas"][slug]["volumenes"][clave_vol] = {
                "archivo_origen": archivo,
                "hash_sha256": calcular_hash_archivo(ruta_archivo),
                "total_capitulos": len(indice_web),
                "estado": "completado",
                "fecha_completado": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            print(f"[IMPORTADO] {nombre_novela} -> {clave_vol} ({len(indice_web)} capítulos listos sin usar API).")

    guardar_registro(registro)

if __name__ == "__main__":
    importar_novelas_en_espanol()