# API — Liga Aurora

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
| POST | `/auth/cadastro` | `{ apelido, email, senha }` → `{ token, expiraEm, usuario }` |
| POST | `/auth/entrar` | `{ email, senha }` → `{ token, expiraEm, usuario }` |

Com login (`Authorization: Bearer <token>`):

| Método | Rota | O que faz |
|---|---|---|
| POST | `/auth/sair` | Encerra a sessão |
| GET | `/eu` | Perfil: moedas, pacote diário, garantia e progresso |
| GET | `/album` | Figurinhas do jogador e repetidas por raridade |
| POST | `/pacotes/diario` | Abre o pacote grátis do dia (1 por dia, meia-noite de Brasília) |
| POST | `/balcao` | `{ codigo }`: troca 4 repetidas da mesma raridade pela figurinha |

Erros vêm como `{ codigo, mensagem }` (ex.: `PACOTE_DIARIO_JA_ABERTO`,
`REPETIDAS_INSUFICIENTES`, `CREDENCIAIS_INVALIDAS`).

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
