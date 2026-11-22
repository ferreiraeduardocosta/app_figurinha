"""Gera a Temporada 2 (Inter Classes): data/temporada2/*.json e a planilha de fichas.

Uso, a partir da raiz do repositório:
    python3 -I tools/planilhas/temporada2/gerar_t2.py
Precisa de openpyxl. Atributos com semente fixa (mesmas regras da T1).
"""
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dados_t2 import ESCOLA, LENDAS, MOMENTOS, TURMAS  # noqa: E402

RAIZ = Path(__file__).resolve().parents[3]
DESTINO = RAIZ / "data/temporada2"
PLANILHA = RAIZ / "docs/planilhas/Inter_Classes_Fichas_T2.xlsx"
TEMPORADA = 2
PREFIXO = f"T{TEMPORADA}-"

random.seed(2027)
BASE = {
    "GOL": (25, 62, 45, 45, 60), "ZAG": (35, 64, 45, 50, 64), "LAT": (45, 56, 52, 62, 56),
    "VOL": (45, 62, 54, 52, 60), "MEI": (55, 45, 64, 54, 50), "PON": (60, 35, 60, 66, 48),
    "ATA": (66, 30, 55, 58, 60),
}
BONUS = {"Comum": 0, "Rara": 9, "Épica": 17, "Lendária": 21}
TRACO = {
    "Velocidade": {3: 8}, "Força": {4: 8, 1: 3}, "Muralha": {1: 8, 4: 4}, "Drible": {2: 6, 3: 2},
    "Artilheiro": {0: 7}, "Finalização": {0: 7}, "Visão de jogo": {2: 6}, "Passe curto": {2: 5},
    "Passe longo": {2: 6}, "Passe de trivela": {2: 7}, "Jogo aéreo": {4: 5, 1: 2}, "Desarme": {1: 5},
    "Antecipação": {1: 5, 2: 2}, "Fôlego": {4: 5, 3: 3}, "Reflexo": {1: 5}, "Saída de gol": {1: 4, 3: 2},
    "Cruzamento": {2: 4}, "Liderança": {1: 3, 4: 3}, "Chute de longa distância": {0: 6, 2: 2},
    "Arrancada": {3: 6, 2: 3}, "Carrinho": {1: 5}, "Promessa": {2: 4}, "Chute cruzado": {0: 5},
    "Pivô": {4: 6, 0: 2},
}
RARIDADE = {"Comum": "COMUM", "Rara": "RARA", "Épica": "EPICA", "Lendária": "LENDARIA"}


def atributos(pos, rar, traco):
    v = [b + BONUS[rar] + random.randint(-4, 4) for b in BASE[pos]]
    for i, d in TRACO.get(traco, {}).items():
        v[i] += d
    v = [max(30, min(99, x)) for x in v]
    return dict(zip(["ata", "def", "tec", "vel", "fis"], v))


def figurinha(numero, codigo, secao, clube, tipo, nome, raridade, historia, visual, **extra):
    f = {
        "numero": numero, "codigo": PREFIXO + codigo, "secao": secao, "clube": clube, "tipo": tipo,
        "nome": nome, "apelido": None, "posicao": None, "camisa": None, "idade": None,
        "raridade": raridade, "destaque": None, "historia": historia, "descricaoVisual": visual,
    }
    f.update(extra)
    return f


