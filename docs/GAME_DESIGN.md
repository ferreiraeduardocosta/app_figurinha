# Liga Aurora — Documento de Game Design (Temporada 1)

App mobile (Android e iOS) para abrir pacotes, colecionar e trocar figurinhas de
jogadores de futebol de uma liga **fictícia**.

> Fontes de verdade:
> - Fichas das figurinhas: [`planilhas/Liga_Aurora_Fichas_T1.xlsx`](planilhas/Liga_Aurora_Fichas_T1.xlsx)
>   e [`../data/temporada1/figurinhas.json`](../data/temporada1/figurinhas.json)
> - Economia: [`planilhas/Liga_Aurora_Economia_T1.xlsx`](planilhas/Liga_Aurora_Economia_T1.xlsx)
>   e [`../data/temporada1/economia.json`](../data/temporada1/economia.json)
> - Kit visual (escudos, molduras, mascotes e telas): quadro de design "Liga Aurora — Kit Visual" no claude.ai

---

## 1. Por que uma liga fictícia

Usar nome, rosto ou caricatura reconhecível de jogadores reais exige licença de
direito de imagem (CF art. 5º, X; Código Civil art. 20; Súmula 403 do STJ;
Lei Pelé art. 87-A). Caricatura ou imagem transformada por IA **não** resolve:
o que a lei protege é a identidade da pessoa, e o uso é comercial. Escudos e
uniformes de clubes são marcas registradas.

Decisão: lançar com um universo próprio, a **Liga Aurora**. Licenças reais podem
entrar depois como coleções especiais.

Antes de lançar:
- pesquisar todos os nomes (jogadores, clubes, cidades) para garantir que não
  coincidem com atletas ou clubes reais conhecidos;
- registrar no INPI o nome do app, da liga e os escudos principais;
- consultar advogado de direito digital/desportivo (loot boxes, ECA Digital, LGPD).

## 2. O universo

- **Liga Aurora**, masculina. Uma liga feminina virá depois; as personagens
  já criadas estão guardadas na aba "Reserva Liga Feminina" da planilha de fichas.
- **8 clubes**, campeonato único em turno e returno (14 rodadas, 4 jogos cada).
- Rodadas simuladas pelo servidor toda semana: uma temporada dura ~3,5 meses.

| Clube | Cidade | Cores | Mascote |
|---|---|---|---|
| Tubarões do Cais (TUB) | Porto Alvo | Azul-marinho e branco | Dentão, o tubarão |
| Atlético Serrano (SER) | Alto da Serra | Verde e dourado | Tufão, o condor |
| Unidos da Várzea (UNI) | Vila Esperança | Vermelho e branco | Pipoca, o vira-lata |
| Real Capitólio (CAP) | Capitólio | Roxo e prata | Majestade, a águia |
| Estrela Polar FC (POL) | Nordhavn | Branco e azul-celeste | Nevasca, o urso-polar |
| Sporting Vento Norte (VEN) | Ventura | Laranja e preto | Rajada, o falcão |
| Dragões de Kaiyo (DRA) | Kaiyo | Vermelho e preto | Kazan, o dragão |
| Leões da Savana Alta (LEO) | Nkosi | Amarelo e verde-escuro | Zuri, o leão |

**Clássicos:** do Litoral (TUB × SER), do Povo (UNI × CAP), do Gelo (POL × VEN)
e das Feras (DRA × LEO).

**Expansão:** a Temporada 2 traz 4 clubes que sobem da "Segunda Divisão"
(entre eles Relâmpago Shiro e Búfalos do Rio Grande).

## 3. O álbum — 136 figurinhas

| Seção | Conteúdo | Qtd. |
|---|---|---|
| 8 páginas de clube | Escudo (-01), estádio (-02), técnico (-03), 11 jogadores (-04 a -14), mascote (-15) | 120 |
| Lendas da Liga | 1 ídolo aposentado por clube (LEN-01 a LEN-08) | 8 |
| Grandes Momentos | 1 lance histórico por clube (MOM-01 a MOM-08) | 8 |

Recompensas (entregues pelo servidor, uma única vez cada):
- **Página completa** (cada clube, Lendas e Momentos: 10 páginas) = 1 pacote de recompensa.
- **Álbum completo** = Troféu Liga Aurora — Temporada 1, peça exclusiva que não sai em pacote.

### Raridades

| Raridade | Quem | Qtd. | Chance por figurinha | Moldura |
|---|---|---|---|---|
| Comum | Elenco base, escudos, estádios, técnicos, mascotes | 88 | 62% | Cinza, 1 losango |
| Rara | 3 titulares de destaque por clube | 24 | 25% | Prata, 2 losangos |
| Épica | Craque de cada clube + Grandes Momentos | 16 | 10% | Dourada, 3 losangos |
| Lendária | Lendas da Liga | 8 | 3% | Aurora animada, 4 losangos |

