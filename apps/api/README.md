# API — Craques da Várzea

NestJS + Prisma + PostgreSQL. Todo sorteio de pacote acontece aqui, dentro de uma
transação com a linha do jogador travada; o app só mostra o resultado.

## Rodar localmente

```bash
docker compose up -d                 # na raiz: sobe o PostgreSQL
cp apps/api/.env.example apps/api/.env
npm install                          # na raiz
npm run build --workspace packages/regras
cd apps/api
npx prisma migrate deploy            # cria as tabelas
npm run db:seed                      # carrega 8 clubes e 136 figurinhas
npm run dev                          # http://localhost:3000
```

## Endpoints

Públicos:

| Método | Rota | O que faz |
|---|---|---|
| GET | `/saude` | Verificação de saúde |
| GET | `/clubes` | Os 8 clubes |
| GET | `/figurinhas` | As 136 figurinhas |
| GET | `/figurinhas/:codigo` | Uma figurinha (ex.: `UNI-11`) |
| GET | `/probabilidades` | Probabilidades, garantia mínima, Brilhante e balcão |
| GET | `/liga` | Classificação, última e próxima rodada, artilharia e figurinha "Em alta" (simula rodadas vencidas) |
| POST | `/auth/cadastro` | `{ apelido, email, senha }` → `{ token, expiraEm, usuario }` |
| POST | `/auth/entrar` | `{ email, senha }` → `{ token, expiraEm, usuario }` |

Com login (`Authorization: Bearer <token>`):

| Método | Rota | O que faz |
|---|---|---|
| POST | `/auth/sair` | Encerra a sessão |
| POST | `/auth/excluir-conta` | `{ senha }`: exclui a conta (apaga; ou anonimiza se houver compras a guardar) |
| GET | `/eu` | Perfil: moedas, pacote diário, garantia e progresso |
| GET | `/album` | Figurinhas do jogador e repetidas por raridade |
| POST | `/pacotes/diario` | Abre o pacote grátis do dia (1 por dia, meia-noite de Brasília) |
| POST | `/pacotes/bonus` | Abre um pacote de recompensa (ganho ao completar uma página) |
| POST | `/balcao` | `{ codigo }`: troca 4 repetidas da mesma raridade pela figurinha |
| POST | `/pacotes/comprado` | Abre um pacote comprado na loja |
| POST | `/pacotes/moedas` | Compra e abre um pacote por 100 moedas |
| GET | `/loja` | Ofertas, moedas e se o jogador pode comprar (e por quê) |
| POST | `/loja/nascimento` | `{ dataNascimento: "AAAA-MM-DD" }`, uma única vez |
| POST | `/loja/compra-teste` | `{ produtoId }`: compra simulada (só com `LOJA_TESTE=1`) |
| GET | `/ranking?escopo=geral\|amigos` | Ranking de colecionadores (top 50 + a posição do jogador) |
| GET | `/missoes` | As 3 missões do dia, com progresso |
| POST | `/missoes/:id/resgatar` | Resgata as moedas de uma missão cumprida (uma vez) |
| GET | `/amigos` | Amigos, pedidos recebidos e enviados |
| POST | `/amigos` | `{ apelido }`: pede amizade (aceita na hora se o outro já tinha pedido) |
| POST | `/amigos/:id/aceitar` | Aceita um pedido recebido |
| DELETE | `/amigos/:id` | Recusa/cancela pedido ou desfaz amizade (cancela propostas pendentes entre os dois) |
| GET | `/trocas` | Propostas recebidas, enviadas e histórico |
| GET | `/trocas/sugestoes` | Mercado de repetidas: por amigo, o que eu recebo e o que eu dou |
| POST | `/trocas` | `{ paraId, oferta, pedido, respostaA? }`: propõe (ou contrapropõe) uma troca |
| POST | `/trocas/:id/aceitar` | Aceita; move as figurinhas e entrega recompensas |
| POST | `/trocas/:id/recusar` | Recusa (quem recebeu) |
| POST | `/trocas/:id/cancelar` | Cancela (quem propôs) |

Abrir pacote e trocar no balcão também devolvem `recompensas`: páginas
completadas (`PAGINA`, +1 pacote de recompensa cada) e álbum completo
(`ALBUM`, Troféu Craques da Várzea). Cada recompensa é entregue uma única vez.

Sem login, com segredo próprio: `POST /loja/webhook/revenuecat` (avisos de compra
e reembolso do RevenueCat; ver [docs/LOJA.md](../../docs/LOJA.md)).

Erros vêm como `{ codigo, mensagem }` (ex.: `PACOTE_DIARIO_JA_ABERTO`,
`REPETIDAS_INSUFICIENTES`, `SEM_PACOTE_BONUS`, `CREDENCIAIS_INVALIDAS`).

## Regras de troca

- Só entre amigos, e só repetidas: ninguém perde a última cópia de nada.
- Até 5 figurinhas de cada lado; a proposta vence em 7 dias.
- Ao aceitar, os dois jogadores são travados no banco (sempre na mesma ordem) e
  as repetidas são conferidas de novo; se alguém já gastou, a proposta vira
  `FALHOU`.
- Contra abuso: até 20 propostas pendentes por jogador, até 10 trocas por dia,
  e contas com menos de 3 dias não trocam Lendárias (`LIMITES_TROCA` em
  `src/social/trocas.service.ts`).

## Painel de administração

Abra `http://localhost:3000/admin/` e entre com uma conta de administrador.

- **Resumo:** jogadores, pacotes abertos e a conferência do sorteio (raridades
  que saíram x probabilidades configuradas, sem contar a garantia mínima).
- **Figurinhas:** busca, filtros, edição, criação e exclusão. Mudanças de
  raridade recarregam o sorteio na hora. Não é possível excluir figurinha que
  algum jogador já tem, nem deixar uma raridade sem figurinhas.
- **Alterações:** histórico de quem mudou o quê (valor antes → depois).
- **Usuários:** busca por apelido ou e-mail.

O primeiro administrador é definido pelo terminal do servidor (o app nunca
promove ninguém):

```bash
npm run admin:promover -- pessoa@exemplo.com            # dá o papel de admin
npm run admin:promover -- pessoa@exemplo.com --remover  # tira
```

Rotas (todas exigem papel ADMIN): `GET /admin/resumo`, `GET|POST /admin/figurinhas`,
`PATCH|DELETE /admin/figurinhas/:codigo`, `GET /admin/alteracoes`, `GET /admin/usuarios?busca=`.

## Segurança

- Senhas com scrypt e sal aleatório; o login confere a senha mesmo quando o
  e-mail não existe, para o tempo de resposta não revelar cadastros.
- Sessão por token aleatório de 256 bits; o banco guarda só o hash SHA-256.
  Expira em 30 dias e é apagada ao sair.
- Limite de pedidos por IP: 120/min no geral e 10/min em cadastro e login.
- CORS desligado por padrão; para o Expo web, defina `CORS_ORIGENS`.
- Painel: página servida com Content-Security-Policy restrita (só scripts do
  próprio servidor), sem permitir abrir em iframe; todo dado entra na página
  como texto, nunca como HTML; o token fica em `sessionStorage` (some ao
  fechar a aba).

## Testes

```bash
DATABASE_URL=... npm test   # integração com banco real; sem DATABASE_URL os testes são pulados
```
