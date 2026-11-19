"""Gera as planilhas de briefing de arte (uma por tipo) em docs/arte/planilhas/.

Cada linha traz o que o desenho deve mostrar, pronto para colar num gerador de
imagem (Gemini etc.), e uma coluna "Link da Imagem" em branco para preencher.

Uso, a partir da raiz do repositório:
    python3 -I tools/planilhas/gerar_planilhas_arte.py
"""
import json
from pathlib import Path

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

RAIZ = Path(__file__).resolve().parents[2]
DESTINO = RAIZ / "docs/arte/planilhas"
figurinhas = json.loads((RAIZ / "data/temporada1/figurinhas.json").read_text())
clubes = {c["sigla"]: c for c in json.loads((RAIZ / "data/temporada1/clubes.json").read_text())}
cores = {
    r["Sigla"]: str(r["Cores"]).lower()
    for _, r in pd.read_excel(RAIZ / "docs/planilhas/Craques_da_Varzea_Fichas_T1.xlsx", sheet_name="Clubes").iterrows()
}

ESTILO = ("Ilustração de figurinha de álbum de futebol, estilo cartoon semi-realista bem-humorado, "
          "traço limpo, cores chapadas e vivas, sombreamento suave")
EVITAR_BASE = ("pessoa real ou celebridade, jogador real, escudo ou logotipo de clube real, marcas e patrocínios, "
               "texto, letras, números, marca d'água, fotorrealismo")

POSICAO = {"GOL": "goleiro", "ZAG": "zagueiro", "LAT": "lateral", "VOL": "volante", "MEI": "meia",
           "PON": "ponta", "ATA": "atacante", "TEC": "técnico"}


def pessoas(f):
    c, cor = clubes[f["clube"]], cores[f["clube"]]
    idade = f"{f['idade']} anos, " if f.get("idade") else ""
    if f["tipo"] == "TECNICO":
        quem = f"técnico de futebol fictício do {c['nome']}, {idade}roupa de treinador nas cores {cor}"
    elif f["tipo"] == "LENDA":
        mulher = f["descricaoVisual"].lower().startswith(("senhora", "mulher"))
        quem = (f"{'ídola aposentada fictícia' if mulher else 'ídolo aposentado fictício'} do {c['nome']} "
                f"({POSICAO.get(f['posicao'], '')}), {'senhora' if mulher else 'senhor'}, "
                f"visual retrô anos 80, camisa antiga {cor} com gola")
    else:
        quem = (f"{POSICAO[f['posicao']]} de futebol fictício do {c['nome']}, {idade}"
                f"camisa do clube {cor} sem número e sem patrocínio")
        if f["posicao"] == "GOL":
            quem += ", luvas de goleiro"
    jeito = f"Personalidade para a expressão: apelido \"{f['apelido']}\" — {f['historia']}" if f.get("apelido") else f["historia"]
    return (f"{ESTILO}. Retrato em busto, do peito para cima, olhando para a frente, rosto centralizado, "
            f"fundo liso de uma cor clara. {quem[0].upper() + quem[1:]}. Aparência: {f['descricaoVisual']} {jeito}")


def escudo(f):
    c, cor = clubes[f["clube"]], cores[f["clube"]]
    return (f"Escudo de clube de futebol fictício, design vetorial plano, contornos firmes, simétrico, "
            f"poucas cores ({cor}), legível em tamanho pequeno, fundo transparente. Clube: {c['nome']}, "
            f"de {c['cidade']}. {f['descricaoVisual']} Identidade: {c['identidade']} Sem texto nem letras.")


def estadio(f):
    c, cor = clubes[f["clube"]], cores[f["clube"]]
    return (f"{ESTILO}. Vista panorâmica de um estádio de futebol fictício, enquadramento horizontal, "
            f"dia ensolarado ou fim de tarde, sem pessoas em destaque. {f['nome']}, casa do {c['nome']} "
            f"em {c['cidade']}, {f['destaque'].lower().replace('capacidade: ', 'para ')} torcedores. "
            f"Cores predominantes: {cor}. {f['descricaoVisual']}")


