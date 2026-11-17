# Loja e pagamentos

## Como funciona

- As ofertas ficam em [`data/temporada1/loja.json`](../data/temporada1/loja.json).
- O app inicia a compra pela App Store ou Google Play, via **RevenueCat**.
- O RevenueCat avisa o servidor (webhook) e **só o servidor credita** os pacotes
  e as moedas, uma única vez por transação. O app nunca credita nada.
- Reembolso (estorno) retira os pacotes e moedas ainda não usados.
- Antes da primeira compra o jogador informa a data de nascimento (uma única vez):
  menores de 13 anos não compram; de 13 a 17 anos há limite de R$ 50 por mês.
  Esses limites são aplicados **antes** de iniciar o pagamento; depois que a loja
  cobrou, o servidor sempre credita.
- As probabilidades ficam visíveis na própria loja e na tela de probabilidades
  (exigência da Apple e do Google para pacotes com conteúdo aleatório).

## Ofertas

| Id do produto | Nome | Conteúdo | Preço de referência |
|---|---|---|---|
| `pacote_1` | Avulso | 1 pacote | R$ 1,90 |
| `pacote_6` | Sacola | 6 pacotes | R$ 9,90 |
| `pacote_15` | Caixa | 15 pacotes + 100 moedas | R$ 19,90 |
| `pacote_40` | Baú do Colecionador | 40 pacotes + 400 moedas | R$ 44,90 |

Também dá para comprar 1 pacote com 100 moedas (sem dinheiro).

## Modo de teste (desenvolvimento)

Com `LOJA_TESTE=1` na API (e `NODE_ENV` diferente de `production`), o botão
"Comprar" simula a compra, sem cobrança, respeitando os mesmos limites.

## Para ligar os pagamentos de verdade (PENDENTE, depende de você)

1. **Contas de desenvolvedor**: Apple Developer Program e Google Play Console.
2. **Produtos nas lojas**: criar os 4 produtos acima como **consumíveis**
   (App Store: *Consumable*; Google Play: produto no app, consumível) com os
   mesmos ids. O preço final é definido em cada loja.
3. **RevenueCat**: criar o projeto, ligar os dois apps e importar os produtos.
4. **Webhook**: no RevenueCat, em Integrations → Webhooks, apontar para
   `https://<sua-api>/loja/webhook/revenuecat` e definir um valor para o
   cabeçalho *Authorization*. Colocar o mesmo valor em
   `REVENUECAT_WEBHOOK_TOKEN` na API.
5. **App**: instalar `react-native-purchases`, configurar com as chaves públicas
   do RevenueCat, chamar `Purchases.logIn(<id do usuário>)` após o login e trocar
   a implementação de `apps/mobile/src/pagamentos.ts` (o arquivo explica os
   passos). Isso exige *development build* (não roda no Expo Go).
6. **Testar com compras de sandbox** (TestFlight e faixa de teste interno do
   Google Play) antes de publicar.

## Antes de publicar

- Comissão das lojas: 15% no programa para pequenas empresas (até US$ 1 milhão
  por ano), 30% acima disso.
- Classificação etária nas lojas e textos de compra revisados.
- **Revisão jurídica**: pacotes pagos com conteúdo aleatório, ECA Digital (Lei
  15.211/2025) e LGPD. Os limites para menores aqui são um ponto de partida, não
  um parecer.
- Contas com compras não são apagadas automaticamente (os registros financeiros
  ficam guardados); um fluxo de exclusão de conta com anonimização ainda precisa
  ser feito.
