"""Apaga marcas reais (logos de fabricantes, escudos de clubes, patrocínios e
assinaturas) das artes, nas áreas marcadas em marcas.json (coordenadas na imagem 1024x1024).

Preenche cada caixa pela continuação do que está em volta.

Para cada caixa, testa direções (vertical, horizontal e diagonais). Em cada direção,
cada pixel da caixa recebe a mistura das cores logo fora da caixa nos dois sentidos,
pesada pela distância. Fica a direção em que os dois lados mais combinam: segue
listras verticais, faixas diagonais ou um fundo liso. Depois suaviza a emenda."""
import cv2, numpy as np

ANGULOS = [0, 15, -15, 30, -30, 45, -45]
# Onde o entorno é liso ou irregular (cenas), o preenchimento suave do OpenCV fica melhor.
SUAVE = {'LEN-02', 'LEN-06', 'LEO-04', 'LEO-13', 'TUB-15', 'POL-10', 'POL-11', 'POL-12', 'POL-14', 'MOM-05',
         'T2-LEN-01', 'T2-GAL-13', 'T2-TSU-06'}


def suave(cod):
    # Nas temporadas novas, escudos, cenários e momentos usam o preenchimento suave.
    return cod in SUAVE or (cod.startswith('T') and (cod.endswith(('-01', '-02')) or '-MOM-' in cod))
MARGEM = 4

def amostra(img, xs, ys):
    xs = np.clip(np.round(xs).astype(int), 0, img.shape[1] - 1)
    ys = np.clip(np.round(ys).astype(int), 0, img.shape[0] - 1)
    return img[ys, xs].astype(np.float32)

FORCAR = {'CAP-11': [0], 'TUB-14': [0], 'SER-10': [0], 'LEO-05': [30, 45]}
FOLGA = 7  # a marcação foi feita a olho: cada caixa cresce um pouco

def preencher(img, caixa, cod):
    x1, y1, x2, y2 = caixa
    x1, y1, x2, y2 = x1 - FOLGA, y1 - FOLGA, x2 + FOLGA, y2 + FOLGA
    x1, y1 = max(1, x1), max(1, y1); x2, y2 = min(1022, x2), min(1022, y2)
    yy, xx = np.mgrid[y1:y2, x1:x2].astype(np.float32)
    melhor = None
    for ang in ANGULOS:
        t = np.deg2rad(ang); dx, dy = np.sin(t), np.cos(t)  # 0° = vertical
        # distância até sair da caixa (+margem) em cada sentido
        def saida(sx, sy):
            ts = []
            if abs(sx) > 1e-6:
                ts.append(((x2 + MARGEM) - xx) / sx if sx > 0 else ((x1 - MARGEM) - xx) / sx)
            if abs(sy) > 1e-6:
                ts.append(((y2 + MARGEM) - yy) / sy if sy > 0 else ((y1 - MARGEM) - yy) / sy)
            return np.minimum.reduce(ts) if len(ts) > 1 else ts[0]
        ta, tb = saida(dx, dy), saida(-dx, -dy)
        ca = amostra(img, xx + dx * ta, yy + dy * ta)
        cb = amostra(img, xx - dx * tb, yy - dy * tb)
        # Camisas têm listras verticais com frequência: a vertical leva vantagem no empate.
        erro = float(np.mean(np.abs(ca - cb))) * (1 + 0.6 * abs(ang) / 90) * (1 if ang in FORCAR.get(cod, ANGULOS) else 1e9)
        if melhor is None or erro < melhor[0]:
            w = (tb / (ta + tb))[..., None]
            melhor = (erro, ca * w + cb * (1 - w))
    img[y1:y2, x1:x2] = np.clip(melhor[1], 0, 255).astype(np.uint8)
    return (x1, y1, x2, y2)


def limpar(img, cod, caixas):
    """Recebe a imagem (BGR, 1024x1024) e devolve sem os logos marcados para `cod`."""
    if cod not in caixas:
        return img
    folga = 3 if cod == 'MOM-05' else FOLGA
    borda = np.zeros(img.shape[:2], np.uint8)
    for c in caixas[cod]:
        x1, y1, x2, y2 = [max(1, min(1022, v)) for v in (c[0] - folga, c[1] - folga, c[2] + folga, c[3] + folga)]
        anel = np.concatenate([img[max(0, y1 - 5):y1, x1:x2].reshape(-1, 3), img[y2:y2 + 5, x1:x2].reshape(-1, 3),
                               img[y1:y2, max(0, x1 - 5):x1].reshape(-1, 3), img[y1:y2, x2:x2 + 5].reshape(-1, 3)]).astype(np.float32)
        if suave(cod) or float(anel.std(axis=0).mean()) < 14:
            m = np.zeros(img.shape[:2], np.uint8); m[y1:y2, x1:x2] = 255
            img = cv2.inpaint(img, m, 9, cv2.INPAINT_TELEA)
        else:
            preencher(img, c, cod)
            cv2.rectangle(borda, (x1, y1), (x2 - 1, y2 - 1), 255, 3)
    desfocada = cv2.GaussianBlur(img, (5, 5), 0)
    return np.where(borda[..., None] > 0, desfocada, img)
