import os
import re
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup

def limpiar_html_ingles(html_bytes: bytes) -> list[str]:
    """Limpia el HTML de un EPUB en inglés conservando cursivas en Markdown y separadores de escena."""
    soup = BeautifulSoup(html_bytes, "lxml")

    # Convertir cursivas (pensamientos internos / énfasis) a formato Markdown
    for tag in soup.find_all(["em", "i"]):
        texto_cursiva = tag.get_text()
        if texto_cursiva.strip():
            tag.replace_with(f"*{texto_cursiva}*")

    # Convertir separadores horizontales en marcas estándar de escena
    for hr in soup.find_all("hr"):
        hr.replace_with("\n* * *\n")

    parrafos = []
    for p in soup.find_all(["p", "h1", "h2", "h3", "div"]):
        # Evitar contenedores padres que agrupan otros párrafos
        if p.name == "div" and p.find(["p", "div"]):
            continue
        texto = p.get_text().strip()
        texto = re.sub(r'\s+', ' ', texto)
        if texto:
            parrafos.append(texto)

    return parrafos

def extraer_capitulos(ruta_archivo: str, min_caracteres: int = 400) -> list[dict]:
    """Extrae capítulos desde .epub (siguiendo el spine) o desde .txt."""
    extension = os.path.splitext(ruta_archivo)[1].lower()
    capitulos = []

    if extension == ".epub":
        libro = epub.read_epub(ruta_archivo)
        indice_cap = 1

        # Recorrer el spine garantiza el orden de lectura exacto del libro
        for item_id, _ in libro.spine:
            item = libro.get_item_with_id(item_id)
            if item and item.get_type() == ebooklib.ITEM_DOCUMENT:
                parrafos = limpiar_html_ingles(item.get_content())
                texto_completo = "\n".join(parrafos)

                # Filtrar páginas de créditos, índices vacíos o portadillas
                if len(texto_completo) >= min_caracteres:
                    titulo_tentativo = parrafos[0][:60] if parrafos else f"Capítulo {indice_cap}"
                    capitulos.append({
                        "numero": indice_cap,
                        "titulo_en": titulo_tentativo,
                        "parrafos": parrafos
                    })
                    indice_cap += 1

    elif extension == ".txt":
        with open(ruta_archivo, "r", encoding="utf-8") as f:
            lineas = [l.strip() for l in f if l.strip()]

        # Dividir en bloques de ~7500 caracteres si es un TXT plano sin divisiones
        bloque_actual = []
        contador_chars = 0
        indice_cap = 1

        for linea in lineas:
            bloque_actual.append(linea)
            contador_chars += len(linea)
            if contador_chars >= 7500:
                capitulos.append({
                    "numero": indice_cap,
                    "titulo_en": bloque_actual[0][:60],
                    "parrafos": bloque_actual
                })
                indice_cap += 1
                bloque_actual = []
                contador_chars = 0

        if bloque_actual:
            capitulos.append({
                "numero": indice_cap,
                "titulo_en": bloque_actual[0][:60],
                "parrafos": bloque_actual
            })
    else:
        raise ValueError(f"Formato no soportado ({extension}). Usa .epub o .txt")

    return capitulos

import os
import ebooklib
from ebooklib import epub

def extraer_portada_epub(ruta_epub: str, carpeta_destino: str) -> str | None:
    """Extrae la imagen de portada de un EPUB y la guarda en carpeta_destino."""
    if not ruta_epub.lower().endswith(".epub"):
        return None

    try:
        libro = epub.read_epub(ruta_epub)
        imagen_portada = None

        for item in libro.get_items_of_type(ebooklib.ITEM_COVER):
            imagen_portada = item
            break

        if not imagen_portada:
            for item in libro.get_items_of_type(ebooklib.ITEM_IMAGE):
                if "cover" in item.get_name().lower():
                    imagen_portada = item
                    break

        if not imagen_portada:
            imagenes = list(libro.get_items_of_type(ebooklib.ITEM_IMAGE))
            if imagenes:
                imagen_portada = imagenes[0]

        if imagen_portada:
            ext = os.path.splitext(imagen_portada.get_name())[1].lower() or ".jpg"
            if ext not in (".jpg", ".jpeg", ".png", ".webp"):
                ext = ".jpg"
            nombre_archivo = f"portada{ext}"
            ruta_salida = os.path.join(carpeta_destino, nombre_archivo)
            with open(ruta_salida, "wb") as f:
                f.write(imagen_portada.get_content())
            return nombre_archivo

    except Exception as e:
        print(f"  [!] No se pudo extraer portada: {e}")

    return None