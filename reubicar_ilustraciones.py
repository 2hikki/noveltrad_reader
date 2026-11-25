import argparse
import glob
import json
import os
import re
import xml.etree.ElementTree as ET
import zipfile

IMG_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif")
CARPETAS_ENTRADA = ["input", "input_es"]


def tokenizar_slug(slug: str) -> list[str]:
    partes = [p for p in re.split(r"[^a-zA-Z0-9]+", slug.lower()) if len(p) >= 4]
    stop = {"para", "con", "por", "del", "las", "los", "una", "uno", "the", "and", "from", "with"}
    return [p for p in partes if p not in stop]


def buscar_epubs_coincidentes(slug: str, carpeta_satelite: str) -> list[str]:
    tokens = tokenizar_slug(slug)
    nov_dir = os.path.join(carpeta_satelite, "novelas", slug)
    if os.path.isdir(nov_dir):
        for p in tokenizar_slug(os.path.basename(nov_dir)):
            if p not in tokens:
                tokens.append(p)

    encontrados = []
    for base in CARPETAS_ENTRADA:
        if not os.path.isdir(base):
            continue
        for epub in sorted(glob.glob(os.path.join(base, "**", "*.epub"), recursive=True)):
            nombre = epub.lower()
            coincidencias = sum(1 for t in tokens if t in nombre)
            if coincidencias >= 2 or any(len(t) >= 7 and t in nombre for t in tokens):
                encontrados.append(epub)
    return encontrados


def extraer_orden_epub(epub_path: str) -> list[str]:
    orden = []
    vistos = set()
    with zipfile.ZipFile(epub_path, "r") as zf:
        names = zf.namelist()
        opf_path = next((n for n in names if n.lower().endswith(".opf")), None)
        docs = []

        if opf_path:
            opf_dir = os.path.dirname(opf_path)
            opf_root = ET.fromstring(zf.read(opf_path))
            ns = {"opf": "http://www.idpf.org/2007/opf"}
            manifest = {}
            for item in opf_root.findall(".//opf:manifest/opf:item", ns) or opf_root.findall(".//{*}manifest/{*}item"):
                iid = item.attrib.get("id")
                href = item.attrib.get("href")
                if iid and href:
                    manifest[iid] = os.path.normpath(os.path.join(opf_dir, href)).replace("\\", "/")
            for itemref in opf_root.findall(".//opf:spine/opf:itemref", ns) or opf_root.findall(".//{*}spine/{*}itemref"):
                idref = itemref.attrib.get("idref")
                if idref in manifest:
                    docs.append(manifest[idref])

        if not docs:
            docs = sorted([n for n in names if n.lower().endswith((".xhtml", ".html", ".htm"))])

        patron_img = re.compile(r"""(?:src|xlink:href)\s*=\s*["']([^"']+)["']""", re.IGNORECASE)
        for doc in docs:
            if doc not in names:
                continue
            try:
                html = zf.read(doc).decode("utf-8", errors="ignore")
            except Exception:
                continue
            for m in patron_img.finditer(html):
                ref = m.group(1).split("#")[0].strip()
                base = os.path.basename(ref)
                if base.lower().endswith(IMG_EXTS) and base not in vistos:
                    vistos.add(base)
                    orden.append(base)
    return orden


def ordenar_imagenes_volumen(imgs_dir: str, epub_path: str | None) -> tuple[list[str], int]:
    reales = sorted([
        f for f in os.listdir(imgs_dir)
        if os.path.isfile(os.path.join(imgs_dir, f)) and f.lower().endswith(IMG_EXTS)
    ])
    if not epub_path or not os.path.isfile(epub_path):
        return reales, 0

    orden_epub = extraer_orden_epub(epub_path)
    reales_set = set(reales)
    resultado = []
    usados = set()

    for nombre in orden_epub:
        if nombre in reales_set and nombre not in usados:
            resultado.append(nombre)
            usados.add(nombre)

    for nombre in orden_epub:
        m1 = re.search(r"(\d+)", os.path.splitext(nombre)[0])
        if not m1:
            continue
        num1 = int(m1.group(1))
        for cand in sorted(reales_set - usados):
            m2 = re.search(r"(\d+)", os.path.splitext(cand)[0])
            if m2 and int(m2.group(1)) == num1:
                resultado.append(cand)
                usados.add(cand)
                break

    for resto in sorted(reales_set - usados):
        resultado.append(resto)

    return resultado, len(orden_epub)


