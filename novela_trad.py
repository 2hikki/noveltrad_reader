import os
import re
import json
import time
import argparse
import hashlib
import unicodedata
from datetime import datetime
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from parser_novela import extraer_capitulos, extraer_portada_epub

# Inicializar cliente directo con GEMINI_API_KEY
API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
if not API_KEY:
    raise RuntimeError("No se detectó GEMINI_API_KEY en la terminal actual.")

client = genai.Client(
    api_key=API_KEY,
    http_options=types.HttpOptions(timeout=90_000)
)

RUTA_REGISTRO = "registro_traducciones.json"
DELAY_ENTRE_LOTES = 3.0

# ==========================================
# 0. BOMBA DE MODELOS (ESTILO TSUKIHIMETRAD)
# ==========================================

MODELOS_CASCADA = [
    "gemini-4-hydrogen",
    "gemini-3.5-flash",
    "gemini-4-argon",
    "gemini-3.5-flash-lite",
    "gemini-4-carbon",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.1-pro-preview",
    "gemini-2.5-flash",
]

MODELOS_DESHABILITADOS = set()


def llamar_gemini_con_respaldo(contents, config: types.GenerateContentConfig) -> tuple[str, str]:
    """
    Recorre la cascada de modelos de forma inmediata ante límites o saturación.
    Descarta permanentemente en la sesión los que den 404 o cuota diaria agotada.
    Devuelve: (texto_respuesta, modelo_usado).
    """
    for ronda in range(2):
        modelos_activos = [m for m in MODELOS_CASCADA if m not in MODELOS_DESHABILITADOS]
        if not modelos_activos:
            raise RuntimeError("Ninguno de los modelos configurados tiene cuota disponible.")

        for modelo_actual in modelos_activos:
            try:
                response = client.models.generate_content(
                    model=modelo_actual,
                    contents=contents,
                    config=config,
                )
                return response.text, modelo_actual

            except Exception as e:
                err_msg = str(e)
                err_lower = err_msg.lower()

                if "401" in err_msg or "unauthenticated" in err_lower:
                    raise RuntimeError("API Key inválida o mal configurada (401). Revisa GEMINI_API_KEY.")

                if "404" in err_msg or "not_found" in err_lower:
                    print(f"    [!] Modelo '{modelo_actual}' no encontrado (404). Saltando...")
                    MODELOS_DESHABILITADOS.add(modelo_actual)
                    continue

                if any(k in err_lower for k in ("perday", "per day", "daily")):
                    print(f"    [!] Cuota diaria alcanzada en '{modelo_actual}'. Saltando...")
                    MODELOS_DESHABILITADOS.add(modelo_actual)
                    continue

                print(f"    [!] Límite/saturación en '{modelo_actual}'. Pasando al siguiente respaldo...")
                continue

        if ronda == 0 and any(m not in MODELOS_DESHABILITADOS for m in MODELOS_CASCADA):
            print("    [⏳] Todos los modelos activos llegaron al límite por minuto. Esperando 15s...")
            time.sleep(15)

    raise RuntimeError("Se agotaron los reintentos de la bomba de modelos.")


# ==========================================
# 1. ESQUEMAS DE DATOS (CONTRATO CON LA WEB)
# ==========================================

class FichaPersonaje(BaseModel):
    nombre: str = Field(description="Nombre exacto tal como aparece en la edición en inglés")
    genero_gramatical: str = Field(description="Masculino o Femenino (obligatorio para concordancia de adjetivos y participios en español)")
    rol_y_edad: str = Field(description="Rol en la historia y edad aproximada")
    registro_habla: str = Field(description="Ej: Formal (usted), Juvenil coloquial (tú), Aristocrático, Frío/cortante")
    tratamiento_con_otros: str = Field(description="A quién trata de 'tú' y a quién de 'usted'. Indicar si conserva honoríficos (-san, -sama, senpai)")
    tics_y_estilo: str = Field(description="Muletillas o forma particular de expresarse")


