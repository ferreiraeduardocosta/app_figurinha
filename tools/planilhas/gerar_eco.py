import json, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment
from openpyxl.formatting.rule import CellIsRule, FormulaRule

SIM, OUT = sys.argv[1], sys.argv[2]
sims = json.load(open(SIM))

F = "Arial"
BLUE = Font(name=F, size=10, color="0000FF")
BLUE_B = Font(name=F, size=10, color="0000FF", bold=True)
BLACK = Font(name=F, size=10)
BOLD = Font(name=F, size=10, bold=True)
GREEN = Font(name=F, size=10, color="008000")
H_FILL = PatternFill("solid", fgColor="1F2937"); H_FONT = Font(name=F, bold=True, color="FFFFFF", size=10)
YELLOW = PatternFill("solid", fgColor="FFFF00")
SEC = Font(name=F, bold=True, size=12)
TITLE = Font(name=F, bold=True, size=16)
NOTE = Font(name=F, size=9, italic=True, color="5B6070")
WRAP = Alignment(wrap_text=True, vertical="top")
CEN = Alignment(horizontal="center", vertical="center")
LINE = Border(bottom=Side(style="thin", color="D1D5DB"))
PCT = "0.0%"; BRL = '"R$" #,##0.00'; INT = "#,##0"; DEC = "0.0"

def hdr(ws, r, cols, c0=1):
    for j, h in enumerate(cols, c0):
        c = ws.cell(row=r, column=j, value=h); c.font = H_FONT; c.fill = H_FILL
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[r].height = 32

def put(ws, ref, v, font=BLACK, fmt=None, al=None, fill=None):
    c = ws[ref]; c.value = v; c.font = font
    if fmt: c.number_format = fmt
    if al: c.alignment = al
    if fill: c.fill = fill
    return c

wb = Workbook()

# ================= Leia-me =================
ws = wb.active; ws.title = "Leia-me"
ws.column_dimensions["A"].width = 24; ws.column_dimensions["B"].width = 100
rows = [
 ("Craques da Várzea — Economia do álbum (Temporada 1)", None, TITLE),
 ("Quantos pacotes um jogador precisa para completar o álbum de 136 figurinhas, e como calibrar probabilidades, garantias, balcão de repetidas, trocas e loja para chegar à meta.", None, "texto"),
 ("", None, None),
 ("Abas", None, SEC),
 ("Premissas", "Todos os números que você pode mudar (texto azul). As células amarelas são as alavancas principais da economia.", None),
 ("Análise rápida", "Contas que se recalculam sozinhas a partir das Premissas: o que sai num pacote, chance de cada raridade e uma estimativa matemática simples.", None),
 ("Simulação", "Resultado de 2.000 coleções simuladas por cenário (método Monte Carlo). Mostra quantos pacotes são necessários e quanto tempo/dinheiro isso representa.", None),
 ("Loja", "Ofertas de pacotes em reais, preço por pacote e receita líquida após a comissão das lojas.", None),
 ("", None, None),
 ("Legenda de cores", None, SEC),
 ("Texto azul", "Premissa digitada: pode editar.", None),
 ("Fundo amarelo", "Alavanca principal da economia: mude aqui primeiro.", None),
 ("Texto preto", "Fórmula: não editar.", None),
 ("Texto verde", "Valor puxado de outra aba.", None),
 ("", None, None),
 ("Meta", None, SEC),
 ("Faixa saudável", "Completar o álbum entre 60 e 100 pacotes (mediana) para quem joga com trocas. Abaixo disso o álbum acaba rápido demais; acima, frustra.", None),
 ("", None, None),
 ("Importante", None, SEC),
 ("Simulação x fórmulas", "Os números da aba Simulação foram gerados por um script com as premissas mostradas em cada linha. Eles NÃO mudam sozinhos quando você edita as Premissas; para um cenário novo, é preciso rodar a simulação de novo. As colunas de dias e custo, porém, são fórmulas e se recalculam.", None),
 ("Modelo de troca", "Cada repetida tem 40% de chance de virar, numa troca 1 por 1, uma figurinha que falta da mesma raridade. É uma premissa a validar com dados reais do beta.", None),
 ("Lojas e lei", "Apple e Google exigem divulgar as probabilidades antes da compra. A garantia mínima (pity) também deve aparecer na tela de probabilidades.", None),
]
r = 1
for a, b, kind in rows:
    c = ws.cell(row=r, column=1, value=a)
    if kind == "texto":
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
        c.font = BLACK; c.alignment = WRAP; ws.row_dimensions[r].height = 30
    elif kind is not None: c.font = kind
    else: c.font = BOLD; c.alignment = Alignment(vertical="top")
    if b: d = ws.cell(row=r, column=2, value=b); d.font = BLACK; d.alignment = WRAP
    r += 1