def main():
    clubes, figurinhas = [], []
    n = 0
    for t in TURMAS:
        s = t["sigla"]
        clubes.append({
            "sigla": s, "nome": t["nome"], "cidade": f"{ESCOLA} · {t['turma']}", "inspiracao": "Inter Classes",
            "cores": [f"#{t['hex1']}", f"#{t['hex2']}"], "nomeCores": t["cores"].lower(),
            "estadio": t["qg"], "capacidade": t["cap"], "mascote": f"{t['mascote'][0]}, {t['mascote'][1].lower()}",
            "rival": t["rival"], "classico": t["classico"], "lema": t["lema"], "identidade": t["ident"],
            "tecnico": t["tecnico"][0],
        })
        n += 1
        figurinhas.append(figurinha(n, f"{s}-01", t["nome"], s, "ESCUDO", f"Escudo do {t['nome']}", "COMUM",
                                    t["ident"], t["escudo_vis"], destaque=f"Lema: {t['lema']}"))
        n += 1
        figurinhas.append(figurinha(n, f"{s}-02", t["nome"], s, "ESTADIO", t["qg"], "COMUM",
                                    f"QG do {t['nome']} no {ESCOLA}. Mascote: {t['mascote'][0]}.", t["qg_vis"],
                                    destaque=f"Capacidade: {t['cap']}"))
        tn, tap, ti, test, th, tv = t["tecnico"]
        n += 1
        figurinhas.append(figurinha(n, f"{s}-03", t["nome"], s, "TECNICO", tn, "COMUM", th, tv,
                                    apelido=tap, posicao="TEC", idade=ti, destaque=test))
        for i, (pos, cam, nome, ap, idade, rar, traco, hist, vis) in enumerate(t["jogadores"]):
            n += 1
            figurinhas.append(figurinha(n, f"{s}-{i + 4:02d}", t["nome"], s, "JOGADOR", nome, RARIDADE[rar], hist, vis,
                                        apelido=ap, posicao=pos, camisa=cam, idade=idade, destaque=traco,
                                        atributos=atributos(pos, rar, traco)))
        mn, me, mp, mh, mv = t["mascote"]
        n += 1
        figurinhas.append(figurinha(n, f"{s}-15", t["nome"], s, "MASCOTE", mn, "COMUM", mh, mv, destaque=f"{me} · {mp}"))
    for i, (s, pos, nome, ap, ano, traco, hist, vis) in enumerate(LENDAS):
        n += 1
        figurinhas.append(figurinha(n, f"LEN-{i + 1:02d}", "Lendas do Inter Classes", s, "LENDA", nome, "LENDARIA",
                                    f"{hist} Turma de {ano}.",
                                    vis, apelido=ap, posicao=pos, destaque=traco, atributos=atributos(pos, "Lendária", traco)))
    for i, (s, tit, ano, prot, desc, vis) in enumerate(MOMENTOS):
        n += 1
        figurinhas.append(figurinha(n, f"MOM-{i + 1:02d}", "Grandes Momentos do Inter Classes", s, "MOMENTO", tit, "EPICA",
                                    desc, vis, destaque=f"{ano} · {prot}"))

    assert n == 136 and len({f["codigo"] for f in figurinhas}) == 136
    DESTINO.mkdir(parents=True, exist_ok=True)
    (DESTINO / "temporada.json").write_text(json.dumps(
        {"numero": TEMPORADA, "nome": "Inter Classes", "requisito": 1, "publicada": False}, ensure_ascii=False, indent=2) + "\n")
    (DESTINO / "clubes.json").write_text(json.dumps(clubes, ensure_ascii=False, indent=2) + "\n")
    (DESTINO / "figurinhas.json").write_text(json.dumps(figurinhas, ensure_ascii=False, indent=2) + "\n")
    salvar_planilha(clubes, figurinhas)
    print(f"{len(clubes)} turmas, {len(figurinhas)} figurinhas em {DESTINO}")


def salvar_planilha(clubes, figurinhas):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill

    wb = Workbook()
    def aba(ws, cab, linhas, larguras):
        ws.append(cab)
        for c in ws[1]:
            c.font = Font(bold=True, color="FFFFFF")
            c.fill = PatternFill("solid", fgColor="161A26")
        for l in linhas:
            ws.append(l)
        for row in ws.iter_rows(min_row=2):
            for c in row:
                c.alignment = Alignment(wrap_text=True, vertical="top")
        for i, w in enumerate(larguras):
            ws.column_dimensions[chr(65 + i)].width = w
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
    ws = wb.active
    ws.title = "Turmas"
    aba(ws, ["Sigla", "Turma", "Série", "Cores", "QG", "Mascote", "Rival", "Clássico", "Lema", "Identidade", "Professor(a)"],
        [[c["sigla"], c["nome"], c["cidade"].split(" · ")[1], c["nomeCores"], c["estadio"], c["mascote"], c["rival"],
          c["classico"], c["lema"], c["identidade"], c["tecnico"]] for c in clubes],
        [7, 26, 8, 22, 30, 24, 26, 24, 34, 60, 22])
    rar = {"COMUM": "Comum", "RARA": "Rara", "EPICA": "Épica", "LENDARIA": "Lendária"}
    aba(wb.create_sheet("Figurinhas"),
        ["Nº", "Código", "Seção", "Tipo", "Nome", "Apelido", "Posição", "Camisa", "Idade", "Raridade",
         "Traço / destaque", "ATA", "DEF", "TEC", "VEL", "FIS", "História", "Descrição visual"],
        [[f["numero"], f["codigo"], f["secao"], f["tipo"].title(), f["nome"], f["apelido"], f["posicao"], f["camisa"],
          f["idade"], rar[f["raridade"]], f["destaque"], *(f.get("atributos", {}).get(k) for k in ["ata", "def", "tec", "vel", "fis"]),
          f["historia"], f["descricaoVisual"]] for f in figurinhas],
        [5, 11, 26, 9, 24, 22, 8, 7, 6, 9, 26, 5, 5, 5, 5, 5, 60, 60])
    PLANILHA.parent.mkdir(parents=True, exist_ok=True)
    wb.save(PLANILHA)


if __name__ == "__main__":
    main()