class TerminoGlosario(BaseModel):
    termino_en: str
    traduccion_es: str
    categoria: str = Field(description="Lugar, Magia/Habilidad, Objeto, Título o Organización")
    nota_contexto: str


class BibliaVolumen(BaseModel):
    titulo_original: str
    titulo_es: str
    tono_narrativo: str = Field(description="Estilo de la prosa: comedia ligera, fantasía oscura, drama introspectivo, etc.")
    resumen_trama: str = Field(description="Resumen global del arco para mantener coherencia y foreshadowing")
    personajes: list[FichaPersonaje]
    glosario: list[TerminoGlosario]


class CapituloTraducido(BaseModel):
    numero: int
    titulo_es: str = Field(description="Título del capítulo traducido de forma natural y literaria")
    parrafos: list[str] = Field(description="Lista exacta de párrafos traducidos al español neutro/literario")
    notas_traductor: list[str] = Field(description="Notas culturales breves opcionales (máximo 2 por capítulo)")


# ==========================================
# 2. UTILIDADES DE CARPETAS Y REGISTRO
# ==========================================

def normalizar_slug(nombre: str) -> str:
    """Elimina cualquier acento/diacrítico (á, à, é, ñ, etc.) y genera un slug limpio."""
    texto_norm = unicodedata.normalize("NFD", nombre.lower().strip())
    texto_sin_acentos = "".join(c for c in texto_norm if unicodedata.category(c) != "Mn")
    slug = re.sub(r'[^a-z0-9-]+', '-', texto_sin_acentos).strip('-')
    return slug or "novela-sin-titulo"


def detectar_numero_volumen(nombre_archivo: str, indice_fallback: int) -> int:
    base = os.path.splitext(nombre_archivo)[0]
    match_explicito = re.search(r'(?:v|vol|volumen|book|tomo)[\s._-]*0*(\d+)', base, re.IGNORECASE)
    if match_explicito:
        return int(match_explicito.group(1))

    match_numero = re.search(r'0*(\d+)', base)
    if match_numero:
        return int(match_numero.group(1))

    return indice_fallback


def calcular_hash_archivo(ruta_archivo: str) -> str:
    sha256 = hashlib.sha256()
    with open(ruta_archivo, "rb") as f:
        for bloque in iter(lambda: f.read(65536), b""):
            sha256.update(bloque)
    return sha256.hexdigest()


def cargar_registro() -> dict:
    if os.path.exists(RUTA_REGISTRO):
        with open(RUTA_REGISTRO, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"novelas": {}}


def guardar_registro(registro: dict):
    with open(RUTA_REGISTRO, "w", encoding="utf-8") as f:
        json.dump(registro, f, ensure_ascii=False, indent=2)


# ==========================================
# 3. FASE 1: PRE-LECTURA Y BIBLIA ACUMULATIVA
# ==========================================

