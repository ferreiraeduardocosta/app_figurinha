"""Baixa as artes das figurinhas (links do Google Drive na planilha de briefing),
padroniza em WebP 512×512 e grava em apps/api/artes/ com o manifesto usado pela API.

Uso, a partir da raiz do repositório:
    python3 -I tools/artes/preparar_artes.py CAMINHO/Briefing_Arte_T1.xlsx [PASTA_DOWNLOADS]

- PASTA_DOWNLOADS guarda os originais (padrão: uma pasta temporária). Arquivos que já
  estão lá não são baixados de novo.
- O nome de cada arquivo leva um hash do conteúdo (TUB-04.1a2b3c4d.webp): o app pode
  guardar a imagem em cache para sempre e uma arte trocada aparece sozinha.
- Os links precisam estar como "qualquer pessoa com o link pode ver".
"""
import hashlib
import io
import json
import re
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

import openpyxl
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
DESTINO = RAIZ / "apps/api/artes"
LADO = 512
QUALIDADE = 82


def ler_links(planilha: Path) -> dict[str, str]:
    links = {}
    for ws in openpyxl.load_workbook(planilha).worksheets:
        linhas = list(ws.iter_rows(values_only=True))
        cab = [str(c) for c in linhas[0]]
        if "Código" not in cab or "Link da Imagem" not in cab:
            continue
        ic, il = cab.index("Código"), cab.index("Link da Imagem")
        for r in linhas[1:]:
            if len(r) <= max(ic, il) or not r[ic] or not r[il]:
                continue
            m = re.search(r"/d/([A-Za-z0-9_-]+)|[?&]id=([A-Za-z0-9_-]+)", str(r[il]))
            if m:
                links[str(r[ic]).strip().upper()] = m.group(1) or m.group(2)
    return links


def baixar(id_drive: str, destino: Path):
    url = f"https://drive.usercontent.google.com/download?id={id_drive}&export=download&confirm=t"
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                dados = r.read()
            Image.open(io.BytesIO(dados)).verify()
            destino.write_bytes(dados)
            return
        except Exception as e:  # noqa: BLE001
            erro = e
            time.sleep(3 * (tentativa + 1))
    raise RuntimeError(f"não consegui baixar {id_drive}: {erro}")


def main():
    planilha = Path(sys.argv[1])
    downloads = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(tempfile.mkdtemp())
    downloads.mkdir(parents=True, exist_ok=True)
    links = ler_links(planilha)
    DESTINO.mkdir(parents=True, exist_ok=True)
    manifesto_antigo = DESTINO / "manifest.json"
    manifesto = json.loads(manifesto_antigo.read_text()) if manifesto_antigo.exists() else {}
    falhas = []
    for codigo, id_drive in sorted(links.items()):
        original = downloads / f"{codigo}.bin"
        try:
            if not original.exists():
                baixar(id_drive, original)
            im = Image.open(original).convert("RGB")
            if im.width != im.height:
                # Não quadrada: recorta um quadrado (centro na horizontal, topo na vertical).
                lado = min(im.size)
                x = (im.width - lado) // 2
                im = im.crop((x, 0, x + lado, lado))
            im = im.resize((LADO, LADO), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, "WEBP", quality=QUALIDADE, method=6)
            dados = buf.getvalue()
            nome = f"{codigo}.{hashlib.sha256(dados).hexdigest()[:8]}.webp"
            (DESTINO / nome).write_bytes(dados)
            manifesto[codigo] = nome
        except Exception as e:  # noqa: BLE001
            falhas.append(f"{codigo}: {e}")
    em_uso = set(manifesto.values())
    for arq in DESTINO.glob("*.webp"):
        if arq.name not in em_uso:
            arq.unlink()
    manifesto_antigo.write_text(json.dumps(dict(sorted(manifesto.items())), indent=1) + "\n")
    total = sum(f.stat().st_size for f in DESTINO.glob("*.webp"))
    print(f"{len(manifesto)} artes em {DESTINO} ({total / 1e6:.1f} MB)")
    if falhas:
        print("Falhas:\n  " + "\n  ".join(falhas))
        sys.exit(1)


if __name__ == "__main__":
    main()
