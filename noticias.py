import json
import os
import subprocess
from datetime import datetime

RUTA_NOTICIAS = os.path.join("output", "noticias.json")

MESES_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
]

def fecha_actual_es():
    ahora = datetime.now()
    return f"{ahora.day} de {MESES_ES[ahora.month - 1]} de {ahora.year}"

def cargar_noticias():
    os.makedirs("output", exist_ok=True)
    if not os.path.exists(RUTA_NOTICIAS):
        return []
    with open(RUTA_NOTICIAS, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            return data if isinstance(data, list) else data.get("noticias", [])
        except json.JSONDecodeError:
            return []

def guardar_noticias(lista):
    with open(RUTA_NOTICIAS, "w", encoding="utf-8") as f:
        json.dump(lista, f, ensure_ascii=False, indent=2)

def publicar():
    noticias = cargar_noticias()
    print("\n=== PUBLICAR NUEVA NOTICIA / AVISO ===")
    print("Ejemplos de etiqueta: Anuncio, Nuevo Proyecto, Aviso, Mantenimiento, Comunidad")
    etiqueta = input("Etiqueta [Anuncio]: ").strip() or "Anuncio"

    titulo = ""
    while not titulo:
        titulo = input("Título del mensaje: ").strip()

    print("Escribe el contenido (puedes usar varios párrafos; deja una línea vacía y presiona Enter para terminar):")
    lineas = []
    while True:
        linea = input()
        if linea == "":
            if lineas:
                break
            continue
        lineas.append(linea)

    fecha_defecto = fecha_actual_es()
    fecha = input(f"Fecha [{fecha_defecto}]: ").strip() or fecha_defecto

    nueva = {
        "etiqueta": etiqueta,
        "titulo": titulo,
        "contenido": "\n".join(lineas),
        "fecha": fecha,
        "timestamp": int(datetime.now().timestamp() * 1000)
    }

    noticias.insert(0, nueva)
    guardar_noticias(noticias)
    print(f"\n✔ Noticia publicada en {RUTA_NOTICIAS}: «{titulo}»")

    subir = input("¿Subir cambio a GitHub ahora mismo? (s/n) [s]: ").strip().lower() or "s"
    if subir == "s":
        subprocess.run(["git", "add", RUTA_NOTICIAS], check=True)
        subprocess.run(["git", "commit", "-m", f"Noticia: {titulo}"], check=True)
        subprocess.run(["git", "push"], check=True)
        print("✔ Publicado en GitHub Pages.")

def gestionar():
    noticias = cargar_noticias()
    if not noticias:
        print("\nNo hay noticias publicadas todavía.")
        return

    print("\n=== NOTICIAS PUBLICADAS ===")
    for i, n in enumerate(noticias, 1):
        print(f"{i}. [{n.get('etiqueta', 'Anuncio')}] {n.get('titulo', 'Sin título')} ({n.get('fecha', '')})")

    op = input("\nNúmero de noticia a eliminar (o Enter para volver): ").strip()
    if op.isdigit() and 1 <= int(op) <= len(noticias):
        eliminada = noticias.pop(int(op) - 1)
        guardar_noticias(noticias)
        print(f"✔ Eliminada: «{eliminada.get('titulo')}»")

def menu():
    while True:
        print("\n===============================")
        print("  GESTOR DE NOTICIAS NOVELATRAD")
        print("===============================")
        print("1. Publicar nueva noticia o aviso")
        print("2. Ver / eliminar noticias existentes")
        print("0. Salir")
        opcion = input("Elige una opción: ").strip()

        if opcion == "1":
            publicar()
        elif opcion == "2":
            gestionar()
        elif opcion == "0":
            break

if __name__ == "__main__":
    menu()