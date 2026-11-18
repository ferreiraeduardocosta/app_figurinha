import random, sys
sys.path.insert(0, sys.argv[1])
from dados import CLUBES, LENDAS, MOMENTOS, SUBS_JOG, SUBS_TEC, SUBS_MOM, MASCOTES

# Liga masculina: troca as personagens femininas e guarda as originais para a futura liga feminina
RESERVA = []
for c in CLUBES:
    tn, ti, test, th, tv = c["tecnico"]
    if tn in SUBS_TEC:
        RESERVA.append((c["nome"], "Técnica", "TEC", None, tn, "", ti, "Comum", test, th, tv))
        nn, ni, nh, nv = SUBS_TEC[tn]
        c["tecnico"] = (nn, ni, test, nh, nv)
    novos = []
    for (pos, cam, nome, ap, idade, rar, traco, hist, vis) in c["jogadores"]:
        if nome in SUBS_JOG:
            RESERVA.append((c["nome"], "Jogadora", pos, cam, nome, ap, idade, rar, traco, hist, vis))
            nn, nap, ni, nh, nv = SUBS_JOG[nome]
            novos.append((pos, cam, nn, nap, ni, rar, traco, nh, nv))
        else:
            novos.append((pos, cam, nome, ap, idade, rar, traco, hist, vis))
    c["jogadores"] = novos
MOMENTOS = [(s, t, a, *SUBS_MOM[t], ) if False else ((s, t, a, SUBS_MOM[t][0], d, SUBS_MOM[t][1]) if t in SUBS_MOM else (s, t, a, p, d, v))
            for (s, t, a, p, d, v) in MOMENTOS]
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment

OUT = sys.argv[2]
random.seed(2026)

BASE = {  # ATA, DEF, TEC, VEL, FIS
 "GOL": (25,62,45,45,60), "ZAG": (35,64,45,50,64), "LAT": (45,56,52,62,56),
 "VOL": (45,62,54,52,60), "MEI": (55,45,64,54,50), "PON": (60,35,60,66,48),
 "ATA": (66,30,55,58,60),
}
BONUS = {"Comum":0, "Rara":9, "Épica":17, "Lendária":21}
TRACO = {  # índice: 0 ATA,1 DEF,2 TEC,3 VEL,4 FIS
 "Velocidade":{3:8}, "Força":{4:8,1:3}, "Muralha":{1:8,4:4}, "Drible":{2:6,3:2},
 "Artilheiro":{0:7}, "Finalização":{0:7}, "Visão de jogo":{2:6}, "Passe curto":{2:5},
 "Passe longo":{2:6}, "Passe de trivela":{2:7}, "Jogo aéreo":{4:5,1:2}, "Desarme":{1:5},
 "Antecipação":{1:5,2:2}, "Fôlego":{4:5,3:3}, "Reflexo":{1:5}, "Saída de gol":{1:4,3:2},
 "Cruzamento":{2:4}, "Liderança":{1:3,4:3}, "Chute de longa distância":{0:6,2:2},
 "Arrancada":{3:6,2:3}, "Carrinho":{1:5}, "Promessa":{2:4}, "Chute cruzado":{0:5},
 "Pivô":{4:6,0:2},
}
OVERRIDE = {"Kenji Arata":{3:99}, "Rui Ventania":{3:97}, "Tomás Ribeiro":{4:92}}

def atributos(pos, rar, traco, nome):
    v = [b + BONUS[rar] + random.randint(-4,4) for b in BASE[pos]]
    for i, d in TRACO.get(traco, {}).items(): v[i] += d
    for i, x in OVERRIDE.get(nome, {}).items(): v[i] = x
    return [max(30, min(99, x)) for x in v]