ws["A11"].font = Font(name=F, size=10, bold=True, color="0000FF")
ws["A12"].fill = YELLOW
ws["A14"].font = Font(name=F, size=10, bold=True, color="008000")
ws.row_dimensions[20].height = 42; ws.row_dimensions[21].height = 28

# ================= Premissas =================
P = wb.create_sheet("Premissas")
for col, w in zip("ABCDEF", [34, 14, 14, 14, 14, 60]):
    P.column_dimensions[col].width = w
put(P, "A1", "Premissas da economia", TITLE)
put(P, "A2", "Texto azul = editável · fundo amarelo = alavanca principal", NOTE)

put(P, "A4", "Álbum e probabilidades", SEC)
hdr(P, 5, ["Raridade", "Figurinhas no álbum", "Probabilidade por figurinha", "Esboço original", "Repetidas no balcão p/ 1 nova", "Observação"])
rar = [("Comum", 88, 0.62, 0.72, "Elenco base, escudos, estádios, técnicos e mascotes."),
       ("Rara", 24, 0.25, 0.21, "3 titulares de destaque por clube."),
       ("Épica", 16, 0.10, 0.06, "Craques e Grandes Momentos."),
       ("Lendária", 8, 0.03, 0.01, "Lendas da Liga.")]
for i, (n, q, p, p0, obs) in enumerate(rar, 6):
    put(P, f"A{i}", n, BOLD)
    put(P, f"B{i}", q, BLUE, INT, CEN)
    put(P, f"C{i}", p, BLUE_B, PCT, CEN, YELLOW)
    put(P, f"D{i}", p0, BLUE, PCT, CEN)
    put(P, f"E{i}", "=$B$17", BLACK, INT, CEN)
    put(P, f"F{i}", obs, BLACK, al=WRAP)
P["B6"].comment = Comment("Contagens da planilha de fichas (Craques_da_Varzea_Fichas_T1.xlsx, aba Resumo).", "Planilha")
put(P, "A10", "Total", BOLD)
put(P, "B10", "=SUM(B6:B9)", BOLD, INT, CEN)
put(P, "C10", "=SUM(C6:C9)", BOLD, PCT, CEN)
put(P, "D10", "=SUM(D6:D9)", BOLD, PCT, CEN)
put(P, "F10", '=IF(ROUND(C10,4)=1,"OK: probabilidades somam 100%","ATENÇÃO: as probabilidades precisam somar 100%")', BOLD)

put(P, "A12", "Pacote, garantias e balcão", SEC)
hdr(P, 13, ["Parâmetro", "Valor", "", "", "", "Como funciona"])
params = [
 (14, "Figurinhas por pacote", 5, INT, False, "Cada pacote traz 5 figurinhas."),
 (15, "Garantia: 1 Épica a cada (pacotes)", 10, INT, True, "Se passar esse número de pacotes sem Épica ou Lendária, o próximo traz uma Épica."),
 (16, "Garantia: 1 Lendária a cada (pacotes)", 30, INT, True, "Se passar esse número de pacotes sem Lendária, o próximo traz uma."),
 (17, "Balcão: repetidas para 1 nova", 4, INT, True, "Troca N repetidas de uma raridade por 1 figurinha que falta, à escolha, da mesma raridade."),
 (18, "Trocas: aproveitamento das repetidas", 0.40, PCT, False, "Parte das repetidas que vira, por troca com amigos, uma figurinha que falta. Premissa a validar no beta."),
 (19, "Chance de variante Brilhante", 0.05, PCT, False, "Cerca de 1 em 20. Cosmética: não conta para completar o álbum."),
]
for r_, lab, v, fmt, key, how in params:
    put(P, f"A{r_}", lab, BOLD)
    put(P, f"B{r_}", v, BLUE_B if key else BLUE, fmt, CEN, YELLOW if key else None)
    put(P, f"F{r_}", how, BLACK, al=WRAP)

