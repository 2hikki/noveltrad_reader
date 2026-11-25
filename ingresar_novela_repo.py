import argparse
import json
import os
import shutil
import subprocess
import sys

REPOS_BASE_DEFAULT = r"C:\Users\canod\NovelaTrad_Repos"
SATELITES_POR_DEFECTO = [
    "noveltrad-data-01",
    "noveltrad-data-02",
    "noveltrad-data-03",
]


def cargar_opciones_repos(repos_base: str) -> list[dict]:
    opciones = [
        {
            "id": "local",
            "nombre": "NovelaTrad (local / repo principal en output/novelas)",
            "ruta": os.path.join(os.getcwd(), "output", "novelas"),
        }
    ]

    satelites = list(SATELITES_POR_DEFECTO)
    if os.path.isfile("repos_externos.json"):
        try:
            with open("repos_externos.json", "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, str) and item not in satelites:
                        satelites.append(item)
                    elif isinstance(item, dict):
                        repo_name = item.get("repo") or item.get("nombre")
                        if repo_name and repo_name not in satelites:
                            satelites.append(repo_name)
        except Exception:
            pass

    for sat in satelites:
        opciones.append(
            {
                "id": sat,
                "nombre": f"{sat} (repositorio satélite en {repos_base})",
                "ruta": os.path.join(repos_base, sat, "novelas"),
            }
        )

    return opciones


def pedir_repo_por_numero(opciones: list[dict]) -> dict:
    print("\n=== Selecciona en qué repositorio quieres guardar/enviar la novela ===")
    for idx, op in enumerate(opciones):
        existe = os.path.isdir(op["ruta"]) or (op["id"] != "local" and os.path.isdir(os.path.dirname(op["ruta"])))
        estado = "OK" if existe else "carpeta nueva"
        print(f"  [{idx}] {op['nombre']} ({estado})")

    while True:
        eleccion = input(f"\nIngresa el número [0-{len(opciones) - 1}]: ").strip()
        if eleccion.isdigit():
            num = int(eleccion)
            if 0 <= num < len(opciones):
                return opciones[num]
        print("Opción no válida. Escribe solo uno de los números listados.")


def listar_novelas_locales() -> list[str]:
    base = os.path.join("output", "novelas")
    if not os.path.isdir(base):
        return []
    return sorted([d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))])


def main():
    parser = argparse.ArgumentParser(description="Selector numérico de repositorio al ingresar/mover una novela.")
    parser.add_argument("--slug", help="Slug de la novela en output/novelas")
    parser.add_argument("--repos-base", default=REPOS_BASE_DEFAULT, help="Carpeta base de repositorios satélite")
    parser.add_argument("--no-push", action="store_true", help="No ejecutar git push automáticamente")
    args = parser.parse_args()

    novelas = listar_novelas_locales()
    slug = args.slug
    if not slug:
        if not novelas:
            print("No hay novelas en output/novelas todavía.")
            return
        print("=== Novelas disponibles en output/novelas ===")
        for i, n in enumerate(novelas):
            print(f"  [{i}] {n}")
        while True:
            sel = input(f"\nElige el número de novela [0-{len(novelas) - 1}]: ").strip()
            if sel.isdigit() and 0 <= int(sel) < len(novelas):
                slug = novelas[int(sel)]
                break
            print("Número inválido, intenta de nuevo.")

    origen = os.path.join("output", "novelas", slug)
    if not os.path.isdir(origen):
        raise SystemExit(f"No existe la carpeta de novela: {origen}")

    opciones = cargar_opciones_repos(args.repos_base)
    destino_op = pedir_repo_por_numero(opciones)
    print(f"\nElegiste: [{destino_op['id']}] -> {destino_op['nombre']}")

    if destino_op["id"] == "local":
        print("La novela permanece en output/novelas (repo principal).")
    else:
        if os.path.isfile("mover_satelite.py"):
            cmd = [sys.executable, "mover_satelite.py", "--slug", slug, "--repo", destino_op["id"]]
            res = subprocess.run(cmd, text=True)
            if res.returncode != 0:
                os.makedirs(destino_op["ruta"], exist_ok=True)
                shutil.move(origen, os.path.join(destino_op["ruta"], slug))
        else:
            os.makedirs(destino_op["ruta"], exist_ok=True)
            shutil.move(origen, os.path.join(destino_op["ruta"], slug))

        ext_path = "repos_externos.json"
        actual = []
        if os.path.isfile(ext_path):
            try:
                with open(ext_path, "r", encoding="utf-8") as f:
                    actual = json.load(f)
            except Exception:
                actual = []
        if not isinstance(actual, list):
            actual = []
        if destino_op["id"] not in actual:
            actual.append(destino_op["id"])
        with open(ext_path, "w", encoding="utf-8") as f:
            json.dump(actual, f, ensure_ascii=False, indent=2)

        if not args.no_push:
            repo_dir = os.path.dirname(destino_op["ruta"])
            if os.path.isdir(os.path.join(repo_dir, ".git")):
                subprocess.run(["git", "add", "."], cwd=repo_dir, check=False)
                subprocess.run(["git", "commit", "-m", f"agregar novela {slug} a {destino_op['id']}"], cwd=repo_dir, check=False)
                subprocess.run(["git", "push"], cwd=repo_dir, check=False)

    if os.path.isfile("generar_catalogo.py"):
        subprocess.run([sys.executable, "generar_catalogo.py"], check=False)

    print("\nProceso terminado.")


if __name__ == "__main__":
    main()