clube_nome = {c["sigla"]: c["nome"] for c in CLUBES}
rows = []  # cada linha: dict
for c in CLUBES:
    s = c["sigla"]
    rows.append(dict(cod=f"{s}-01", sec=c["nome"], clube=c["nome"], tipo="Escudo",
        nome=f"Escudo do {c['nome']}", rar="Comum", traco=f"Lema: {c['frase']}",
        hist=c["ident"], vis=c["escudo_vis"]))
    rows.append(dict(cod=f"{s}-02", sec=c["nome"], clube=c["nome"], tipo="Estádio",
        nome=c["estadio"], rar="Comum", traco=f"Capacidade: {c['cap']:,}".replace(",", "."),
        hist=f"Casa do {c['nome']} em {c['cidade']}. Mascote: {c['mascote']}.", vis=c["estadio_vis"]))
    tn, ti, test, th, tv = c["tecnico"]
    rows.append(dict(cod=f"{s}-03", sec=c["nome"], clube=c["nome"], tipo="Técnico",
        nome=tn, pos="TEC", idade=ti, rar="Comum", traco=test, hist=th, vis=tv))
    for i, (pos, cam, nome, ap, idade, rar, traco, hist, vis) in enumerate(c["jogadores"]):
        rows.append(dict(cod=f"{s}-{i+4:02d}", sec=c["nome"], clube=c["nome"], tipo="Jogador",
            nome=nome, ap=ap, pos=pos, cam=cam, idade=idade, rar=rar, attr=atributos(pos, rar, traco, nome),
            traco=traco, hist=hist, vis=vis))
    mn, me, mp, mh, mv = MASCOTES[s]
    rows.append(dict(cod=f"{s}-15", sec=c["nome"], clube=c["nome"], tipo="Mascote",
        nome=mn, rar="Comum", traco=f"{me} · {mp}", hist=mh, vis=mv))
for i, (s, pos, nome, ap, idade, traco, hist, vis) in enumerate(LENDAS):
    rows.append(dict(cod=f"LEN-{i+1:02d}", sec="Lendas da Liga", clube=clube_nome[s], tipo="Lenda",
        nome=nome, ap=ap, pos=pos, rar="Lendária", attr=atributos(pos, "Lendária", traco, nome),
        traco=traco, hist=f"{hist} Aposentou-se aos {idade} anos.", vis=vis))
for i, (s, tit, ano, prot, desc, vis) in enumerate(MOMENTOS):
    rows.append(dict(cod=f"MOM-{i+1:02d}", sec="Grandes Momentos", clube=clube_nome[s], tipo="Momento",
        nome=tit, rar="Épica", traco=f"{ano} · {prot}", hist=desc, vis=vis))
assert len(rows) == 136, len(rows)

# ---------- estilos ----------
F = "Arial"
H_FILL = PatternFill("solid", fgColor="1F2937")
H_FONT = Font(name=F, bold=True, color="FFFFFF")
BODY = Font(name=F, size=10)
THIN = Side(style="thin", color="D1D5DB")
BORDER = Border(bottom=THIN)
RAR_FILL = {"Comum":"E5E7EB", "Rara":"BFDBFE", "Épica":"DDD6FE", "Lendária":"FDE68A"}
WRAP = Alignment(wrap_text=True, vertical="top")
TOP = Alignment(vertical="top")
CENTER = Alignment(horizontal="center", vertical="top")

def header(ws, cols, widths):
    for j, (h, w) in enumerate(zip(cols, widths), 1):
        cell = ws.cell(row=1, column=j, value=h)
        cell.font, cell.fill = H_FONT, H_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(j)].width = w
    ws.row_dimensions[1].height = 30
    ws.freeze_panes = "A2"

wb = Workbook()

