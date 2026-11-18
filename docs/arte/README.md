# Arte final das figurinhas — PENDENTE

Briefing pronto para o gerador de imagem, uma planilha por tipo, em
[`planilhas/`](planilhas/) (jogadores/técnicos/lendas, escudos, estádios,
mascotes e momentos). Para gerar de novo: `python3 -I tools/planilhas/gerar_planilhas_arte.py`.

Hoje o app usa avatares provisórios (silhuetas). Esta pasta reúne o que é
preciso para produzir a arte final.

## O que precisa ser feito

| Item | Quantidade | Formato |
|---|---|---|
| Retratos de jogadores | 88 | PNG, fundo transparente, 1024×1024, busto |
| Lendas (visual retrô) | 8 | idem |
| Técnicos | 8 | idem |
| Mascotes | 8 | idem |
| Estádios | 8 | PNG 1024×832 (horizontal), sem pessoas |
| Grandes Momentos | 8 | PNG 1024×832 (horizontal) |
| **Total** | **128** | Nome do arquivo = código (`UNI-11.png`) |

Escudos não entram: já existem em vetor (`apps/mobile/src/componentes/Escudo.tsx`).
Moldura, nota, nome e atributos são desenhados pelo app; a arte é só o retrato.

## Caminho recomendado (híbrido)

1. **Ilustrador define o estilo**: guia visual + 8 a 10 personagens-chave (um
   craque de cada clube e um mascote). Isso dá consistência e fortalece a
   autoria (arte gerada só por IA tem proteção autoral fraca).
2. **IA de imagem produz o restante em série**, usando as artes do ilustrador
   como referência de estilo e os prompts de [`prompts.csv`](prompts.csv)
   (gerados de "Descrição visual" da planilha).
3. **Revisão humana de cada imagem**: retoque, consistência e conferir que
   nenhum rosto lembra uma pessoa real.
4. Subir as imagens pelo painel de administração (funcionalidade a construir
   quando a arte existir).

## Ferramentas disponíveis no Claude (catálogo em novembro de 2026)

- **Adobe** (connector oficial): vale conferir se inclui a geração com Firefly,
  que foi pensada para uso comercial.
- **Canva** (connector oficial): bom para montar materiais de divulgação a
  partir de modelos; a geração por IA fica dentro do próprio Canva.
- **Abracadabrax** (plugin da comunidade): gera imagens com créditos pagos;
  ler os termos de uso comercial antes.
- **image-generation** (plugin da comunidade): só um guia de prompts, não gera
  imagens.

O Claude em si não gera imagens.

## Cuidados

- Ler os termos de uso comercial da ferramenta de IA escolhida.
- Nunca usar nome ou foto de jogador real como referência nos prompts.
- Guardar os arquivos originais (camadas) do ilustrador.

Para regenerar os prompts depois de mudar a planilha:

```bash
python3 -I tools/planilhas/gerar_prompts_arte.py
```