def generar_o_cargar_biblia(capitulos: list[dict], ruta_biblia: str, ruta_biblia_previa: str = None) -> dict:
    if os.path.exists(ruta_biblia):
        print(f"  [FASE 1] Biblia existente encontrada. Cargando...")
        with open(ruta_biblia, "r", encoding="utf-8") as f:
            return json.load(f)

    contexto_previo = ""
    if ruta_biblia_previa and os.path.exists(ruta_biblia_previa):
        print(f"  [FASE 1] Heredando glosario y personajes de {os.path.basename(ruta_biblia_previa)}...")
        with open(ruta_biblia_previa, "r", encoding="utf-8") as f:
            contexto_previo = (
                "BIBLIA DEL VOLUMEN ANTERIOR (OBLIGATORIO: conserva exactamente estos mismos nombres, "
                "géneros gramaticales, tratos tú/usted y términos del glosario; solo agrega los nuevos personajes "
                "y términos que aparezcan en este nuevo volumen):\n"
                f"{f.read()}\n\n"
            )

    print("  [FASE 1] Analizando volumen completo para generar Biblia de Traducción...")
    texto_volumen = ""
    for cap in capitulos:
        parrafos_sin_img = [
            p for p in cap["parrafos"]
            if not (isinstance(p, str) and p.strip().startswith("[img:"))
        ]
        texto_volumen += f"\n--- CAPÍTULO {cap['numero']} ---\n" + "\n".join(parrafos_sin_img)

    prompt_analisis = (
        "Eres un editor jefe y traductor literario experto de inglés a español, especializado en novelas ligeras japonesas. "
        "Lee el siguiente volumen completo en inglés y construye una 'Biblia de Traducción' exhaustiva. "
        "Presta especial atención a deducir el género gramatical exacto de cada personaje (incluso del narrador en primera persona 'I'), "
        "las dinámicas de formalidad (quién trata a quién de 'tú' o 'usted'), y unifica términos de fantasía, títulos y lugares.\n\n"
        f"{contexto_previo}"
        f"TEXTO DEL VOLUMEN:\n{texto_volumen}"
    )

    config_biblia = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=BibliaVolumen,
        temperature=0.2,
    )

    texto_respuesta, modelo_usado = llamar_gemini_con_respaldo(prompt_analisis, config_biblia)
    biblia_dict = json.loads(texto_respuesta)

    with open(ruta_biblia, "w", encoding="utf-8") as f:
        json.dump(biblia_dict, f, ensure_ascii=False, indent=2)

    print(f"  [FASE 1] Biblia guardada en {ruta_biblia} (vía {modelo_usado})")
    return biblia_dict


# ==========================================
# 4. FASE 2: TRADUCCIÓN CONTEXTUALIZADA
# ==========================================

def dividir_en_lotes(parrafos: list[str], max_caracteres: int = 8500) -> list[list[str]]:
    lotes = []
    lote_actual = []
    chars_actuales = 0

    for p in parrafos:
        if chars_actuales + len(p) > max_caracteres and lote_actual:
            lotes.append(lote_actual)
            lote_actual = [p]
            chars_actuales = len(p)
        else:
            lote_actual.append(p)
            chars_actuales += len(p)

    if lote_actual:
        lotes.append(lote_actual)
    return lotes


def restaurar_marcadores_imagen(lote_original: list[str], parrafos_traducidos: list[str]) -> list[str]:
    """Garantiza que ninguna etiqueta [img: ...] original se pierda ni sea alterada."""
    imgs_originales = [
        p.strip() for p in lote_original
        if isinstance(p, str) and p.strip().startswith("[img:")
    ]
    if not imgs_originales:
        return parrafos_traducidos

    limpios = [
        p for p in parrafos_traducidos
        if not (isinstance(p, str) and p.strip().startswith("[img:"))
    ]
    total_orig = max(1, len(lote_original))
    for idx_orig, p in enumerate(lote_original):
        if isinstance(p, str) and p.strip().startswith("[img:"):
            pos_rel = idx_orig / total_orig
            pos_dest = min(len(limpios), round(pos_rel * len(limpios)))
            limpios.insert(pos_dest, p.strip())
    return limpios


