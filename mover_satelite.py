import os
import re
import sys
import json
import shutil
import subprocess
from datetime import datetime

BASE_REPOS_DEFAULT = r"C:\Users\canod\NovelaTrad_Repos"
RUTA_REPOS_CFG = "repos_externos.json"
RUTA_OUTPUT_NOVELAS = os.path.join("output", "novelas")


def cargar_cfg():
    if not os.path.exists(RUTA_REPOS_CFG):
        raise FileNotFoundError(f"No existe {RUTA_REPOS_CFG}")
    with open(RUTA_REPOS_CFG, "r", encoding="utf-8") as f:
        return json.load(f)


def guardar_cfg(cfg):
    with open(RUTA_REPOS_CFG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def detectar_ext_portada(carpeta_vol):
    for ext in ("jpg", "jpeg", "png", "webp"):
        if os.path.exists(os.path.join(carpeta_vol, f"portada.{ext}")):
            return ext
    return "jpg"


def recolectar_metadatos_novela(slug, carpeta_novela_src):
    biblia_path = os.path.join(carpeta_novela_src, "biblia_v1.json")
    titulo_es = slug
    titulo_original = slug
    sinopsis = "Sinopsis no disponible."
    tono = ""

    if os.path.exists(biblia_path):
        with open(biblia_path, "r", encoding="utf-8") as fb:
            biblia = json.load(fb)
        titulo_es = biblia.get("titulo_es") or titulo_es
        titulo_original = biblia.get("titulo_original") or titulo_es
        sinopsis = biblia.get("resumen_trama") or sinopsis
        tono = biblia.get("tono_narrativo") or ""

    volumenes = []
    ultima_act = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for entry in sorted(os.listdir(carpeta_novela_src)):
        if not re.match(r"^vol-\d+$", entry):
            continue
        carpeta_vol = os.path.join(carpeta_novela_src, entry)
        if not os.path.isdir(carpeta_vol):
            continue
        num_vol = int(entry.replace("vol-", ""))
        ext_portada = detectar_ext_portada(carpeta_vol)
        total_caps = 0
        indice_path = os.path.join(carpeta_vol, "indice.json")
        if os.path.exists(indice_path):
            with open(indice_path, "r", encoding="utf-8") as fi:
                idx_data = json.load(fi)
            total_caps = len(idx_data.get("capitulos") or [])

        volumenes.append({
            "clave": entry,
            "numero": num_vol,
            "total_capitulos": total_caps,
            "ext_portada": ext_portada,
            "fecha_subida": ultima_act,
        })

    return {
        "slug": slug,
        "titulo_es": titulo_es,
        "titulo_original": titulo_original,
        "sinopsis": sinopsis,
        "tono": tono,
        "ultima_actualizacion": ultima_act,
        "volumenes": volumenes,
    }


def git_push_repo(dir_repo, mensaje):
    subprocess.run(["git", "add", "."], cwd=dir_repo, check=True)
    status = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=dir_repo,
        capture_output=True,
        text=True,
        check=True,
    )
    if not status.stdout.strip():
        print(f"[GIT] Sin cambios nuevos en {dir_repo}.")
        return
    subprocess.run(["git", "commit", "-m", mensaje], cwd=dir_repo, check=True)
    subprocess.run(["git", "push"], cwd=dir_repo, check=True)
    print(f"[GIT] Push completado en {dir_repo}.")


def mover_novela(slug, repo_destino, eliminar_local=True, hacer_push=True, base_repos=BASE_REPOS_DEFAULT):
    origen = os.path.join(RUTA_OUTPUT_NOVELAS, slug)
    if not os.path.isdir(origen):
        disponibles = [d for d in sorted(os.listdir(RUTA_OUTPUT_NOVELAS)) if os.path.isdir(os.path.join(RUTA_OUTPUT_NOVELAS, d))] if os.path.exists(RUTA_OUTPUT_NOVELAS) else []
        raise FileNotFoundError(f"No se encontró '{origen}'. Novelas en output/novelas: {disponibles}")

    cfg = cargar_cfg()
    repo_obj = next((r for r in cfg.get("repos", []) if r.get("nombre") == repo_destino), None)
    if not repo_obj:
        raise ValueError(f"El repo '{repo_destino}' no está configurado en {RUTA_REPOS_CFG}.")

    dir_repo = os.path.join(base_repos, repo_destino)
    destino_novela = os.path.join(dir_repo, "novelas", slug)
    os.makedirs(os.path.dirname(destino_novela), exist_ok=True)

    if os.path.exists(destino_novela):
        shutil.rmtree(destino_novela)
    shutil.copytree(origen, destino_novela)
    print(f"[COPIADO] {origen} -> {destino_novela}")

    meta = recolectar_metadatos_novela(slug, origen)
    repo_obj["novelas"] = [n for n in repo_obj.get("novelas", []) if n.get("slug") != slug]
    repo_obj["novelas"].append(meta)
    guardar_cfg(cfg)
    print(f"[CFG] Registrado '{slug}' en '{repo_destino}' dentro de {RUTA_REPOS_CFG}.")

    if eliminar_local:
        shutil.rmtree(origen)
        print(f"[LIMPIEZA] Eliminada carpeta local {origen} para liberar espacio en repo principal.")

    subprocess.run([sys.executable, "generar_catalogo.py"], check=True)

    if hacer_push:
        git_push_repo(dir_repo, f"agregar/actualizar novela {slug}")
        git_push_repo(".", f"v30: mover {slug} a {repo_destino}")


