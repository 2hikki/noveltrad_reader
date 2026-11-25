import os
import re
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup


def _normalizar_ruta_epub(href: str) -> str:
    return re.sub(r"^(?:\.\./)+", "", (href or "").split("#")[0]).strip("/")

def _exportar_imagenes_epub(libro, carpeta_salida: str | None) -> dict[str, str]:
    """Exporta imágenes del EPUB a <carpeta_salida>/ilustraciones y devuelve {ruta_epub_norm: 'ilustraciones/archivo'}."""
    mapa_imgs = {}
    if not carpeta_salida:
        return mapa_imgs

    img_dir = os.path.join(carpeta_salida, "ilustraciones")
    os.makedirs(img_dir, exist_ok=True)
    usados = set()

    for item in libro.get_items_of_type(ebooklib.ITEM_IMAGE):
        data = item.get_content()
        if not data:
            continue
        nombre_base = os.path.basename(_normalizar_ruta_epub(item.get_name() or item.get_id() or "img.jpg"))
        if not nombre_base or "." not in nombre_base:
            nombre_base = f"{item.get_id() or 'ilustracion'}.jpg"
        nombre_base = re.sub(r"[^A-Za-z0-9._-]", "_", nombre_base)

        candidato = nombre_base
        stem, ext = os.path.splitext(nombre_base)
        idx = 2
        while candidato.lower() in usados:
            candidato = f"{stem}_{idx}{ext}"
            idx += 1
        usados.add(candidato.lower())

        destino = os.path.join(img_dir, candidato)
        with open(destino, "wb") as out:
            out.write(data)

        rel_web = f"ilustraciones/{candidato}"
        for clave in {
            _normalizar_ruta_epub(item.get_name()),
            _normalizar_ruta_epub(item.href),
            os.path.basename(_normalizar_ruta_epub(item.get_name())),
        }:
            if clave:
                mapa_imgs[clave] = rel_web
                mapa_imgs[clave.lower()] = rel_web

    return mapa_imgs

def _resolver_img_rel(src_attr: str, mapa_imgs: dict[str, str]) -> str | None:
    limpio = _normalizar_ruta_epub(src_attr)
    if not limpio:
        return None
    for cand in (limpio, limpio.lower(), os.path.basename(limpio), os.path.basename(limpio).lower()):
        if cand in mapa_imgs:
            return mapa_imgs[cand]
    return None

def limpiar_html_ingles(html_bytes: bytes, mapa_imgs: dict[str, str] | None = None) -> list[str]:
    """Limpia el HTML de un EPUB en inglés conservando cursivas en Markdown y separadores de escena."""
    soup = BeautifulSoup(html_bytes, "lxml")

    # Convertir etiquetas <img> y SVG <image> en marcadores [img: ilustraciones/...]
    if mapa_imgs:
        for img_tag in soup.find_all(["img", "image"]):
            raw_src = img_tag.get("src") or img_tag.get("xlink:href") or img_tag.get("href") or ""
            rel_img = _resolver_img_rel(raw_src, mapa_imgs)
            if rel_img:
                alt_txt = (img_tag.get("alt") or "").strip()
                marcador = f"\n[img: {rel_img} | {alt_txt}]\n" if alt_txt else f"\n[img: {rel_img}]\n"
                img_tag.replace_with(marcador)
            else:
                img_tag.decompose()

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

def extraer_capitulos(ruta_archivo: str, min_caracteres: int = 400, carpeta_salida: str | None = None) -> list[dict]:
    """Extrae capítulos desde .epub (siguiendo el spine) o desde .txt."""
    extension = os.path.splitext(ruta_archivo)[1].lower()
    capitulos = []

    if extension == ".epub":
        libro = epub.read_epub(ruta_archivo)
        mapa_imgs = _exportar_imagenes_epub(libro, carpeta_salida)
        indice_cap = 1

        # Recorrer el spine garantiza el orden de lectura exacto del libro
        for item_id, _ in libro.spine:
            item = libro.get_item_with_id(item_id)
            if item and item.get_type() == ebooklib.ITEM_DOCUMENT:
                parrafos = limpiar_html_ingles(item.get_content(), mapa_imgs)
                texto_completo = "\n".join(parrafos)

                # Filtrar páginas de créditos, índices vacíos o portadillas
                if len(texto_completo) >= min_caracteres or any(p.startswith('[img: ') for p in parrafos):
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