**Brilhante:** variante holográfica de qualquer figurinha, 5% de chance, cosmética
(não conta para completar o álbum).

A raridade é sempre comunicada por moldura + número de losangos + nome escrito,
para não depender só de cor (acessibilidade).

### Ficha de cada jogador

Nome, apelido, posição, camisa, idade, raridade, **5 atributos de 30 a 99**
(Ataque, Defesa, Técnica, Velocidade, Físico), nota geral (média), traço
especial, mini-história e descrição visual (briefing para a arte).

## 4. Economia

Meta: completar o álbum com **60 a 100 pacotes** (mediana) para quem joga com trocas.

| Regra | Valor |
|---|---|
| Figurinhas por pacote | 5 |
| Probabilidades C/R/E/L | 62% / 25% / 10% / 3% |
| Garantia mínima | 1 Épica a cada 10 pacotes; 1 Lendária a cada 30 |
| Balcão de repetidas | 4 repetidas da mesma raridade → 1 que falta, à escolha |
| Pacote grátis | 1 por dia |
| Moedas | ~60/dia em missões; pacote custa 100 moedas |

Resultado da simulação (2.000 coleções por cenário):

| Cenário | Pacotes (mediana) | 10% mais azarados |
|---|---|---|
| Esboço original (72/21/6/1), sozinho | 400 | 694 |
| **Recomendado, sozinho** | **87** | 124 |
| **Recomendado, com trocas** | **69** | 101 |

No cenário recomendado com trocas: ~43 dias sem gastar, ou ~R$ 21 para completar em 30 dias.

Com os 10 pacotes de recompensa por página completa (simulação de 1.500 coleções):

| Cenário | Sem recompensa | Com recompensa |
|---|---|---|
| Com trocas (mediana) | 69 pacotes | **59 pacotes** |
| Sozinho (mediana) | 85 pacotes | **78 pacotes** |

A mediana com trocas ficou 1 pacote abaixo da meta mínima (60). Se o beta mostrar
o álbum acabando rápido demais, dá para dar a recompensa só para páginas de clube
(8 em vez de 10) ou subir o balcão para 5→1.

### Loja (hipóteses para o beta)

| Oferta | Pacotes | Preço |
|---|---|---|
| Avulso | 1 | R$ 1,90 |
| Sacola | 6 | R$ 9,90 |
| Caixa | 15 (+100 moedas) | R$ 19,90 |
| Baú do Colecionador | 40 (+400 moedas) | R$ 44,90 |

### Regras obrigatórias

- **Sorteio sempre no servidor.** O app só mostra o resultado.
- **Tela de probabilidades** antes da compra, incluindo a garantia mínima (exigência Apple/Google).
- Compras de itens digitais só pelo pagamento das lojas (In-App Purchase).
- Sem saque de dinheiro real e sem venda de figurinhas por dinheiro.

## 5. Trocas

- Proposta 1:1 ou N:M entre amigos: oferecer, pedir, aceitar, recusar, contrapropor.
- Execução atômica no banco (transação), sem duplicar figurinhas.
- "Mercado de repetidas": cruza o que falta para mim com o que sobra para os outros.
- Antifraude: limite diário de trocas e bloqueio de Lendárias para contas novas.

## 6. Engajamento

1. Rodadas simuladas semanais com placares e artilheiros.
2. Figurinha *Em alta* para o craque da rodada (edição limitada).
3. Transferências entre temporadas geram figurinhas novas.
4. Carreiras que evoluem (ex.: Pedrinho Lua, Comum na T1, pode virar Épico).
5. Clube do coração com bônus e notícias.
6. Votações da comunidade (seleção da temporada).
7. Minijogo **Bafo** usando os atributos.

## 7. Fases

| Fase | Entrega | Marco |
|---|---|---|
| 0. Fundação ✅ | Universo, fichas, economia, kit visual | Este documento |
| 1. MVP colecionar 🟡 | Login ✅, álbum ✅, pacote grátis diário ✅, balcão ✅, probabilidades ✅, painel admin ✅, recompensas ✅; **pendente: arte final ([docs/arte](arte/README.md)) e teste em celular** | Beta fechado |
| 2. Trocas | Amigos, propostas, mercado de repetidas, push | Beta aberto |
| 3. Monetização | Loja IAP (RevenueCat), tela de probabilidades, garantia mínima | v1.0 nas lojas |
| 4. Engajamento | Rodadas simuladas, missões, ranking, Bafo | Retenção |
| 5. Escala | Observabilidade, testes de carga, analytics, i18n | Crescimento |