def obtener_novelas_locales():
    if not os.path.exists(RUTA_OUTPUT_NOVELAS):
        return []
    return [
        d for d in sorted(os.listdir(RUTA_OUTPUT_NOVELAS))
        if os.path.isdir(os.path.join(RUTA_OUTPUT_NOVELAS, d))
    ]


def listar_novelas_locales():
    novelas = obtener_novelas_locales()
    if not novelas:
        print("No hay novelas en output/novelas.")
        return
    print("Novelas locales disponibles:")
    for idx, d in enumerate(novelas, start=1):
        print(f"  [{idx}] {d}")


def resolver_slug_novela(entrada: str) -> str:
    novelas = obtener_novelas_locales()
    if not novelas:
        raise FileNotFoundError("No hay novelas en output/novelas.")
    limpio = entrada.strip().strip("<>").strip()
    if limpio.isdigit():
        num = int(limpio)
        if 1 <= num <= len(novelas):
            return novelas[num - 1]
        raise IndexError(f"Índice {num} fuera de rango (1..{len(novelas)}).")
    if limpio in novelas:
        return limpio
    coincidencias = [n for n in novelas if limpio.lower() in n.lower()]
    if len(coincidencias) == 1:
        return coincidencias[0]
    if len(coincidencias) > 1:
        raise ValueError(f"Varias novelas coinciden con '{limpio}': {coincidencias}")
    raise FileNotFoundError(f"No se encontró novela para '{limpio}'. Disponibles: {novelas}")


def resolver_repo_destino(entrada: str | None, cfg: dict) -> str:
    repos = [r.get("nombre") for r in cfg.get("repos", []) if r.get("nombre")]
    if not repos:
        raise ValueError(f"No hay repos configurados en {RUTA_REPOS_CFG}.")
    if not entrada:
        return repos[0]
    limpio = entrada.strip().strip("<>").strip()
    if limpio.isdigit():
        num = int(limpio)
        if 1 <= num <= len(repos):
            return repos[num - 1]
        raise IndexError(f"Índice de repo {num} fuera de rango (1..{len(repos)}).")
    if limpio in repos:
        return limpio
    # Permitir escribir "01", "02" o "03" como atajo
    if limpio.zfill(2) in [r[-2:] for r in repos]:
        for r in repos:
            if r.endswith(limpio.zfill(2)):
                return r
    raise ValueError(f"Repo '{limpio}' no encontrado. Disponibles: {repos}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a not in ("--mantener-local", "--sin-push")]
    mantener_local = "--mantener-local" in sys.argv[1:]
    sin_push = "--sin-push" in sys.argv[1:]

    if args and args[0] == "--listar":
        listar_novelas_locales()
        sys.exit(0)

    cfg_actual = cargar_cfg()
    repos_disponibles = [r.get("nombre") for r in cfg_actual.get("repos", []) if r.get("nombre")]

    if not args:
        listar_novelas_locales()
        novelas_disp = obtener_novelas_locales()
        if not novelas_disp:
            sys.exit(0)
        sel_nov = input("\nElige el número de novela a mover: ").strip()
        print("Repos satélite disponibles:")
        for i, rname in enumerate(repos_disponibles, start=1):
            print(f"  [{i}] {rname}")
        sel_repo = input(f"Elige el número de repo [1-{len(repos_disponibles)}] (Enter = 1): ").strip() or "1"
        slug_final = resolver_slug_novela(sel_nov)
        repo_final = resolver_repo_destino(sel_repo, cfg_actual)
    else:
        slug_final = resolver_slug_novela(args[0])
        repo_final = resolver_repo_destino(args[1] if len(args) > 1 else "1", cfg_actual)

    print(f"Seleccionado -> Novela: {slug_final} | Repo: {repo_final}")
    mover_novela(
        slug=slug_final,
        repo_destino=repo_final,
        eliminar_local=not mantener_local,
        hacer_push=not sin_push,
    )