put(P, "A21", "Ganhos gratuitos", SEC)
hdr(P, 22, ["Parâmetro", "Valor", "", "", "", "Observação"])
free = [
 (23, "Pacotes grátis por dia", 1, DEC, "Pacote diário ao abrir o app."),
 (24, "Moedas ganhas por dia (missões)", 60, INT, "Missões diárias e semanais, em média por dia."),
 (25, "Preço do pacote em moedas", 100, INT, "Pacote comprado com moedas do jogo."),
]
for r_, lab, v, fmt, obs in free:
    put(P, f"A{r_}", lab, BOLD); put(P, f"B{r_}", v, BLUE, fmt, CEN); put(P, f"F{r_}", obs, BLACK, al=WRAP)
put(P, "A26", "Pacotes grátis por dia (total)", BOLD)
put(P, "B26", "=B23+B24/B25", BOLD, "0.00", CEN)
put(P, "F26", "Pacote diário + o que as moedas compram.", BLACK)

put(P, "A28", "Meta", SEC)
put(P, "A29", "Meta mínima (pacotes)", BOLD); put(P, "B29", 60, BLUE, INT, CEN)
put(P, "A30", "Meta máxima (pacotes)", BOLD); put(P, "B30", 100, BLUE, INT, CEN)
put(P, "F29", "Faixa saudável de pacotes (mediana) para completar o álbum jogando com trocas.", BLACK, al=WRAP)
P.freeze_panes = "A4"

# ================= Análise rápida =================
A = wb.create_sheet("Análise rápida")
for col, w in zip("ABCDEFGH", [16, 13, 13, 15, 16, 18, 20, 44]):
    A.column_dimensions[col].width = w
put(A, "A1", "Análise rápida (recalcula com as Premissas)", TITLE)
put(A, "A2", "Estimativas matemáticas simples. Para o número realista, com garantias, balcão e trocas, veja a aba Simulação.", NOTE)
hdr(A, 4, ["Raridade", "Figurinhas", "Probabilidade", "Média por pacote", "Chance de vir ≥1 no pacote", "Chance de uma figurinha específica no pacote", "Pacotes p/ completar a raridade (sozinho, sem ajuda)", "Como ler"])
H = "(LN(B{r})+0.5772+1/(2*B{r}))"
for i in range(4):
    r_ = 5 + i; pr = 6 + i
    put(A, f"A{r_}", f"=Premissas!A{pr}", GREEN)
    put(A, f"B{r_}", f"=Premissas!B{pr}", GREEN, INT, CEN)
    put(A, f"C{r_}", f"=Premissas!C{pr}", GREEN, PCT, CEN)
    put(A, f"D{r_}", f"=C{r_}*Premissas!$B$14", BLACK, "0.00", CEN)
    put(A, f"E{r_}", f"=1-(1-C{r_})^Premissas!$B$14", BLACK, PCT, CEN)
    put(A, f"F{r_}", f"=1-(1-C{r_}/B{r_})^Premissas!$B$14", BLACK, "0.00%", CEN)
    put(A, f"G{r_}", f"=ROUND(B{r_}*{H.format(r=r_)}/(C{r_}*Premissas!$B$14),0)", BLACK, INT, CEN)
put(A, "H5", "D: quantas figurinhas dessa raridade vêm, em média, em cada pacote.", BLACK, al=WRAP)
put(A, "H6", "E: chance de abrir um pacote e achar pelo menos uma.", BLACK, al=WRAP)
put(A, "H7", "F: chance de uma figurinha exata (ex.: o Faísca) aparecer num pacote.", BLACK, al=WRAP)
put(A, "H8", "G: problema do colecionador de cupons; cada raridade isolada.", BLACK, al=WRAP)
for r_ in range(5, 9): A.row_dimensions[r_].height = 30
put(A, "A10", "Gargalo (sozinho, sem ajuda)", BOLD)
put(A, "G10", "=MAX(G5:G8)", BOLD, INT, CEN)
put(A, "H10", '=INDEX(A5:A8,MATCH(G10,G5:G8,0))&" é a raridade que mais demora. O total real fica um pouco acima disso."', BLACK, al=WRAP)
A.row_dimensions[10].height = 30
put(A, "A12", "Pacotes por dia (grátis)", BOLD); put(A, "D12", "=Premissas!B26", GREEN, "0.00", CEN)
put(A, "A13", "Dias só com grátis p/ o gargalo", BOLD); put(A, "D13", "=ROUND(G10/D12,0)", BLACK, INT, CEN)
put(A, "A14", "Figurinhas Brilhantes esperadas até completar (sozinho)", BOLD)
put(A, "D14", "=ROUND(G10*Premissas!B14*Premissas!B19,0)", BLACK, INT, CEN)