def procesar_volumen(
    ruta_archivo: str,
    nombre_carpeta: str,
    slug_novela: str,
    num_volumen: int,
    registro: dict,
    forzar: bool = False,
) -> bool:
    nombre_archivo = os.path.basename(ruta_archivo)
    file_hash = calcular_hash_archivo(ruta_archivo)
    clave_vol = f"vol-{num_volumen:02d}"

    if slug_novela not in registro["novelas"]:
        registro["novelas"][slug_novela] = {
            "carpeta_origen": nombre_carpeta,
            "titulo_es": nombre_carpeta,
            "volumenes": {}
        }

    carpeta_novela_out = os.path.join("output", "novelas", slug_novela)
    carpeta_vol_out = os.path.join(carpeta_novela_out, clave_vol)
    ruta_indice = os.path.join(carpeta_vol_out, "indice.json")

    vol_reg = registro["novelas"][slug_novela]["volumenes"].get(clave_vol)
    if not forzar and vol_reg and vol_reg.get("estado") == "completado" and os.path.exists(ruta_indice):
        if vol_reg.get("hash_sha256") == file_hash:
            print(f"  [OMITIDO] {clave_vol} ('{nombre_archivo}') ya fue traducido.")
            return False

    print(f"\n  >>> TRADUCIENDO: {nombre_carpeta} | {clave_vol} ({nombre_archivo})")
    os.makedirs(carpeta_vol_out, exist_ok=True)
    extraer_portada_epub(ruta_archivo, carpeta_vol_out)

    capitulos = extraer_capitulos(ruta_archivo)
    if not capitulos:
        print(f"  [!] No se extrajeron capítulos válidos de '{nombre_archivo}'.")
        return False
    print(f"  Se extrajeron {len(capitulos)} capítulos/bloques.")

    ruta_biblia = os.path.join(carpeta_novela_out, f"biblia_v{num_volumen}.json")
    ruta_biblia_previa = (
        os.path.join(carpeta_novela_out, f"biblia_v{num_volumen - 1}.json")
        if num_volumen > 1 else None
    )
    biblia = generar_o_cargar_biblia(capitulos, ruta_biblia, ruta_biblia_previa)

    biblia_compacta = {
        "titulo": biblia["titulo_es"],
        "tono": biblia["tono_narrativo"],
        "personajes": [
            f"{p['nombre']} ({p['genero_gramatical']}): {p['registro_habla']} | {p['tratamiento_con_otros']}"
            for p in biblia["personajes"]
        ],
        "glosario": {g["termino_en"]: g["traduccion_es"] for g in biblia["glosario"]}
    }
    biblia_str = json.dumps(biblia_compacta, ensure_ascii=False, separators=(',', ':'))

    registro["novelas"][slug_novela]["titulo_es"] = biblia["titulo_es"]

    instruccion_sistema = (
        "Eres un traductor literario profesional de novelas ligeras del inglés al español. "
        "Reglas estrictas:\n"
        "1. Respeta fielmente los géneros gramaticales, registros de habla (tú/usted) y glosario de la BIBLIA DEL VOLUMEN.\n"
        "2. Evita calcos del inglés (anglicismos sintácticos): omite pronombres sujeto innecesarios (usa sujeto tácito natural en español) y adapta modismos ingleses a español literario fluido.\n"
        "3. Usa raya española (—) para los diálogos e incisos del narrador (ej: —No lo sé —respondió él—. Pero lo averiguaremos).\n"
        "4. Conserva las marcas de cursiva (*texto*) para pensamientos internos y los separadores (* * *).\n"
        "5. Conserva intactos y sin traducir los marcadores de ilustración tipo [img: ...] exactamente como aparecen.\n"
        "6. No resumas ni omitas ninguna línea."
    )

    config_traduccion = types.GenerateContentConfig(
        system_instruction=instruccion_sistema,
        response_mime_type="application/json",
        response_schema=CapituloTraducido,
        temperature=0.4,
    )

    ultimos_parrafos_previos = []
    indice_web = []

    for cap in capitulos:
        num_cap = cap["numero"]
        ruta_cap_salida = os.path.join(carpeta_vol_out, f"cap-{num_cap:02d}.json")

        if not forzar and os.path.exists(ruta_cap_salida):
            try:
                with open(ruta_cap_salida, "r", encoding="utf-8") as f:
                    datos_existentes = json.load(f)
                if isinstance(datos_existentes.get("parrafos"), list) and datos_existentes["parrafos"]:
                    print(f"  [FASE 2] Capítulo {num_cap:02d} ya existe. Saltando...")
                    ultimos_parrafos_previos = datos_existentes["parrafos"][-3:]
                    indice_web.append({
                        "numero": num_cap,
                        "titulo": datos_existentes.get("titulo_es", f"Capítulo {num_cap}"),
                        "archivo": f"cap-{num_cap:02d}.json"
                    })
                    continue
            except Exception:
                print(f"  [!] cap-{num_cap:02d}.json estaba dañado; se regenerará.")

        print(f"  [FASE 2] Traduciendo Capítulo {num_cap:02d} ({len(cap['parrafos'])} párrafos)...")
        lotes = dividir_en_lotes(cap["parrafos"], max_caracteres=8500)
        parrafos_traducidos_cap = []
        notas_cap = []
        titulo_es_cap = ""
        modelo_cap = ""

        for idx_lote, lote in enumerate(lotes):
            contexto_continuidad = (
                "\n".join(ultimos_parrafos_previos)
                if ultimos_parrafos_previos
                else "Inicio del volumen."
            )

            prompt_traduccion = (
                f"BIBLIA DEL VOLUMEN:\n{biblia_str}\n\n"
                f"CONTEXTO INMEDIATO ANTERIOR (solo para continuidad de género, escena y ritmo, NO volver a traducir):\n"
                f"{contexto_continuidad}\n\n"
                f"TEXTO EN INGLÉS A TRADUCIR (Capítulo {num_cap}, Parte {idx_lote + 1}/{len(lotes)}):\n"
                + "\n".join(lote)
            )

            texto_lote, modelo_cap = llamar_gemini_con_respaldo(prompt_traduccion, config_traduccion)
            resultado_lote = json.loads(texto_lote)

            if idx_lote == 0:
                titulo_es_cap = resultado_lote.get("titulo_es") or f"Capítulo {num_cap}"

            parrafos_lote = resultado_lote.get("parrafos") or []
            if not parrafos_lote:
                raise RuntimeError(f"El modelo devolvió 'parrafos' vacío en cap-{num_cap:02d}, lote {idx_lote + 1}.")

            parrafos_lote = restaurar_marcadores_imagen(lote, parrafos_lote)
            parrafos_traducidos_cap.extend(parrafos_lote)
            notas_cap.extend(resultado_lote.get("notas_traductor", []))
            ultimos_parrafos_previos = [p for p in parrafos_lote if not p.startswith("[img:")][-3:]

            time.sleep(DELAY_ENTRE_LOTES)

        datos_capitulo_final = {
            "numero": num_cap,
            "titulo_es": titulo_es_cap,
            "parrafos": parrafos_traducidos_cap,
            "notas_traductor": list(dict.fromkeys(notas_cap))
        }

        with open(ruta_cap_salida, "w", encoding="utf-8") as f:
            json.dump(datos_capitulo_final, f, ensure_ascii=False, indent=2)

        indice_web.append({
            "numero": num_cap,
            "titulo": titulo_es_cap,
            "archivo": f"cap-{num_cap:02d}.json"
        })
        print(f"   -> Guardado: cap-{num_cap:02d}.json (vía {modelo_cap})")

    with open(ruta_indice, "w", encoding="utf-8") as f:
        json.dump({
            "slug": slug_novela,
            "volumen": num_volumen,
            "titulo_novela": biblia["titulo_es"],
            "capitulos": indice_web
        }, f, ensure_ascii=False, indent=2)

    registro["novelas"][slug_novela]["volumenes"][clave_vol] = {
        "archivo_origen": nombre_archivo,
        "hash_sha256": file_hash,
        "total_capitulos": len(indice_web),
        "estado": "completado",
        "fecha_completado": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    guardar_registro(registro)
    print(f"  [COMPLETADO] {nombre_carpeta} -> {clave_vol} listo.\n")
    return True


def pedir_novelas_por_numero(candidatas: list[tuple[str, str, list[str]]]) -> list[tuple[str, str, list[str]]]:
    print("\n=== Novelas detectadas para traducir ===")
    print("  [0] Todas las novelas listadas")
    for idx, (nombre_carpeta, slug_novela, archivos) in enumerate(candidatas, start=1):
        print(f"  [{idx}] {nombre_carpeta} ({len(archivos)} archivo(s) | slug: {slug_novela})")

    while True:
        eleccion = input(f"\nElige el número de novela [0-{len(candidatas)}]: ").strip()
        if eleccion.isdigit():
            num = int(eleccion)
            if num == 0:
                return candidatas
            if 1 <= num <= len(candidatas):
                return [candidatas[num - 1]]
        print("Opción no válida. Escribe uno de los números listados.")


def escanear_biblioteca_input(
    carpeta_input: str = "input",
    filtro_slug: str = None,
    forzar: bool = False,
    traducir_todas: bool = False,
):
    if not os.path.exists(carpeta_input):
        os.makedirs(carpeta_input)
        print(f"Carpeta '{carpeta_input}/' creada. Crea una subcarpeta con el nombre de cada novela dentro.")
        return

    subcarpetas = [
        d for d in sorted(os.listdir(carpeta_input))
        if os.path.isdir(os.path.join(carpeta_input, d))
    ]

    if not subcarpetas:
        print(f"No hay carpetas de novelas dentro de '{carpeta_input}/'. Ejemplo: {carpeta_input}/Mi Novela/vol1.epub")
        return

    candidatas = []
    for nombre_carpeta in subcarpetas:
        ruta_novela = os.path.join(carpeta_input, nombre_carpeta)
        slug_novela = normalizar_slug(nombre_carpeta)
        if filtro_slug and filtro_slug != slug_novela:
            continue
        archivos = [
            f for f in sorted(os.listdir(ruta_novela))
            if f.lower().endswith((".epub", ".txt"))
        ]
        if archivos:
            candidatas.append((nombre_carpeta, slug_novela, archivos))

    if not candidatas:
        print("No se encontraron novelas con archivos .epub o .txt que coincidan.")
        return

    if len(candidatas) > 1 and not filtro_slug and not traducir_todas:
        seleccionadas = pedir_novelas_por_numero(candidatas)
    else:
        seleccionadas = candidatas

    registro = cargar_registro()
    novelas_procesadas = []

    for nombre_carpeta, slug_novela, archivos in seleccionadas:
        ruta_novela = os.path.join(carpeta_input, nombre_carpeta)
        print(f"\n=== Revisando novela: '{nombre_carpeta}' (slug: {slug_novela}) ===")
        hubo_cambios = False
        for idx, archivo in enumerate(archivos, start=1):
            num_vol = detectar_numero_volumen(archivo, idx)
            ruta_archivo = os.path.join(ruta_novela, archivo)
            if procesar_volumen(ruta_archivo, nombre_carpeta, slug_novela, num_vol, registro, forzar=forzar):
                hubo_cambios = True
        if hubo_cambios:
            novelas_procesadas.append(slug_novela)

    if novelas_procesadas:
        print("=== Siguiente paso sugerido ===")
        for sl in novelas_procesadas:
            print(f"  python ingresar_novela_repo.py --slug \"{sl}\"")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Traduce novelas desde input/ generando biblia y JSONs para la web.")
    parser.add_argument("--input-dir", default="input", help="Carpeta de entrada (por defecto: input)")
    parser.add_argument("--slug", default=None, help="Procesar únicamente la novela cuyo slug coincida")
    parser.add_argument("--forzar", action="store_true", help="Reprocesar volúmenes/capítulos aunque ya figuren completados")
    parser.add_argument("--all", action="store_true", help="Traducir todas las novelas detectadas sin pedir selección")
    args = parser.parse_args()

    escanear_biblioteca_input(
        carpeta_input=args.input_dir,
        filtro_slug=args.slug,
        forzar=args.forzar,
        traducir_todas=args.all,
    )
