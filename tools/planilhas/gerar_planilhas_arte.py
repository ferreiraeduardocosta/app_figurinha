"""Gera as planilhas de briefing de arte (uma por tipo) em docs/arte/planilhas/.

Cada linha traz o que o desenho deve mostrar, pronto para colar num gerador de
imagem (Gemini etc.), e uma coluna "Link da Imagem" em branco para preencher.

Uso, a partir da raiz do repositório:
    python3 -I tools/planilhas/gerar_planilhas_arte.py        # Temporada 1
    python3 -I tools/planilhas/gerar_planilhas_arte.py 2      # Temporada 2 (Inter Classes)
"""
import json
import sys
from pathlib import Path

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

RAIZ = Path(__file__).resolve().parents[2]
TEMPORADA = int(sys.argv[1]) if len(sys.argv) > 1 else 1
# A Temporada 2 é o Inter Classes: alunos adolescentes, professores e cenários da escola.
ESCOLA = TEMPORADA == 2
DESTINO = RAIZ / ("docs/arte/planilhas" if TEMPORADA == 1 else f"docs/arte/temporada{TEMPORADA}/planilhas")
figurinhas = json.loads((RAIZ / f"data/temporada{TEMPORADA}/figurinhas.json").read_text())
clubes = {c["sigla"]: c for c in json.loads((RAIZ / f"data/temporada{TEMPORADA}/clubes.json").read_text())}
if TEMPORADA == 1:
    cores = {
        r["Sigla"]: str(r["Cores"]).lower()
        for _, r in pd.read_excel(RAIZ / "docs/planilhas/Craques_da_Varzea_Fichas_T1.xlsx", sheet_name="Clubes").iterrows()
    }
else:
    cores = {s: c["nomeCores"] for s, c in clubes.items()}

ESTILO = ("Ilustração de figurinha de álbum de futebol, estilo cartoon semi-realista bem-humorado, "
          "traço limpo, cores chapadas e vivas, sombreamento suave")
EVITAR_BASE = ("pessoa real ou celebridade, jogador real, escudo ou logotipo de clube real, marcas e patrocínios, "
               "texto, letras, números, marca d'água, fotorrealismo")

POSICAO = {"GOL": "goleiro", "ZAG": "zagueiro", "LAT": "lateral", "VOL": "volante", "MEI": "meia",
           "PON": "ponta", "ATA": "atacante", "TEC": "técnico"}
POSICAO_F = {**POSICAO, "GOL": "goleira", "ZAG": "zagueira", "TEC": "técnica"}


def pessoas(f):
    if ESCOLA:
        return pessoas_escola(f)
    # Sem o nome do clube: "Tubarões", "Leões", "Dragões" faziam o gerador desenhar bichos.
    cor = cores[f["clube"]]
    mulher = f["descricaoVisual"].lower().startswith(("senhora", "mulher"))
    humano = "mulher" if mulher else "homem"
    idade = f"{f['idade']} anos, " if f.get("idade") else ""
    if f["tipo"] == "TECNICO":
        quem = f"técnico de futebol fictício, {idade}roupa de treinador nas cores {cor}"
    elif f["tipo"] == "LENDA":
        quem = (f"{'ídola aposentada' if mulher else 'ídolo aposentado'} do futebol ({POSICAO.get(f['posicao'], '')}), "
                f"{'senhora idosa' if mulher else 'senhor idoso'}, visual retrô anos 80, camisa antiga {cor} com gola")
    else:
        quem = (f"jogador de futebol fictício ({POSICAO[f['posicao']]}), {idade}"
                f"camisa de futebol {cor} sem número e sem patrocínio")
        if f["posicao"] == "GOL":
            quem += ", luvas de goleiro"
    return (f"{ESTILO}. Retrato de um(a) {humano} de verdade, ser humano com rosto humano, em busto, do peito "
            f"para cima, olhando para a frente, rosto centralizado, fundo liso de uma cor clara. "
            f"{quem[0].upper() + quem[1:]}. Aparência física: {f['descricaoVisual']} "
            # A história fica de fora: bichos e objetos citados nela (leão, robô, pipa...) iam parar no desenho.
            f"Expressão confiante e simpática, só a pessoa, sem objetos nem animais na cena.").replace("um(a) homem", "um homem").replace("um(a) mulher", "uma mulher")


def pessoas_escola(f):
    """Inter Classes: alunos adolescentes, professores e ex-alunos na foto da época."""
    cor = cores[f["clube"]]
    v = f["descricaoVisual"]
    menina = v.lower().startswith(("menina", "mulher"))
    base = (f"{ESTILO}. Retrato em busto, do peito para cima, olhando para a frente, rosto centralizado, "
            f"fundo liso de uma cor clara. ")
    if f["tipo"] == "TECNICO":
        quem = (f"{'Professora' if menina else 'Professor'} de escola, adulto(a), técnico(a) do time da turma no "
                f"campeonato interclasses, roupa do dia a dia de professor com detalhes nas cores {cor}")
    elif f["tipo"] == "LENDA":
        quem = (f"{'Ex-aluna' if menina else 'Ex-aluno'} lendário(a) do interclasses na foto do anuário da época: "
                f"adolescente, visual de foto escolar dos anos 2000/2010, camiseta esportiva escolar {cor}")
    else:
        quem = (f"{'Aluna' if menina else 'Aluno'} adolescente de {f['idade']} anos jogando o campeonato interclasses da escola "
                f"({(POSICAO_F if menina else POSICAO)[f['posicao']]}), camiseta esportiva escolar {cor} sem número e sem marcas"
                + (", luvas de goleiro" if f["posicao"] == "GOL" else ""))
    return (base + f"{quem}. Aparência física: {v} Rosto e corpo de adolescente, proporções realistas para a idade. "
            "Expressão alegre e confiante, só a pessoa, sem objetos nem animais na cena.").replace("adulto(a)", "adulta" if menina else "adulto").replace("técnico(a)", "técnica" if menina else "técnico").replace("lendário(a)", "lendária" if menina else "lendário")