def mascote(f):
    c, cor = clubes[f["clube"]], cores[f["clube"]]
    especie, jeito = (f["destaque"].split(" · ") + [""])[:2]
    return (f"{ESTILO}. Mascote de time de futebol fictício, corpo inteiro, de pé, pose animada, "
            f"fundo liso de uma cor clara, simpático e fofo (nunca assustador). {f['nome']}, "
            f"{especie.lower()}, jeito {jeito.lower()}, mascote do {c['nome']}, roupa nas cores {cor}. "
            f"{f['descricaoVisual']} Toque de humor: {f['historia']}")


def momento(f):
    c, cor = clubes[f["clube"]], cores[f["clube"]]
    ano, quem = f["destaque"].split(" · ", 1)
    return (f"{ESTILO}. Cena épica e cheia de movimento de um lance histórico, enquadramento horizontal, "
            f"clima de pôster comemorativo. \"{f['nome']}\" ({ano}), {c['nome']}, protagonista: {quem}. "
            f"O que aconteceu: {f['historia']} O desenho deve mostrar: {f['descricaoVisual']} "
            f"Cores do clube: {cor}.")


PLANILHAS = [
    ("1_Jogadores_Tecnicos_Lendas", ("JOGADOR", "TECNICO", "LENDA"), pessoas,
     "Quadrado 1024×1024, PNG", EVITAR_BASE + ", corpo inteiro, mãos deformadas, chapéu cobrindo o rosto"),
    ("2_Escudos", ("ESCUDO",), escudo, "Quadrado 1024×1024, PNG com fundo transparente",
     EVITAR_BASE + ", efeito 3D exagerado, degradês complexos"),
    ("3_Estadios", ("ESTADIO",), estadio, "Horizontal 1024×832, PNG", EVITAR_BASE + ", estádio real conhecido"),
    ("4_Mascotes", ("MASCOTE",), mascote, "Quadrado 1024×1024, PNG",
     EVITAR_BASE + ", aparência assustadora, dentes afiados, sangue"),
    ("5_Momentos", ("MOMENTO",), momento, "Horizontal 1024×832, PNG", EVITAR_BASE + ", placar com nomes, violência"),
]


def preencher(ws, linhas):
    cab = ["Código", "Nome", "Clube", "O que o desenho deve trazer", "Evitar", "Formato", "Link da Imagem"]
    ws.append(cab)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="161A26")
        c.alignment = Alignment(vertical="center", wrap_text=True)
    for linha in linhas:
        ws.append(linha)
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical="top")
    for col, w in zip("ABCDEFG", (10, 30, 20, 95, 45, 20, 40)):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:G{ws.max_row}"


def main():
    DESTINO.mkdir(parents=True, exist_ok=True)
    tudo = Workbook()
    tudo.remove(tudo.active)
    for nome, tipos, montar, formato, evitar in PLANILHAS:
        linhas = []
        for f in sorted((f for f in figurinhas if f["tipo"] in tipos), key=lambda f: f["numero"]):
            titulo = f["nome"] + (f" ({f['apelido']})" if f.get("apelido") else "")
            linhas.append([f["codigo"], titulo, clubes[f["clube"]]["nome"], montar(f), evitar, formato, ""])
        titulo_aba = nome.split("_", 1)[1][:31]
        wb = Workbook()
        wb.active.title = titulo_aba
        preencher(wb.active, linhas)
        wb.save(DESTINO / f"{nome}.xlsx")
        preencher(tudo.create_sheet(titulo_aba), linhas)
        print(f"{nome}: {len(linhas)}")
    # Tudo num arquivo só, para importar no Google Sheets e usar o Apps Script.
    tudo.save(DESTINO.parent / "Briefing_Arte_T1.xlsx")


if __name__ == "__main__":
    main()
