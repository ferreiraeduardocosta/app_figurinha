# Scripts das planilhas

Geram as planilhas de `docs/planilhas/`. Rodar a partir desta pasta:

```bash
python3 -I gerar.py . ../../docs/planilhas/Liga_Aurora_Fichas_T1.xlsx
python3 -I sim_eco.py sim_eco.json
python3 -I gerar_eco.py sim_eco.json ../../docs/planilhas/Liga_Aurora_Economia_T1.xlsx
```

- `dados.py`: clubes, jogadores, lendas, momentos, mascotes e as substituições da liga masculina.
- `gerar.py`: monta a planilha de fichas (atributos gerados com semente fixa).
- `sim_eco.py`: simulação Monte Carlo dos cenários de economia (demora alguns minutos).
- `gerar_eco.py`: monta a planilha de economia a partir do resultado da simulação.

Depois de mudar as fichas, regenere `data/temporada1/*.json` (ver o README da raiz).