# ================= Simulação =================
S = wb.create_sheet("Simulação")
widths = [46, 18, 10, 10, 11, 9, 10, 9, 9, 11, 11, 11, 13, 16, 12]
for j, w in enumerate(widths, 1):
    S.column_dimensions[chr(64 + j)].width = w
put(S, "A1", "Simulação Monte Carlo: pacotes para completar o álbum", TITLE)
put(S, "A2", "2.000 coleções simuladas por cenário, álbum de 136 figurinhas, pacotes de 5. Valores fixos gerados por script; colunas M a O são fórmulas.", NOTE)
hdr(S, 4, ["Cenário", "Probabilidades (C/R/E/L)", "Garantia Épica", "Garantia Lendária", "Balcão (N→1)", "Trocas",
           "10% mais sortudos", "Mediana", "10% mais azarados", "Completam em ≤60", "Completam em ≤100", "Completam em ≤150",
           "Dias só com grátis (mediana)", "Gasto p/ completar em 30 dias (R$)", "Dentro da meta?"])
for i, s in enumerate(sims, 5):
    pr = s["prob"]; kw = s["params"]
    vals = [s["nome"], f'{pr["C"]}/{pr["R"]}/{pr["E"]}/{pr["L"]}',
            kw.get("pity_e") or "—", kw.get("pity_l") or "—", (f'{kw["balcao"]}→1' if kw.get("balcao") else "—"),
            (kw.get("troca") or 0), s["p10"], s["mediana"], s["p90"], s["ate60"], s["ate100"], s["ate150"]]
    for j, v in enumerate(vals, 1):
        c = S.cell(row=i, column=j, value=v); c.font = BLUE if j > 1 else BOLD
        c.alignment = CEN if j > 1 else Alignment(vertical="center", wrap_text=True); c.border = LINE
        if j == 6: c.number_format = PCT if v else '"—"'
        if j in (10, 11, 12): c.number_format = PCT
    S.cell(row=i, column=13, value=f"=ROUND(H{i}/Premissas!$B$26,0)").number_format = INT
    S.cell(row=i, column=14, value=f"=MAX(0,H{i}-Premissas!$B$26*30)*Loja!$E$10").number_format = BRL
    S.cell(row=i, column=15, value=f'=IF(AND(H{i}>=Premissas!$B$29,H{i}<=Premissas!$B$30),"Sim","Não")')
    for j in (13, 14, 15):
        c = S.cell(row=i, column=j); c.font = BLACK; c.alignment = CEN; c.border = LINE
    S.row_dimensions[i].height = 30
last = 4 + len(sims)
S.cell(row=5, column=8).comment = Comment("Mediana: metade dos jogadores completa com menos pacotes que isso, metade com mais.", "Planilha")
S.conditional_formatting.add(f"O5:O{last}", CellIsRule(operator="equal", formula=['"Sim"'], fill=PatternFill("solid", fgColor="C6EFCE"), font=Font(name=F, color="006100", bold=True)))
S.conditional_formatting.add(f"O5:O{last}", CellIsRule(operator="equal", formula=['"Não"'], fill=PatternFill("solid", fgColor="FFC7CE"), font=Font(name=F, color="9C0006", bold=True)))
for i, s in enumerate(sims, 5):
    if "RECOMENDADO" in s["nome"]:
        for j in range(1, 16): S.cell(row=i, column=j).fill = PatternFill("solid", fgColor="E0F2F1")