def escudo(f):
    c, cor = clubes[f["clube"]], cores[f["clube"]]
    if ESCOLA:
        return (f"Escudo de time escolar fictício de campeonato interclasses, design vetorial plano, contornos firmes, "
                f"simétrico, poucas cores ({cor}), divertido e jovem, legível em tamanho pequeno, fundo transparente. "
                f"Time: {c['nome']}. {f['descricaoVisual']} Identidade: {c['identidade']} Sem texto nem letras.")
    return (f"Escudo de clube de futebol fictício, design vetorial plano, contornos firmes, simétrico, "
            f"poucas cores ({cor}), legível em tamanho pequeno, fundo transparente. Clube: {c['nome']}, "
            f"de {c['cidade']}. {f['descricaoVisual']} Identidade: {c['identidade']} Sem texto nem letras.")


def estadio(f):
    c, cor = clubes[f["clube"]], cores[f["clube"]]
    if ESCOLA:
        return (f"{ESTILO}. Cenário de escola: o \"QG\" de uma turma no campeonato interclasses, enquadramento horizontal, "
                f"bem iluminado, sem pessoas em destaque. {f['nome']}, ponto de encontro do {c['nome']}. "
                f"Decoração nas cores {cor}. {f['descricaoVisual']}")
    return (f"{ESTILO}. Vista panorâmica de um estádio de futebol fictício, enquadramento horizontal, "
            f"dia ensolarado ou fim de tarde, sem pessoas em destaque. {f['nome']}, casa do {c['nome']} "
            f"em {c['cidade']}, {f['destaque'].lower().replace('capacidade: ', 'para ')} torcedores. "
            f"Cores predominantes: {cor}. {f['descricaoVisual']}")


def mascote(f):
    c, cor = clubes[f["clube"]], cores[f["clube"]]
    especie, jeito = (f["destaque"].split(" · ") + [""])[:2]
    if ESCOLA:
        return (f"{ESTILO}. Mascote de turma escolar no campeonato interclasses, corpo inteiro, de pé, pose animada, "
                f"fundo liso de uma cor clara, simpático e fofo (nunca assustador). {f['nome']}, {especie.lower()}, "
                f"jeito {jeito.lower()}, mascote do {c['nome']}, roupa nas cores {cor}. {f['descricaoVisual']} "
                f"Toque de humor: {f['historia']}")
    return (f"{ESTILO}. Mascote de time de futebol fictício, corpo inteiro, de pé, pose animada, "
            f"fundo liso de uma cor clara, simpático e fofo (nunca assustador). {f['nome']}, "
            f"{especie.lower()}, jeito {jeito.lower()}, mascote do {c['nome']}, roupa nas cores {cor}. "
            f"{f['descricaoVisual']} Toque de humor: {f['historia']}")


def momento(f):
    c, cor = clubes[f["clube"]], cores[f["clube"]]
    ano, quem = f["destaque"].split(" · ", 1)
    if ESCOLA:
        return (f"{ESTILO}. Cena divertida e cheia de movimento de um lance histórico do campeonato interclasses de uma "
                f"escola, adolescentes de uniforme esportivo escolar, enquadramento horizontal, clima de foto de anuário. "
                f"\"{f['nome']}\" ({ano}), {c['nome']}, protagonista: {quem}. O que aconteceu: {f['historia']} "
                f"O desenho deve mostrar: {f['descricaoVisual']} Cores da turma: {cor}.")
    return (f"{ESTILO}. Cena épica e cheia de movimento de um lance histórico, enquadramento horizontal, "
            f"clima de pôster comemorativo. \"{f['nome']}\" ({ano}), {c['nome']}, protagonista: {quem}. "
            f"O que aconteceu: {f['historia']} O desenho deve mostrar: {f['descricaoVisual']} "
            f"Cores do clube: {cor}.")


PLANILHAS = [
    ("1_Jogadores_Tecnicos_Lendas", ("JOGADOR", "TECNICO", "LENDA"), pessoas,
     "Quadrado 1024×1024, PNG",
     EVITAR_BASE + ", animal, bicho com roupa, personagem antropomórfico, mascote, criatura, "
     "corpo inteiro, mãos deformadas, chapéu cobrindo o rosto"),
    ("2_Escudos", ("ESCUDO",), escudo, "Quadrado 1024×1024, PNG com fundo transparente",
     EVITAR_BASE + ", efeito 3D exagerado, degradês complexos"),
    ("3_Estadios" if not ESCOLA else "3_QGs", ("ESTADIO",), estadio, "Horizontal 1024×832, PNG",
     EVITAR_BASE + (", estádio real conhecido" if not ESCOLA else ", escola real conhecida")),
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
    tudo.save(DESTINO.parent / f"Briefing_Arte_T{TEMPORADA}.xlsx")


if __name__ == "__main__":
    main()