def main():
    parser = argparse.ArgumentParser(description="Reubica etiquetas [img:] según EPUBs propios de la novela.")
    parser.add_argument("--slug", required=True, help="Slug de la novela")
    parser.add_argument(
        "--base-dir",
        default=r"C:\Users\canod\NovelaTrad_Repos\noveltrad-data-01",
        help="Ruta del repo satélite o carpeta raíz que contiene /novelas/<slug>"
    )
    args = parser.parse_args()

    nov_dir = os.path.join(args.base_dir, "novelas", args.slug)
    if not os.path.isdir(nov_dir):
        raise SystemExit(f"No existe la carpeta de novela: {nov_dir}")

    epubs = buscar_epubs_coincidentes(args.slug, args.base_dir)
    print(f"EPUBs coincidentes en input/ e input_es/ para '{args.slug}': {len(epubs)}")
    for ep in epubs:
        print("  -", ep)

    total_insertadas = 0
    for vol_dir in sorted(glob.glob(os.path.join(nov_dir, "vol-*"))):
        vol_name = os.path.basename(vol_dir)
        m_vol = re.search(r"(\d+)$", vol_name)
        num_vol = int(m_vol.group(1)) if m_vol else 0

        imgs_dir = os.path.join(vol_dir, "ilustraciones")
        if not os.path.isdir(imgs_dir):
            continue

        epub_match = None
        for ep in epubs:
            b = os.path.basename(ep).lower()
            if re.search(rf"(?:vol(?:umen)?[\s_-]*0*{num_vol}\b|\bv0*{num_vol}\b)", b):
                epub_match = ep
                break

        imgs_ord, n_refs = ordenar_imagenes_volumen(imgs_dir, epub_match)
        caps = sorted(
            glob.glob(os.path.join(vol_dir, "cap-*.json")),
            key=lambda p: int(re.search(r"cap-(\d+)\.json$", os.path.basename(p)).group(1))
            if re.search(r"cap-(\d+)\.json$", os.path.basename(p)) else 0
        )

        if not imgs_ord or not caps:
            continue

        caps_data = []
        for cp in caps:
            with open(cp, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get("parrafos"), list):
                data["parrafos"] = [
                    p for p in data["parrafos"]
                    if not (isinstance(p, str) and p.strip().startswith("[img:"))
                ]
            caps_data.append((cp, data))

        num_caps = len(caps_data)
        asignaciones = {i: [] for i in range(num_caps)}
        for idx, img_name in enumerate(imgs_ord):
            cap_idx = min(num_caps - 1, (idx * num_caps) // len(imgs_ord))
            asignaciones[cap_idx].append(f"[img: ilustraciones/{img_name}]")

        for cap_idx, (cp, data) in enumerate(caps_data):
            if isinstance(data, dict) and isinstance(data.get("parrafos"), list):
                tags = asignaciones[cap_idx]
                if tags:
                    pos = max(1, min(len(data["parrafos"]), int(len(data["parrafos"]) * 0.6)))
                    for offset, tag in enumerate(tags):
                        data["parrafos"].insert(pos + offset, tag)
                        total_insertadas += 1

        for cp, data in caps_data:
            with open(cp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

        fuente = os.path.basename(epub_match) if epub_match else "sin EPUB propio (orden natural)"
        print(f"[{vol_name}] Fuente={fuente} ({n_refs} refs) -> {len(imgs_ord)} imgs en {num_caps} caps.")

    print(f"Total etiquetas [img: ...] ubicadas: {total_insertadas}")


if __name__ == "__main__":
    main()
