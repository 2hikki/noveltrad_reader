import json

RUTA = "output/catalogo.json"

with open(RUTA, "r", encoding="utf-8") as f:
    data = json.load(f)

novelas = data.get("novelas", [])

while True:
    print("\n=== CATÁLOGO ACTUAL ===")
    for i, n in enumerate(novelas, 1):
        tags = ", ".join(n.get("etiquetas", [])) or f"(usando tono: {n.get('tono', 'Ninguno')})"
        print(f"{i}. {n['titulo_es']} -> [{tags}]")
    print("0. Guardar y salir")

    op = input("\nElige el número de novela a etiquetar: ").strip()
    if op == "0":
        break
    if not op.isdigit() or not (1 <= int(op) <= len(novelas)):
        print("Opción no válida.")
        continue

    nov = novelas[int(op) - 1]
    print(f"\nEditando: {nov['titulo_es']}")
    entrada = input("Escribe las etiquetas separadas por coma (ej. Fantasía, Drama, Isekai): ").strip()
    if entrada:
        nov["etiquetas"] = [t.strip() for t in entrada.split(",") if t.strip()]
        print(f"Etiquetas actualizadas: {nov['etiquetas']}")

with open(RUTA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("\n¡Guardado en output/catalogo.json!")