# ---------- Leia-me ----------
ws0 = wb.active; ws0.title = "Leia-me"
ws0.column_dimensions["A"].width = 26; ws0.column_dimensions["B"].width = 95
linhas = [
 ("Craques da Várzea — Fichas da Temporada 1", None, "titulo"),
 ("Álbum com 8 clubes e 136 figurinhas: 8 páginas de clube (escudo, estádio, técnico, 11 jogadores e mascote), 8 Lendas da Liga e 8 Grandes Momentos. Liga masculina; a liga feminina virá depois.", None, "texto"),
 ("", None, None),
 ("Abas", None, "sub"),
 ("Clubes", "Identidade de cada clube: cidade, cores (com código hex), estádio, mascote, rival, clássico e lema.", None),
 ("Figurinhas", "As 128 figurinhas com todos os dados. Use os filtros do cabeçalho para ver por clube, tipo ou raridade.", None),
 ("Resumo", "Contagem por clube e raridade (calculada automaticamente a partir da aba Figurinhas).", None),
 ("Reserva Liga Feminina", "Jogadoras e técnicas criadas na primeira versão, guardadas para a futura liga feminina. Não fazem parte deste álbum.", None),
 ("", None, None),
 ("Colunas da aba Figurinhas", None, "sub"),
 ("Código", "Identificador fixo da figurinha (SIGLA-NN). Ex.: TUB-01 = escudo do Tubarões; TUB-15 = mascote; LEN = Lendas; MOM = Momentos.", None),
 ("Tipo", "Escudo, Estádio, Técnico, Jogador, Mascote, Lenda ou Momento.", None),
 ("Posição", "GOL goleiro · ZAG zagueiro · LAT lateral · VOL volante · MEI meia · PON ponta · ATA atacante · TEC técnico.", None),
 ("ATA / DEF / TEC / VEL / FIS", "Ataque, Defesa (para goleiros: defesa e reflexo), Técnica, Velocidade e Físico, de 30 a 99. Só jogadores e lendas.", None),
 ("Geral", "Média dos 5 atributos (fórmula). Muda sozinha se você editar um atributo.", None),
 ("Traço especial / destaque", "Habilidade marcante do jogador; estilo de jogo do técnico; lema do escudo; capacidade do estádio; espécie e personalidade do mascote; ano e protagonista do momento.", None),
 ("Descrição visual", "Briefing para o ilustrador ou para prompts de IA de imagem. Nunca citar pessoas reais no prompt.", None),
 ("", None, None),
 ("Como os atributos foram gerados", None, "sub"),
 ("Regra", "Base por posição + bônus por raridade (Rara +9, Épica +17, Lendária +21) + variação aleatória de ±4 + bônus do traço especial. Alguns valores foram fixados à mão para combinar com a história (ex.: Kenji Arata VEL 99). Todos podem ser editados livremente.", None),
 ("", None, None),
 ("Antes de lançar", None, "sub"),
 ("Checagem de nomes", "Pesquisar cada nome de jogador, clube e cidade para garantir que não coincide com atleta ou clube real conhecido.", None),
 ("Registro", "Registrar no INPI o nome do app, da liga e os escudos principais.", None),
]
r = 1
for a, b, kind in linhas:
    ca = ws0.cell(row=r, column=1, value=a)
    if kind == "titulo": ca.font = Font(name=F, bold=True, size=16)
    elif kind == "sub": ca.font = Font(name=F, bold=True, size=12)
    elif kind == "texto":
        ws0.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
        ca.font = Font(name=F, size=10); ca.alignment = WRAP; ws0.row_dimensions[r].height = 30
    else:
        ca.font = Font(name=F, bold=True, size=10); ca.alignment = TOP
    if b:
        cb = ws0.cell(row=r, column=2, value=b); cb.font = Font(name=F, size=10); cb.alignment = WRAP
    r += 1

# ---------- Clubes ----------
ws1 = wb.create_sheet("Clubes")
cols = ["Sigla","Clube","Cidade","Inspiração","Cores","Cor 1 (hex)","Cor 2 (hex)","Estádio","Capacidade",
        "Mascote","Rival","Clássico","Lema da torcida","Identidade","Técnico"]
header(ws1, cols, [7,22,15,14,20,11,11,20,11,22,22,18,32,55,18])
for i, c in enumerate(CLUBES, 2):
    vals = [c["sigla"], c["nome"], c["cidade"], c["insp"], c["cores"], "#"+c["hex1"], "#"+c["hex2"],
            c["estadio"], c["cap"], c["mascote"], c["rival"], c["classico"], c["frase"], c["ident"], c["tecnico"][0]]
    for j, v in enumerate(vals, 1):
        cell = ws1.cell(row=i, column=j, value=v); cell.font = BODY; cell.alignment = WRAP; cell.border = BORDER
    ws1.cell(row=i, column=9).number_format = "#,##0"
    for j, hx in ((6, c["hex1"]), (7, c["hex2"])):
        cell = ws1.cell(row=i, column=j); cell.fill = PatternFill("solid", fgColor=hx)
        dark = sum(int(hx[k:k+2], 16) for k in (0,2,4)) < 380
        cell.font = Font(name=F, size=10, bold=True, color="FFFFFF" if dark else "000000")
ws1.auto_filter.ref = f"A1:{get_column_letter(len(cols))}{len(CLUBES)+1}"

# ---------- Figurinhas ----------
ws2 = wb.create_sheet("Figurinhas")
cols = ["Nº","Código","Seção","Clube","Tipo","Nome","Apelido","Posição","Camisa","Idade","Raridade",
        "ATA","DEF","TEC","VEL","FIS","Geral","Traço especial / destaque","Mini-história","Descrição visual (briefing de arte)"]
