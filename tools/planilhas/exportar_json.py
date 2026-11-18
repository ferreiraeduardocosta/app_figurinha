"""Exporta a planilha de fichas para data/temporada1/*.json (seed do banco).

Uso, a partir da raiz do repositório:
    python3 -I tools/planilhas/exportar_json.py
"""
import json
import math
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[2]
PLANILHA = RAIZ / "docs/planilhas/Craques_da_Varzea_Fichas_T1.xlsx"
DESTINO = RAIZ / "data/temporada1"

RARIDADE = {"Comum": "COMUM", "Rara": "RARA", "Épica": "EPICA", "Lendária": "LENDARIA"}
TIPO = {"Escudo": "ESCUDO", "Estádio": "ESTADIO", "Técnico": "TECNICO", "Jogador": "JOGADOR",
        "Mascote": "MASCOTE", "Lenda": "LENDA", "Momento": "MOMENTO"}


def limpo(v):
    if isinstance(v, float) and math.isnan(v):
        return None
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def main():
    abas = pd.read_excel(PLANILHA, sheet_name=None)
    clubes = [{
        "sigla": r["Sigla"], "nome": r["Clube"], "cidade": r["Cidade"], "inspiracao": r["Inspiração"],
        "cores": [r["Cor 1 (hex)"], r["Cor 2 (hex)"]], "estadio": r["Estádio"],
        "capacidade": int(r["Capacidade"]), "mascote": r["Mascote"], "rival": r["Rival"],
        "classico": r["Clássico"], "lema": r["Lema da torcida"], "identidade": r["Identidade"],
        "tecnico": r["Técnico"],
    } for _, r in abas["Clubes"].iterrows()]
    sigla = {c["nome"]: c["sigla"] for c in clubes}

    figurinhas = []
    for _, r in abas["Figurinhas"].iterrows():
        f = {
            "numero": int(r["Nº"]), "codigo": r["Código"], "secao": r["Seção"],
            "clube": sigla[r["Clube"]], "tipo": TIPO[r["Tipo"]], "nome": r["Nome"],
            "apelido": limpo(r["Apelido"]), "posicao": limpo(r["Posição"]),
            "camisa": limpo(r["Camisa"]), "idade": limpo(r["Idade"]),
            "raridade": RARIDADE[r["Raridade"]], "destaque": limpo(r["Traço especial / destaque"]),
            "historia": r["Mini-história"], "descricaoVisual": r["Descrição visual (briefing de arte)"],
        }
        if not pd.isna(r["ATA"]):
            f["atributos"] = {k.lower(): int(r[k]) for k in ["ATA", "DEF", "TEC", "VEL", "FIS"]}
        figurinhas.append(f)

    DESTINO.mkdir(parents=True, exist_ok=True)
    (DESTINO / "clubes.json").write_text(json.dumps(clubes, ensure_ascii=False, indent=2))
    (DESTINO / "figurinhas.json").write_text(json.dumps(figurinhas, ensure_ascii=False, indent=2))
    print(f"{len(clubes)} clubes, {len(figurinhas)} figurinhas exportados para {DESTINO}")


if __name__ == "__main__":
    main()
