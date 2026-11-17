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
npx prisma migrate dev               # cria as tabelas
npm run db:seed                      # carrega 8 clubes e 136 figurinhas
npm run dev                          # http://localhost:3000
```

## Endpoints

| Método | Rota | O que faz |
|---|---|---|
| GET | `/saude` | Verificação de saúde |
| GET | `/clubes` | Os 8 clubes |
| GET | `/figurinhas` | As 136 figurinhas |
| GET | `/figurinhas/:codigo` | Uma figurinha (ex.: `UNI-11`) |
| GET | `/probabilidades` | Probabilidades, garantia mínima, Brilhante e balcão |

O `PacotesService` já abre o pacote diário e opera o balcão; os endpoints
dessas ações entram junto com o login (próximo passo da Fase 1).

## Testes

```bash
DATABASE_URL=... npm test   # integração com banco real; sem DATABASE_URL os testes são pulados
```
