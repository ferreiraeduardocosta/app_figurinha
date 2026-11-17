"""Gera docs/arte/prompts.csv: um prompt de imagem por figurinha que precisa de retrato.

Uso, a partir da raiz do repositório:
    python3 -I tools/planilhas/gerar_prompts_arte.py
"""
import csv
import json
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[2]
figurinhas = json.loads((RAIZ / "data/temporada1/figurinhas.json").read_text())
clubes = {c["sigla"]: c for c in json.loads((RAIZ / "data/temporada1/clubes.json").read_text())}
# Nomes das cores ("Azul-marinho e branco"): geradores de imagem entendem melhor que códigos hex.
nomes_cores = {
    r["Sigla"]: str(r["Cores"]).lower()
    for _, r in pd.read_excel(RAIZ / "docs/planilhas/Liga_Aurora_Fichas_T1.xlsx", sheet_name="Clubes").iterrows()
}

ESTILO = (
    "Ilustração de figurinha colecionável, estilo cartoon semi-realista com traço limpo e cores chapadas, "
    "iluminação suave de estúdio, busto enquadrado do peito para cima, olhando para a frente, fundo transparente"
)
NEGATIVO = (
    "pessoa real, celebridade, jogador de futebol real, logotipo de marca real, escudo de clube real, texto, "
    "marca d'água, fotorrealismo, corpo inteiro, mãos deformadas"
)
ENQUADRAMENTO = {
    "JOGADOR": "jogador de futebol fictício vestindo camisa {cores}",
    "LENDA": "ídolo aposentado fictício do futebol, visual retrô, camisa antiga {cores}",
    "TECNICO": "técnico de futebol fictício à beira do campo, roupa de treinador nas cores {cores}",
    "MASCOTE": "mascote de time de futebol fictício, personagem simpático, roupa nas cores {cores}",
    "ESTADIO": "estádio de futebol fictício visto de fora, sem pessoas, cores do clube {cores}",
    "MOMENTO": "cena dramática de um lance histórico de futebol fictício, cores do clube {cores}",
}

linhas = []
for f in figurinhas:
    if f["tipo"] == "ESCUDO":
        continue  # escudos já existem em vetor
    clube = clubes[f["clube"]]
    cores = nomes_cores[f["clube"]]
    assunto = ENQUADRAMENTO[f["tipo"]].format(cores=cores)
    prompt = f"{ESTILO}. {assunto}. {f['descricaoVisual']}"
    if f["tipo"] in ("ESTADIO", "MOMENTO"):
        prompt = prompt.replace("busto enquadrado do peito para cima, olhando para a frente, fundo transparente", "enquadramento horizontal")
    linhas.append({
        "arquivo": f"{f['codigo']}.png",
        "codigo": f["codigo"],
        "tipo": f["tipo"],
        "nome": f["apelido"] or f["nome"],
        "prompt": prompt,
        "negativo": NEGATIVO,
    })

destino = RAIZ / "docs/arte/prompts.csv"
with destino.open("w", newline="", encoding="utf-8") as saida:
    w = csv.DictWriter(saida, fieldnames=list(linhas[0].keys()))
    w.writeheader()
    w.writerows(linhas)
print(f"{len(linhas)} prompts em {destino}")
