# API do Craques da Várzea (NestJS + Prisma). Construir a partir da raiz do repositório:
#   docker build -t craques-da-varzea-api .
# Imagem completa do Node: já traz o OpenSSL que o Prisma usa (a "slim" não traz).
# Base trocável, por exemplo para um espelho se o Docker Hub limitar downloads:
#   docker build --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-bookworm .
ARG NODE_IMAGE=node:22-bookworm
FROM ${NODE_IMAGE} AS base
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY packages/regras/package.json packages/regras/
COPY apps/api/package.json apps/api/
# Atrás de um proxy com certificado próprio (rede corporativa), passe o certificado
# como segredo opcional: --secret id=ca_extra,src=/caminho/ca.crt
# (e as variáveis HTTPS_PROXY/NO_PROXY como --build-arg). Fora disso, nada muda.
RUN --mount=type=secret,id=ca_extra,required=false \
  if [ -f /run/secrets/ca_extra ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_extra; fi; \
  npm ci --no-audit --no-fund
COPY packages/regras packages/regras
COPY apps/api apps/api
COPY data data
RUN --mount=type=secret,id=ca_extra,required=false \
  if [ -f /run/secrets/ca_extra ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_extra; fi; \
  npm run build --workspace packages/regras \
  && (cd apps/api && npx prisma generate) \
  && npm run build --workspace apps/api

FROM base AS producao
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
USER node
EXPOSE 3000
# Aplica as migrações pendentes, carrega as figurinhas se o banco estiver vazio
# (primeiro deploy), promove ADMIN_EMAIL a administrador se a variável existir
# (para hospedagens sem terminal; a conta precisa já estar cadastrada) e sobe a API.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed:se-vazio && if [ -n \"$ADMIN_EMAIL\" ]; then npm run admin:promover -- \"$ADMIN_EMAIL\" || true; fi && node dist/main.js"]
