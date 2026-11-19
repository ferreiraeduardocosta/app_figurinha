"""Recorta os escudos dos clubes (artes CLUBE-01) com fundo transparente, para os
ícones pequenos do app (abas do álbum, canto das cartas, Liga). Grava em
apps/api/artes/escudo-SIGLA.<hash>.webp e registra no manifesto como "escudo-SIGLA".

Uso, a partir da raiz (depois do preparar_artes.py, com os originais baixados):
    python3 -I tools/artes/recortar_escudos.py PASTA_DOWNLOADS
Precisa de opencv-python-headless, numpy e pillow.
"""
import hashlib
import io
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
DESTINO = RAIZ / "apps/api/artes"
SIGLAS = ["CAP", "DRA", "LEO", "POL", "SER", "TUB", "UNI", "VEN"]
LADO = 256


def mascara_grabcut(img):
    mask = np.zeros(img.shape[:2], np.uint8)
    cv2.grabCut(img, mask, (90, 60, 844, 904), np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_RECT)
    return np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)


def mascara_por_cor(img):
    """VEN: o fundo é um estádio; separa pelas cores do escudo (laranja, marinho, azul)."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = (((h >= 5) & (h <= 25) & (s > 120) & (v > 120)) | (v < 80) | ((h >= 85) & (h <= 110) & (s > 70) & (v > 120)))
    m = (m * 255).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    return cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))


def recortar(img, mascara):
    n, lab, st, _ = cv2.connectedComponentsWithStats(mascara)
    m = np.where(lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8) if n > 1 else mascara
    cont, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cheia = np.zeros_like(m)
    cv2.drawContours(cheia, cont, -1, 255, -1)
    cheia = cv2.GaussianBlur(cheia, (3, 3), 0)
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = cheia
    x, y, w, h = cv2.boundingRect(cheia)
    lado = max(w, h) + 20
    x0, y0 = x + w // 2 - lado // 2, y + h // 2 - lado // 2
    out = np.zeros((lado, lado, 4), np.uint8)
    sx0, sy0, sx1, sy1 = max(0, x0), max(0, y0), min(1024, x0 + lado), min(1024, y0 + lado)
    out[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = rgba[sy0:sy1, sx0:sx1]
    return Image.fromarray(out).resize((LADO, LADO), Image.LANCZOS)


def main():
    downloads = Path(sys.argv[1])
    manifesto = json.loads((DESTINO / "manifest.json").read_text())
    for sigla in SIGLAS:
        img = cv2.imread(str(downloads / f"{sigla}-01.bin"))
        im = recortar(img, mascara_por_cor(img) if sigla == "VEN" else mascara_grabcut(img))
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=90, method=6)
        nome = f"escudo-{sigla}.{hashlib.sha256(buf.getvalue()).hexdigest()[:8]}.webp"
        antigo = manifesto.get(f"escudo-{sigla}")
        if antigo and antigo != nome and (DESTINO / antigo).exists():
            (DESTINO / antigo).unlink()
        (DESTINO / nome).write_bytes(buf.getvalue())
        manifesto[f"escudo-{sigla}"] = nome
    (DESTINO / "manifest.json").write_text(json.dumps(dict(sorted(manifesto.items())), indent=1) + "\n")
    print("8 escudos recortados")


if __name__ == "__main__":
    main()