header(ws2, cols, [5,9,18,22,10,24,13,8,8,7,10,6,6,6,6,6,7,28,55,60])
ws2.cell(row=1, column=17).comment = Comment("Média dos 5 atributos, arredondada. Fórmula.", "Planilha")
for i, d in enumerate(rows, 2):
    attr = d.get("attr") or [None]*5
    vals = [i-1, d["cod"], d["sec"], d["clube"], d["tipo"], d["nome"], d.get("ap") or None, d.get("pos"),
            d.get("cam"), d.get("idade"), d["rar"], *attr, None, d["traco"], d["hist"], d["vis"]]
    for j, v in enumerate(vals, 1):
        cell = ws2.cell(row=i, column=j, value=v); cell.font = BODY; cell.border = BORDER
        cell.alignment = WRAP if j in (6,18,19,20) else (CENTER if j in (1,8,9,10,11,12,13,14,15,16,17) else TOP)
    ws2.cell(row=i, column=17, value=f'=IF(COUNT(L{i}:P{i})=5,ROUND(AVERAGE(L{i}:P{i}),0),"")')
    ws2.cell(row=i, column=17).font = Font(name=F, size=10, bold=True)
    ws2.cell(row=i, column=17).alignment = CENTER; ws2.cell(row=i, column=17).border = BORDER
    ws2.cell(row=i, column=11).fill = PatternFill("solid", fgColor=RAR_FILL[d["rar"]])
    ws2.cell(row=i, column=11).font = Font(name=F, size=10, bold=True)
N = len(rows) + 1
ws2.auto_filter.ref = f"A1:T{N}"
ws2.freeze_panes = "G2"

# ---------- Resumo ----------
ws3 = wb.create_sheet("Resumo")
rar = ["Comum","Rara","Épica","Lendária"]
cols = ["Seção"] + rar + ["Total", "Geral médio (jogadores)"]
header(ws3, cols, [24,10,10,10,10,10,22])
secoes = [c["nome"] for c in CLUBES] + ["Lendas da Liga", "Grandes Momentos"]
for i, s in enumerate(secoes, 2):
    ws3.cell(row=i, column=1, value=s).font = BODY
    for j, rr in enumerate(rar, 2):
        L = get_column_letter(j)
        ws3.cell(row=i, column=j, value=f'=COUNTIFS(Figurinhas!$C$2:$C${N},$A{i},Figurinhas!$K$2:$K${N},{L}$1)')
    ws3.cell(row=i, column=6, value=f"=SUM(B{i}:E{i})")
    ws3.cell(row=i, column=7, value=f'=IFERROR(ROUND(AVERAGEIFS(Figurinhas!$Q$2:$Q${N},Figurinhas!$C$2:$C${N},$A{i},Figurinhas!$E$2:$E${N},"<>Técnico"),1),"-")')
    for j in range(2, 8):
        ws3.cell(row=i, column=j).font = BODY; ws3.cell(row=i, column=j).alignment = Alignment(horizontal="center")
    ws3.cell(row=i, column=7).number_format = "0.0"
t = len(secoes) + 2
ws3.cell(row=t, column=1, value="Total").font = Font(name=F, bold=True)
for j in range(2, 7):
    L = get_column_letter(j)
    c = ws3.cell(row=t, column=j, value=f"=SUM({L}2:{L}{t-1})")
    c.font = Font(name=F, bold=True); c.alignment = Alignment(horizontal="center")
    c.border = Border(top=Side(style="thin", color="111827"))
ws3.cell(row=t, column=1).border = Border(top=Side(style="thin", color="111827"))
ws3.cell(row=t+1, column=1, value="% do álbum").font = Font(name=F, italic=True, size=10)
for j in range(2, 7):
    L = get_column_letter(j)
    c = ws3.cell(row=t+1, column=j, value=f"=IF($F${t}=0,0,{L}{t}/$F${t})")
    c.number_format = "0.0%"; c.font = Font(name=F, italic=True, size=10); c.alignment = Alignment(horizontal="center")
for j, rr in enumerate(rar, 2):
    ws3.cell(row=1, column=j).fill = PatternFill("solid", fgColor=RAR_FILL[rr])
    ws3.cell(row=1, column=j).font = Font(name=F, bold=True, color="111827")

# ---------- Reserva Liga Feminina ----------
ws4 = wb.create_sheet("Reserva Liga Feminina")
cols = ["Clube de origem","Função","Posição","Camisa","Nome","Apelido","Idade","Raridade original",
        "Traço especial / estilo","Mini-história","Descrição visual (briefing de arte)"]
header(ws4, cols, [22,10,8,8,20,10,7,11,26,55,60])
for i, row in enumerate(RESERVA, 2):
    for j, v in enumerate(row, 1):
        cell = ws4.cell(row=i, column=j, value=v or None); cell.font = BODY; cell.border = BORDER
        cell.alignment = WRAP if j in (5,9,10,11) else (CENTER if j in (3,4,7,8) else TOP)
    ws4.cell(row=i, column=8).fill = PatternFill("solid", fgColor=RAR_FILL[row[7]])
ws4.auto_filter.ref = f"A1:K{len(RESERVA)+1}"

wb.save(OUT)
print("ok", len(rows))