n = last + 2
put(S, f"A{n}", "Como ler", SEC)
notas = [
 "Mediana: metade dos jogadores completa com menos pacotes que isso. Os 10% mais azarados precisam do valor da coluna I.",
 "Dias só com grátis: quanto tempo leva completando apenas com o pacote diário e as moedas das missões (Premissas, linha 26).",
 "Gasto em 30 dias: quanto o jogador mediano gastaria para completar em um mês, comprando o restante no melhor pacote da Loja.",
 "Recomendado (linhas destacadas): probabilidades 62/25/10/3, Épica garantida a cada 10 pacotes, Lendária a cada 30, balcão 4→1.",
 "Os cenários A a D usam as probabilidades do esboço (72/21/6/1) e mostram por que elas precisam mudar: mesmo com ajuda, passam de 190 pacotes.",
]
for k, t in enumerate(notas, n + 1):
    S.merge_cells(start_row=k, start_column=1, end_row=k, end_column=15)
    put(S, f"A{k}", "• " + t, BLACK, al=WRAP)
S.freeze_panes = "B5"

# ================= Loja =================
L = wb.create_sheet("Loja")
for col, w in zip("ABCDEFGH", [26, 12, 14, 16, 16, 18, 18, 40]):
    L.column_dimensions[col].width = w
put(L, "A1", "Loja: ofertas de pacotes (hipótese de preços)", TITLE)
put(L, "A2", "Preços em azul são hipóteses para testar no beta. Compras de itens digitais precisam usar o pagamento das lojas (Apple/Google).", NOTE)
put(L, "A3", "Comissão da loja", BOLD); put(L, "B3", 0.15, BLUE_B, PCT, CEN, YELLOW)
put(L, "H3", "15% no programa para pequenas empresas (até US$ 1 milhão/ano); 30% acima disso.", BLACK, al=WRAP)
hdr(L, 5, ["Oferta", "Pacotes", "Preço (R$)", "Bônus em moedas", "Preço por pacote (R$)", "Desconto vs. avulso", "Receita líquida (R$)", "Observação"])
ofertas = [("Avulso", 1, 1.90, 0, ""), ("Sacola", 6, 9.90, 0, ""), ("Caixa", 15, 19.90, 100, "Mais vendida (hipótese)"), ("Baú do Colecionador", 40, 44.90, 400, "Melhor custo por pacote")]
for i, (nm, q, pr, bn, obs) in enumerate(ofertas, 6):
    put(L, f"A{i}", nm, BOLD); put(L, f"B{i}", q, BLUE, INT, CEN); put(L, f"C{i}", pr, BLUE, BRL, CEN); put(L, f"D{i}", bn, BLUE, INT, CEN)
    put(L, f"E{i}", f"=C{i}/(B{i}+D{i}/Premissas!$B$25)", BLACK, BRL, CEN)
    put(L, f"F{i}", f"=IF($E$6=0,0,1-E{i}/$E$6)", BLACK, PCT, CEN)
    put(L, f"G{i}", f"=C{i}*(1-$B$3)", BLACK, BRL, CEN)
    put(L, f"H{i}", obs, BLACK)
put(L, "A10", "Menor preço por pacote", BOLD); put(L, "E10", "=MIN(E6:E9)", BOLD, BRL, CEN)
put(L, "H10", "Usado na aba Simulação para estimar o gasto.", NOTE)

put(L, "A12", "Quanto custa completar (cenário recomendado com trocas)", SEC)
rec = next(i for i, s in enumerate(sims, 5) if s["nome"].startswith("G."))
put(L, "A13", "Pacotes (mediana)", BOLD); put(L, "E13", f"=Simulação!H{rec}", GREEN, INT, CEN)
put(L, "A14", "Se comprasse tudo (R$)", BOLD); put(L, "E14", "=E13*E10", BLACK, BRL, CEN)
put(L, "A15", "Grátis em 30 dias (pacotes)", BOLD); put(L, "E15", "=Premissas!B26*30", GREEN, INT, CEN)
put(L, "A16", "Gasto p/ completar em 30 dias (R$)", BOLD); put(L, "E16", "=MAX(0,E13-E15)*E10", BOLD, BRL, CEN)
put(L, "A17", "Dias para completar sem gastar", BOLD); put(L, "E17", "=ROUND(E13/Premissas!B26,0)", BLACK, INT, CEN)

wb.move_sheet("Loja", offset=0)
wb.save(OUT)
print("ok")
